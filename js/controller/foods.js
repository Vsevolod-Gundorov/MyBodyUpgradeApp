// Контроллер: экран добавления продуктов, порция и свой продукт.
//
// Как в лучших дневниках питания: «+» у приёма пищи → поиск со списками «Недавние /
// Частые / Мои»; «+» у продукта добавляет обычную порцию сразу (с «Отменить»),
// касание продукта — точная порция. Не нашли — свой продукт с этикетки.
import { render } from "./router.js";
import { checkAchievements } from "../model/achievements.js";
import {
  MEAL_IDS, OFF_MIN_CHARS, OFF_PAUSE_MS, addFood, deleteCustomFood, dishOf, frequentFoods, itemOf, localSearch,
  mealByTime, mergeFoods, myFoods, norm, recentFoods, saveCustomFood, saveDish, searchOff, serverSearch, usualPortion,
} from "../model/foods.js";
import { openScanner } from "./scanner.js";
import { nutDay } from "../model/nutrition.js";
import { per100 } from "../../data/nutrition.js";
import { save } from "../model/store.js";
import { overlayRoot } from "../view/dom.js";
import { fxTap } from "../view/fx.js";
import {
  customFoodView, customPreviewView, dishItemsView, dishPreviewView, dishView, foodListView, foodRowsView, foodSheetView,
  ingredientPickerView, ingredientRowsView, portionChipsView, portionPreviewView, portionView, toastView,
} from "../view/resources.js";

const SERVER_PAUSE_MS = 250;

/* ================= экран добавления ================= */
export function openFoodSheet(date, meal = mealByTime()) {
  let curMeal = MEAL_IDS.includes(meal) ? meal : mealByTime();
  let tab = recentFoods(1).length ? "recent" : "mine";
  let added = 0;
  let seq = 0, serverTimer = null, offTimer = null, ctl = null, toastTimer = null;
  let shown = [];                                     // что сейчас в списке — по id

  const o = document.createElement("div");
  o.className = "overlay food-sheet";
  o.setAttribute("role", "dialog");
  o.setAttribute("aria-label", "Добавить продукт");
  o.innerHTML = foodSheetView({ meal: curMeal });
  overlayRoot.appendChild(o);
  const input = o.querySelector("#fs-q");
  const list = o.querySelector("#fs-list");
  const tabs = o.querySelector("#fs-tabs");
  const toast = o.querySelector("#fs-toast");
  const done = o.querySelector("#fs-done");

  const close = () => { abort(); clearTimeout(toastTimer); o.remove(); render(); if (added) checkAchievements({ type: "nutrition" }); };
  const abort = () => { clearTimeout(serverTimer); clearTimeout(offTimer); if (ctl) ctl.abort(); ctl = null; };

  function drawList(foods, { empty = "", status = "", create = "", dish = false, attribution = false } = {}) {
    shown = foods;
    const portions = {};
    foods.forEach((f) => (portions[f.id] = usualPortion(f)));
    list.innerHTML = foodListView({ rows: foodRowsView({ foods, portions }), empty, status, create, dish, attribution });
    list.querySelectorAll(".fs-row").forEach((row) => {
      const food = shown.find((f) => f.id === row.dataset.id);
      row.querySelector("[data-open]").onclick = () => openPortion(food, date, { meal: curMeal, onDone: afterAdd });
      row.querySelector("[data-quick]").onclick = () => quickAdd(food);
    });
    const createBtn = list.querySelector("#fs-create");
    if (createBtn) createBtn.onclick = () => openCustomFood(null, { name: input.value.trim(), onSaved: (f) => openPortion(f, date, { meal: curMeal, onDone: afterAdd }) });
    const dishBtn = list.querySelector("#fs-dish");
    if (dishBtn) dishBtn.onclick = () => openDish(null, { onSaved: (f) => openPortion(f, date, { meal: curMeal, onDone: afterAdd }) });
  }

  function showTab() {
    tabs.hidden = false;
    tabs.querySelectorAll(".fs-tab").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
    if (tab === "recent") drawList(recentFoods(), { empty: "Здесь появятся продукты, которые вы добавляли.", create: "Свой продукт", dish: true });
    else if (tab === "frequent") drawList(frequentFoods(), { empty: "Здесь будет то, что вы едите чаще всего.", create: "Свой продукт", dish: true });
    else drawList(myFoods(), { empty: "Своих продуктов и блюд пока нет. Продукт вводится с этикетки, блюдо собирается из продуктов.", create: "Свой продукт", dish: true });
  }

  /** Поиск: своё — сразу, каталог сервера — после короткой паузы, OFF — после длинной или по Enter. */
  function search(now = false) {
    abort();
    const q = input.value.trim();
    if (!q) { showTab(); return; }
    tabs.hidden = true;
    const my = ++seq;
    const local = localSearch(q);
    let server = [], off = [];
    const offOk = norm(q).length >= OFF_MIN_CHARS;
    let offStatus = offOk ? "Ищу…" : "";           // состояние внешнего поиска — не теряется при перерисовке
    const paint = (status = offStatus) => {
      if (my !== seq) return;
      const all = mergeFoods(local, server, off).slice(0, 40);
      drawList(all, {
        empty: status ? "" : "Ничего не нашлось.",
        status, create: q ? `Создать «${q.length > 24 ? q.slice(0, 24) + "…" : q}»` : "Свой продукт",
        attribution: all.some((f) => f.src === "off"),
      });
    };
    paint();
    ctl = new AbortController();
    const signal = ctl.signal;

    serverTimer = setTimeout(async () => {
      try { server = await serverSearch(q, signal); } catch (e) { return; }
      paint();
    }, now ? 0 : SERVER_PAUSE_MS);

    if (!offOk) return;
    offTimer = setTimeout(async () => {
      let r;
      try { r = await searchOff(q, signal); } catch (e) {
        if (e && e.name === "AbortError") return;
        offStatus = "Open Food Facts не ответил — показываю найденное у нас."; paint(); return;
      }
      if (r.limited) offStatus = `Внешний поиск отдыхает — ещё ${r.waitSec} с. Потом нажмите «Найти».`;
      else { offStatus = ""; if (r.foods) off = r.foods; }
      paint();
    }, now ? 0 : OFF_PAUSE_MS);
  }

  function showToast(food, portion, index) {
    toast.innerHTML = toastView({ name: food.n, ...portion });
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast.hidden = true), 4000);
    toast.querySelector("#ft-undo").onclick = () => {
      const items = nutDay(date).items;
      if (items[index] && items[index].n === food.n) { items.splice(index, 1); added--; save(); }
      toast.hidden = true; updateDone();
    };
  }
  const updateDone = () => { done.textContent = added > 0 ? `Готово · ${added}` : "Готово"; };

  function quickAdd(food) {
    const portion = { ...usualPortion(food), meal: curMeal };
    const index = addFood(date, food, portion);
    added++; save(); fxTap(); updateDone();
    showToast(food, portion, index);
    if (!input.value.trim()) showTab();
  }
  function afterAdd(food, portion, index) {
    added++; updateDone(); showToast(food, portion, index);
    if (!input.value.trim()) showTab();
  }

  // события
  o.querySelectorAll(".fs-head .fs-meal").forEach((b) => b.onclick = () => {
    curMeal = b.dataset.meal;
    o.querySelectorAll(".fs-head .fs-meal").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); });
  });
  tabs.querySelectorAll(".fs-tab").forEach((b) => b.onclick = () => { tab = b.dataset.tab; showTab(); });
  input.oninput = () => search(false);
  input.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); search(true); input.blur(); } };
  o.querySelector("#fs-close").onclick = close;
  done.onclick = close;
  // сканер: найденный товар — сразу на экран порции; не найденный — свой продукт с этим штрихкодом
  o.querySelector("#fs-scan").onclick = () => { fxTap(); openScanner({
    onFound: (food) => openPortion(food, date, { meal: curMeal, onDone: afterAdd }),
    onCreate: (code) => openCustomFood(null, { code, onSaved: (f) => openPortion(f, date, { meal: curMeal, onDone: afterAdd }) }),
  }); };

  showTab();
  setTimeout(() => input.focus(), 60);
  return o;
}

/* ================= порция ================= */
/**
 * @param opts.editIndex — изменить запись дня, иначе добавить новую
 * @param opts.onDone(food, portion, index) — после добавления (экран поиска остаётся открытым)
 */
export function openPortion(food, date, opts = {}) {
  if (!food) return;
  const editing = opts.editIndex != null;
  const drink = !!food.drink;
  const start = editing ? { amt: opts.amt, unit: opts.unit } : usualPortion(food);
  let unit = start.unit || (drink ? "мл" : "г");
  let meal = opts.meal || mealByTime();
  const waterFrac = Math.max(0, Math.min(1, 1 - ((food.p + food.f + food.cb) / 100)));
  const hy = food.hy || (drink ? 0.9 : 0);
  const step = () => (unit === "мл" ? 25 : 10);
  // стандартные порции — без той, что уже стоит «порцией с упаковки»
  const chipsFor = () => (unit === "мл" ? [200, 250, 330, 500] : [50, 100, 150, 200]).filter((v) => v !== food.sv);

  const o = document.createElement("div");
  o.className = "overlay portion-overlay";
  o.innerHTML = portionView({ editing, food, meal, amt: start.amt, unit, chips: portionChipsView({ chips: chipsFor(), unit, sv: food.sv }) });
  overlayRoot.appendChild(o);
  const gInput = o.querySelector("#portion-g");
  const getAmt = () => Math.max(0, parseFloat(String(gInput.value).replace(",", ".")) || 0);

  function drawChips() {
    const box = o.querySelector("#p-chips");
    box.innerHTML = portionChipsView({ chips: chipsFor(), unit, sv: food.sv });
    box.querySelectorAll(".pchip").forEach((c) => c.onclick = () => { gInput.value = c.dataset.g; upd(); });
  }
  function upd() {
    const a = getAmt();
    o.querySelector("#p-unit").textContent = unit;
    o.querySelector("#p-preview").innerHTML = portionPreviewView({ m: a / 100, food, wml: drink ? Math.round(a * waterFrac * hy) : 0 });
  }
  o.querySelector("#p-unit").onclick = () => { unit = unit === "г" ? "мл" : "г"; drawChips(); upd(); };
  o.querySelectorAll(".pt-meals .fs-meal").forEach((b) => b.onclick = () => {
    meal = b.dataset.meal;
    o.querySelectorAll(".pt-meals .fs-meal").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); });
  });
  o.querySelector("#p-minus").onclick = () => { gInput.value = Math.max(0, Math.round((getAmt() - step()) * 10) / 10); upd(); };
  o.querySelector("#p-plus").onclick = () => { gInput.value = Math.round((getAmt() + step()) * 10) / 10; upd(); };
  gInput.oninput = upd;
  o.querySelector("#portion-cancel").onclick = () => o.remove();
  o.addEventListener("click", (e) => { if (e.target === o) o.remove(); });

  const del = o.querySelector("#portion-del");
  if (del) del.onclick = () => { nutDay(date).items.splice(opts.editIndex, 1); save(); o.remove(); render(); };
  const editFood = o.querySelector("#pt-edit-food");
  if (editFood) editFood.onclick = () => { o.remove(); openCustomFood(food, { onSaved: (f) => openPortion(f, date, opts) }); };

  o.querySelector("#portion-add").onclick = () => {
    const amt = getAmt();
    if (amt <= 0) { gInput.focus(); return; }
    const portion = { amt, unit, meal };
    if (editing) {
      nutDay(date).items[opts.editIndex] = itemOf(food, portion);
      save(); o.remove(); render(); return;
    }
    const index = addFood(date, food, portion);
    save(); o.remove(); fxTap();
    if (opts.onDone) opts.onDone(food, portion, index);
    else { render(); checkAchievements({ type: "nutrition" }); }
  };
  drawChips(); upd();
  setTimeout(() => gInput.select(), 50);
}

/* ================= свой продукт ================= */
export function openCustomFood(food, { name = "", code = "", onSaved } = {}) {
  if (food && food.recipe) return openDish(food, { onSaved });   // блюдо правится в своём редакторе
  const editing = !!food;
  const barcode = code || (food && food.code) || "";
  let per = "100", drink = !!(food && food.drink);
  const o = document.createElement("div");
  o.className = "overlay portion-overlay";
  o.innerHTML = customFoodView({ food: food || (name ? { n: name } : null), editing, code: barcode });
  overlayRoot.appendChild(o);
  const $ = (id) => o.querySelector(id);
  const input = () => ({
    n: $("#cf-n").value, k: $("#cf-k").value.replace(",", "."), p: $("#cf-p").value.replace(",", ".") || 0,
    f: $("#cf-f").value.replace(",", ".") || 0, cb: $("#cf-cb").value.replace(",", ".") || 0,
    fb: $("#cf-fb").value.replace(",", ".") || undefined,
    per: per === "100" ? 100 : $("#cf-sv").value.replace(",", ".") || 0, drink, code: barcode || undefined,
  });
  const upd = () => {
    const raw = input();
    const empty = !raw.k && !+raw.p && !+raw.f && !+raw.cb;
    $("#cf-preview").innerHTML = empty || !raw.n.trim() ? "" : customPreviewView(per100(raw));
  };
  o.querySelectorAll("[data-per]").forEach((b) => b.onclick = () => {
    per = b.dataset.per;
    o.querySelectorAll("[data-per]").forEach((x) => x.classList.toggle("on", x === b));
    $(".cf-portion").hidden = per === "100";
    if (per !== "100") $("#cf-sv").focus();
    upd();
  });
  $("#cf-drink").onclick = () => { drink = !drink; $("#cf-drink .tg").classList.toggle("on", drink); $("#cf-drink").setAttribute("aria-pressed", drink); upd(); };
  o.querySelectorAll("input").forEach((i) => (i.oninput = upd));
  $("#cf-cancel").onclick = () => o.remove();
  const del = $("#cf-del");
  if (del) del.onclick = () => { deleteCustomFood(food.id); save(); o.remove(); render(); };
  $("#cf-save").onclick = () => {
    const res = saveCustomFood(input(), food && food.id);
    if (!res.ok) { $("#cf-preview").innerHTML = customPreviewView(res); return; }
    save(); fxTap(); o.remove();
    if (onSaved) onSaved(res.food); else render();
  };
  upd();
  setTimeout(() => (editing ? $("#cf-k") : $("#cf-n")).focus(), 60);
}

/* ================= своё блюдо ================= */
/**
 * Блюдо из продуктов: состав с весом в сыром виде, вес готового блюда, порция.
 * На 100 г считается сразу, клетчатка — по составу. Сохраняется как свой продукт
 * с составом: его можно найти, добавить порцией и потом поменять рецепт.
 */
export function openDish(food, { onSaved } = {}) {
  const editing = !!food;
  const dish = editing
    ? { n: food.n, items: (food.recipe.items || []).map((x) => ({ ...x })), total: food.recipe.total || "", sv: food.sv || "" }
    : { n: "", items: [], total: "", sv: "" };
  const o = document.createElement("div");
  o.className = "overlay food-sheet ob-sheet dish-sheet";
  o.setAttribute("role", "dialog");
  o.setAttribute("aria-label", "Своё блюдо");
  o.innerHTML = dishView({ dish, editing });
  overlayRoot.appendChild(o);
  const $ = (q) => o.querySelector(q);
  const num = (v) => { const n = parseFloat(String(v || "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
  const read = () => { dish.n = $("#dh-n").value; dish.total = num($("#dh-total").value); dish.sv = num($("#dh-sv").value); };
  const preview = () => { read(); $("#dh-preview").innerHTML = dish.items.length ? dishPreviewView(dishOf(dish), dish.sv) : ""; };
  const drawItems = () => {
    $("#dh-items").innerHTML = dishItemsView(dish.items);
    o.querySelectorAll("[data-g]").forEach((inp) => inp.oninput = () => {
      dish.items[+inp.dataset.g].g = num(inp.value);
      const kc = inp.closest(".dish-row").querySelector(".mono");
      const it = dish.items[+inp.dataset.g];
      if (kc) kc.textContent = `${Math.round((it.k * it.g) / 100)} ккал`;
      preview();
    });
    o.querySelectorAll("[data-del]").forEach((b) => b.onclick = () => { dish.items.splice(+b.dataset.del, 1); fxTap(); drawItems(); });
    preview();
  };
  $("#dh-add").onclick = () => openIngredientPicker((f) => {
    const pt = usualPortion(f);
    dish.items.push({ id: f.id, n: f.n, g: pt.unit === "г" || pt.unit === "мл" ? pt.amt : 100, k: f.k, p: f.p, f: f.f, cb: f.cb, fb: f.fb || 0 });
    drawItems();
    const last = o.querySelectorAll("[data-g]"); if (last.length) { last[last.length - 1].focus(); last[last.length - 1].select(); }
  });
  ["#dh-n", "#dh-total", "#dh-sv"].forEach((q) => ($(q).oninput = preview));
  const close = () => o.remove();
  $("#dh-close").onclick = close;
  $("#dh-cancel").onclick = close;
  const del = $("#dh-del");
  if (del) del.onclick = () => { deleteCustomFood(food.id); save(); close(); render(); };
  $("#dh-save").onclick = () => {
    read();
    const res = saveDish(dish, editing ? food.id : null);
    if (!res.ok) { $("#dh-preview").innerHTML = dishPreviewView(res); return; }
    save(); fxTap(); close();
    if (onSaved) onSaved(res.food); else render();
  };
  drawItems();
  setTimeout(() => (editing ? null : $("#dh-n").focus()), 60);
}

/** Выбор ингредиента: своё и справочник — сразу, каталог сервера — по паузе в наборе. */
function openIngredientPicker(onPick) {
  const o = document.createElement("div");
  o.className = "overlay food-sheet ip-sheet";
  o.setAttribute("role", "dialog");
  o.setAttribute("aria-label", "Ингредиент");
  o.innerHTML = ingredientPickerView();
  overlayRoot.appendChild(o);
  const input = o.querySelector("#ip-q"), list = o.querySelector("#ip-list");
  let timer = null, ctl = null, shown = [], seq = 0;
  const draw = (foods) => {
    shown = foods.slice(0, 40);
    list.innerHTML = ingredientRowsView(shown);
    list.querySelectorAll("[data-id]").forEach((b) => b.onclick = () => { const f = shown.find((x) => x.id === b.dataset.id); o.remove(); onPick(f); });
  };
  const run = () => {
    clearTimeout(timer); if (ctl) ctl.abort();
    const q = input.value.trim(), my = ++seq;
    if (!q) { draw(mergeFoods(myFoods().filter((f) => !f.recipe), recentFoods())); return; }
    const local = localSearch(q);
    draw(local);
    ctl = new AbortController();
    const signal = ctl.signal;
    timer = setTimeout(async () => {
      let server = [];
      try { server = await serverSearch(q, signal); } catch (e) { return; }
      if (my === seq) draw(mergeFoods(local, server));
    }, SERVER_PAUSE_MS);
  };
  input.oninput = run;
  o.querySelector("#ip-close").onclick = () => o.remove();
  run();
  setTimeout(() => input.focus(), 60);
}
