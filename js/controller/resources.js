// Контроллер экрана питания.
import { FOODS, NUTRITION, WATER_TARGET_ML, offSearch } from "../../data/nutrition.js";
import { render } from "./router.js";
import { addDays, today } from "../core/format.js";
import { checkAchievements } from "../model/achievements.js";
import { drinkWaterOf, nutDay, nutRead, nutTotals, pushRecent } from "../model/nutrition.js";
import { S, save } from "../model/store.js";
import { L, themeNow } from "../model/theme.js";
import { app, overlayRoot } from "../view/dom.js";
import { dayTipView, foodListView, gaugesView, mealsView, portionChipsView, portionPreviewView, portionView, resourcesView, weekStripView } from "../view/resources.js";

export let resDate = null;               // выбранный день (по умолчанию сегодня)

export const curResDate = () => resDate || today();

export function renderResources() {
  const date = curResDate();
  const isToday = date === today();
  const day = nutRead(date);
  const T = NUTRITION.dayTypes[day.dayType];
  const tot = nutTotals(day);

  const fiberTgt = NUTRITION.constants.fiber[0];
  // готовность пайка считаем по 4 основным нутриентам; клетчатка — отдельная шкала
  const core = [
    { key: "kcal", name: "Калории", unit: "ккал", cur: tot.k, tgt: T.kcal },
    { key: "protein", name: "Белок", unit: "г", cur: tot.p, tgt: T.protein, floor: true },
    { key: "carbs", name: "Углеводы", unit: "г", cur: tot.cb, tgt: T.carbs },
    { key: "fat", name: "Жиры", unit: "г", cur: tot.f, tgt: T.fat },
  ];
  const readiness = Math.round(100 * core.reduce((a, m) => a + Math.min(1, m.cur / m.tgt), 0) / core.length);
  const proteinOk = tot.p >= T.protein * 0.95;
  const kcalPct = tot.k / T.kcal;
  const kcalOk = kcalPct >= 0.9 && kcalPct <= 1.1;
  let vCls, vTxt;
  if (readiness >= 90 && proteinOk && kcalOk) { vCls = "verdict-gold"; vTxt = L("nGold"); }
  else if (readiness >= 55) { vCls = "verdict-mid"; vTxt = L("nMid"); }
  else { vCls = "verdict-fail"; vTxt = L("nFail"); }

  const gaugeList = [...core, { key: "fiber", name: "Клетчатка", unit: "г", cur: tot.fb, tgt: fiberTgt, floor: true }];
  const ring = 2 * Math.PI * 52;
  const gaugeHTML = gaugesView({ gaugeList });

  // вода = стаканы вручную + вода из напитков дня
  const drinkWater = Math.round(drinkWaterOf(day));
  const totalWater = day.water + drinkWater;
  const waterCups = Math.round(day.water / 250);
  const waterPct = Math.min(100, (totalWater / WATER_TARGET_ML) * 100);

  const itemsHTML = mealsView({ day });

  // Подсказки по таймингу питания — это советы тренера. В «Чистой» их нет:
  // пользователь пришёл записать съеденное, а не читать методичку.
  const tip = dayTipView({ T, day });

  // календарь: 7 дней. Окно оканчивается сегодня, либо выбранным днём, если он раньше.
  const winEnd = (date <= today() && date > addDays(today(), -6)) ? today() : date;
  const strip = weekStripView({ date, winEnd });

  app.innerHTML = resourcesView({ T, date, day, drinkWater, gaugeHTML, isToday, itemsHTML, readiness, ring, strip, tip, totalWater, vCls, vTxt, waterCups, waterPct });

  // навигация по дням
  document.getElementById("day-prev").onclick = () => { resDate = addDays(date, -1); render(); };
  const nextBtn = document.getElementById("day-next");
  if (nextBtn && !nextBtn.disabled) nextBtn.onclick = () => { if (date < today()) { resDate = addDays(date, 1); render(); } };
  const todayBtn = document.getElementById("day-today");
  if (todayBtn) todayBtn.onclick = () => { resDate = today(); render(); };
  app.querySelectorAll(".cday").forEach((b) => { if (!b.disabled) b.onclick = () => { resDate = b.dataset.d; render(); }; });

  // тип дня, вода, удаление — пишем в постоянную запись выбранного дня
  app.querySelectorAll(".dt").forEach((b) => b.onclick = () => { nutDay(date).dayType = b.dataset.dt; save(); render(); checkAchievements({ type: "nutrition" }); });
  document.getElementById("water-plus").onclick = () => { nutDay(date).water += 250; save(); render(); checkAchievements({ type: "nutrition" }); };
  document.getElementById("water-minus").onclick = () => { const d = nutDay(date); d.water = Math.max(0, d.water - 250); save(); render(); };
  app.querySelectorAll(".meal-del").forEach((b) => b.onclick = () => { nutDay(date).items.splice(+b.dataset.i, 1); save(); render(); });
  // клик по приёму — изменить порцию
  app.querySelectorAll(".meal-main").forEach((b) => b.onclick = () => {
    const i = +b.dataset.i;
    openPortion(nutRead(date).items[i], date, i);
  });

  wireFoodSearch(date);
}

/* ---------- поиск продуктов: локальный справочник + Open Food Facts ---------- */
export let foodSearchTimer = null;

export let foodSearchCtl = null;

export function wireFoodSearch(date) {
  const input = document.getElementById("food-q");
  const box = document.getElementById("food-results");
  if (!input || !box) return;

  const renderList = (foods, note, opts = {}) => {
    const star = opts.starIds || new Set();
    box.innerHTML =
      foodListView({ foods, note, opts, star });
    // кэш найденных, чтобы открыть порцию
    box._foods = {};
    foods.forEach((f) => (box._foods[f.id] = f));
    box.querySelectorAll(".food-item").forEach((el) => {
      el.querySelector(".food-add").onclick = () => openPortion(box._foods[el.dataset.id], date);
    });
    const more = box.querySelector("#food-more");
    if (more && opts.onMore) more.onclick = opts.onMore;
  };

  // «Частое и недавнее»: 2 самых частых + 3 последних, остальное — под «Развернуть»
  const showDefault = (expanded = false) => {
    const fs = S.nutrition.foodStats || {};
    let pool = Object.values(fs);
    if (!pool.length && (S.nutrition.recent || []).length) pool = S.nutrition.recent.map((f, i) => ({ food: f, count: 1, last: 1e12 - i }));
    // до первого запроса показываем короткий список: это подсказка, а не каталог
    if (!pool.length) { renderList(FOODS.slice(0, themeNow() === "plain" ? 4 : 8), "Популярное"); return; }
    const freq = [...pool].sort((a, b) => b.count - a.count || b.last - a.last).filter((x) => x.count >= 2).slice(0, 2);
    const freqIds = new Set(freq.map((x) => x.food.id));
    const byRecent = pool.filter((x) => !freqIds.has(x.food.id)).sort((a, b) => b.last - a.last);
    const rest = byRecent.slice(3);
    const head = [...freq, ...byRecent.slice(0, 3)].map((x) => x.food);
    const list = expanded ? [...head, ...rest.map((x) => x.food)] : head;
    renderList(list, "Частое и недавнее", {
      starIds: freqIds,
      moreCount: (!expanded && rest.length) ? rest.length : 0,
      onMore: () => showDefault(true),
    });
  };
  showDefault();

  input.oninput = () => {
    const q = input.value.trim().toLowerCase();
    clearTimeout(foodSearchTimer);
    if (foodSearchCtl) { foodSearchCtl.abort(); foodSearchCtl = null; }
    if (!q) { showDefault(); return; }

    // мгновенно — локальные совпадения
    const local = FOODS.filter((f) => f.n.toLowerCase().includes(q)).slice(0, 10);
    // внешний поиск — единственное место, где введённый текст уходит за пределы устройства.
    // Его можно выключить в профиле: тогда работаем только по своему справочнику.
    if (!(S.settings && S.settings.offSearch)) { renderList(local, "Только свой справочник"); return; }
    renderList(local, "Из справочника · ищу в базе Open Food Facts…");

    // затем — Open Food Facts (с debounce)
    foodSearchTimer = setTimeout(async () => {
      foodSearchCtl = new AbortController();
      const killer = setTimeout(() => foodSearchCtl && foodSearchCtl.abort(), 8000); // не ждём вечно
      try {
        const remote = await offSearch(q, foodSearchCtl.signal);
        clearTimeout(killer);
        if (input.value.trim().toLowerCase() !== q) return; // запрос устарел
        const seen = new Set(local.map((f) => f.n.toLowerCase()));
        const merged = [...local, ...remote.filter((r) => !seen.has(r.n.toLowerCase()))].slice(0, 30);
        renderList(merged, merged.length > local.length ? "Справочник + Open Food Facts" : "Из справочника");
      } catch (e) {
        clearTimeout(killer);
        if (e.name === "AbortError") return;
        renderList(local, "Open Food Facts недоступен — показываю справочник.");
      }
    }, 350);
  };
}

export function openPortion(food, date, editIndex) {
  if (!food) return;
  const editing = editIndex != null;
  const drink = !!food.drink;
  const per = { k: food.k, p: food.p, f: food.f, cb: food.cb, fb: food.fb || 0 };
  const waterFrac = Math.max(0, Math.min(1, 1 - ((per.p + per.f + per.cb) / 100)));
  const hy = food.hy || (drink ? 0.9 : 0);
  let unit = food.unit || (drink ? "мл" : "г");
  const startAmt = food.amt != null ? food.amt : (editing && food.g != null ? food.g : 100);

  const step = () => (unit === "мл" ? 25 : 10);
  const chipsFor = () => (unit === "мл" ? [200, 250, 330, 500] : [50, 100, 150, 200, 250]);

  const o = document.createElement("div");
  o.className = "overlay portion-overlay";
  o.innerHTML = portionView({ editing, food, per, startAmt, unit });
  overlayRoot.appendChild(o);

  const gInput = o.querySelector("#portion-g");
  const chipsBox = o.querySelector("#p-chips");
  const preview = o.querySelector("#p-preview");
  const unitEl = o.querySelector("#p-unit");
  const getAmt = () => Math.max(0, parseFloat(("" + gInput.value).replace(",", ".")) || 0);

  function drawChips() {
    chipsBox.innerHTML = portionChipsView({ chips: chipsFor(), unit });
    chipsBox.querySelectorAll(".pchip").forEach((c) => c.onclick = () => { gInput.value = c.dataset.g; upd(); });
  }
  function upd() {
    const a = getAmt(), m = a / 100;
    const wml = drink ? Math.round(a * waterFrac * hy) : 0;
    o.querySelectorAll(".ut").forEach((b) => b.classList.toggle("on", b.dataset.u === unit));
    unitEl.textContent = unit;
    preview.innerHTML = portionPreviewView({ m, per, wml });
  }
  o.querySelectorAll(".ut").forEach((b) => b.onclick = () => { unit = b.dataset.u; drawChips(); upd(); gInput.focus(); });
  o.querySelector("#p-minus").onclick = () => { gInput.value = Math.max(0, Math.round((getAmt() - step()) * 10) / 10); upd(); };
  o.querySelector("#p-plus").onclick = () => { gInput.value = Math.round((getAmt() + step()) * 10) / 10; upd(); };
  gInput.oninput = upd;
  o.querySelector("#portion-cancel").onclick = () => o.remove();
  o.querySelector("#portion-add").onclick = () => {
    const a = getAmt();
    if (a <= 0) { gInput.focus(); return; }
    const rec = { n: food.n, g: a, amt: a, unit, k: per.k, p: per.p, f: per.f, cb: per.cb, fb: per.fb, src: food.src, drink: food.drink, hy: food.hy };
    const d = nutDay(date);
    if (editing) d.items[editIndex] = rec;
    else {
      d.items.push(rec);
      pushRecent({ id: food.id || ("man" + food.n), src: food.src, n: food.n, k: per.k, p: per.p, f: per.f, cb: per.cb, fb: per.fb, drink: food.drink, hy: food.hy });
    }
    save(); o.remove(); render(); checkAchievements({ type: "nutrition" });
  };
  drawChips(); upd();
  setTimeout(() => gInput.select(), 50);
}
