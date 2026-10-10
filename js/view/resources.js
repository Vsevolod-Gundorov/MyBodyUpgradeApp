// Вид: питание. Только разметка: данные приходят готовыми из контроллера.
// Всё, что могло прийти извне (названия продуктов из Open Food Facts, каталога,
// своих продуктов), выводится только через esc().
import { NUTRITION } from "../../data/nutrition.js";
import { WD, addDays, dateLabel, esc, fmt, today } from "../core/format.js";
import { MEALS } from "../model/foods.js";
import { gaugeState, itemWaterMl } from "../model/nutrition.js";
import { S } from "../model/store.js";
import { L } from "../model/theme.js";
import { NUT_ACCENT, NUT_GRAD } from "./components.js";
import { icon } from "./icons.js";

const per100Line = (f) => `${Math.round(f.k)} ккал · Б ${fmt(f.p)} · Ж ${fmt(f.f)} · У ${fmt(f.cb)}`;
const unitOf = (f) => (f.drink ? "мл" : "г");

/* ================= экран дня ================= */
export function resourcesView({ date, isToday, strip, summary, extras, meals, tip }) {
  return `
    <div class="daynav">
      <button class="dn-arrow" id="day-prev" aria-label="Прошлый день"><svg viewBox="0 0 24 24"><path d="M15 4l-8 8 8 8V4z"/></svg></button>
      <div class="dn-label">${dateLabel(date)}${isToday ? ' <span class="dn-today">сегодня</span>' : ""}</div>
      <button class="dn-arrow" id="day-next" aria-label="Следующий день" ${isToday ? "disabled" : ""}><svg viewBox="0 0 24 24"><path d="M9 4l8 8-8 8V4z"/></svg></button>
    </div>
    <div class="weekstrip">${strip}</div>
    ${!isToday ? `<button class="today-btn" id="day-today">← К сегодняшнему дню</button>` : ""}
    ${summary}
    ${extras}
    <div class="meals">${meals}</div>
    ${tip}`;
}

/** Сводка: сколько калорий осталось и три макроса — главное, ради чего открывают вкладку. */
export function summaryView({ T, tot, dayType, verdict, canPlan = false, hint = "" }) {
  const R = 46, C = 2 * Math.PI * R;
  const pct = T.kcal ? tot.k / T.kcal : 0;
  const left = Math.round(T.kcal - tot.k);
  const over = left < 0;
  const macro = (key, name, cur, tgt) => {
    const st = gaugeState(tgt ? cur / tgt : 0, key === "protein" ? "protein" : key);
    return `
      <div class="ns-m ${st}">
        <div class="ns-m-top"><span>${name}</span><span class="mono">${Math.round(cur)}<i>/${tgt}</i></span></div>
        <div class="ns-bar"><i style="width:${Math.min(100, (tgt ? cur / tgt : 0) * 100).toFixed(0)}%;background:${NUT_GRAD[key]}"></i></div>
      </div>`;
  };
  return `
    <section class="panel nut-sum">
      <div class="ns-top">
        <div class="ns-ring ${over ? "over" : ""}">
          <svg viewBox="0 0 108 108" aria-hidden="true">
            <circle cx="54" cy="54" r="${R}" class="ns-track"/>
            <circle cx="54" cy="54" r="${R}" class="ns-arc" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - Math.min(1, pct))).toFixed(1)}"/>
          </svg>
          <div class="ns-center"><b class="mono">${Math.abs(left)}</b><span>${over ? "сверх" : "осталось"}</span></div>
        </div>
        <div class="ns-macros">
          ${macro("protein", "Белки", tot.p, T.protein)}
          ${macro("fat", "Жиры", tot.f, T.fat)}
          ${macro("carbs", "Углеводы", tot.cb, T.carbs)}
        </div>
      </div>
      <div class="ns-foot">
        <span class="ns-of"><span class="mono dim">${Math.round(tot.k)} из ${T.kcal} ккал</span>${canPlan ? `<button class="link-btn" id="np-open">Нормы</button>` : ""}</span>
        <div class="ns-dt" role="group" aria-label="Тип дня">
          <button class="dt ${dayType === "training" ? "on" : ""}" data-dt="training" aria-pressed="${dayType === "training"}">Тренировка</button>
          <button class="dt ${dayType === "rest" ? "on" : ""}" data-dt="rest" aria-pressed="${dayType === "rest"}">Отдых</button>
        </div>
      </div>
      ${verdict ? `<div class="fuel-verdict ${verdict.cls}">${verdict.text}</div>` : ""}
      ${hint}
    </section>`;
}

/** Клетчатка и вода — по строке, вода с кнопками стакана. */
export function extrasView({ fb, fbTgt, totalWater, waterTgt, drinkWater }) {
  const fbPct = Math.min(100, (fb / fbTgt) * 100);
  const wPct = Math.min(100, (totalWater / waterTgt) * 100);
  return `
    <section class="panel nut-extra">
      <div class="nx-row">
        <span class="nx-name" style="color:${NUT_ACCENT.fiber}">${icon("leaf")}<b>Клетчатка</b></span>
        <div class="ns-bar"><i style="width:${fbPct.toFixed(0)}%;background:${NUT_GRAD.fiber}"></i></div>
        <span class="nx-val mono">${Math.round(fb)}<i>/${fbTgt} г</i></span>
      </div>
      <div class="nx-row">
        <span class="nx-name" style="color:#7fc7d6">${icon("droplet")}<b>Вода</b></span>
        <div class="ns-bar"><i class="water" style="width:${wPct.toFixed(0)}%"></i></div>
        <span class="nx-val mono">${fmt(totalWater / 1000)}<i>/${fmt(waterTgt / 1000)} л</i></span>
      </div>
      <div class="nx-water">
        <span class="dim small mono">${drinkWater ? `из напитков ${drinkWater} мл` : "стакан — 250 мл"}</span>
        <button class="nx-btn" id="water-minus" aria-label="Убрать стакан воды">−</button>
        <button class="nx-btn add" id="water-plus" aria-label="Добавить стакан воды">+ стакан</button>
      </div>
    </section>`;
}

/** Приёмы пищи: шапка с калориями и «+», под ней — записи. Касание записи — изменить. */
export function mealsView({ day, isToday, repeats = {} }) {
  const groups = MEALS.map((m) => ({ ...m, items: [] }));
  const other = { id: "other", name: "Без приёма", items: [] };
  day.items.forEach((it, i) => (groups.find((g) => g.id === it.meal) || other).items.push({ it, i }));
  if (other.items.length) groups.push(other);
  const kcal = (items) => Math.round(items.reduce((a, { it }) => a + it.k * it.g / 100, 0));
  const anyFood = day.items.length > 0;
  return groups.map((g) => `
    <section class="meal" data-meal="${g.id}">
      <div class="meal-head">
        <span class="mh-name">${g.name}</span>
        <span class="mh-kcal mono">${g.items.length ? `${kcal(g.items)} ккал` : ""}</span>
        ${g.id === "other" ? "" : `<button class="mh-add" data-add="${g.id}" aria-label="Добавить: ${g.name.toLowerCase()}">+</button>`}
      </div>
      ${!g.items.length && repeats[g.id] ? repeatBtnView(g.id, repeats[g.id]) : ""}
      ${g.items.map(({ it, i }) => {
        const wml = Math.round(itemWaterMl(it));
        const amt = it.amt != null ? it.amt : it.g;
        return `
        <button class="meal-item" data-i="${i}" aria-label="Изменить: ${esc(it.n)}">
          <span class="mi-body">
            <span class="mi-name">${esc(it.n)}</span>
            <span class="mi-sub mono">${fmt(amt)} ${esc(it.unit || "г")}${wml ? `<span class="water-badge">${icon("droplet")}${wml} мл</span>` : ""}</span>
          </span>
          <span class="mi-kcal mono">${Math.round(it.k * it.g / 100)}</span>
        </button>`;
      }).join("")}
    </section>`).join("") +
    (!anyFood ? `<div class="empty meals-empty">${isToday ? L("foodEmpty") : "В этот день ничего не записано."}</div>` : "");
}

/** «Как вчера»: повторить приём пищи с прошлого дня — с составом и калориями, чтобы было видно, что добавится. */
function repeatBtnView(meal, r) {
  const d = new Date(r.date + "T00:00:00Z");
  const when = r.daysAgo === 1 ? "Как вчера" : `Как в ${["вс", "пн", "вт", "ср", "чт", "пт", "сб"][d.getUTCDay()]}`;
  const names = r.items.slice(0, 2).map((it) => it.n.split(" · ")[0]).join(", ") + (r.items.length > 2 ? ` и ещё ${r.items.length - 2}` : "");
  return `<button class="meal-repeat" data-repeat="${meal}" data-from="${r.date}" aria-label="${when}: ${esc(names)}, ${r.kcal} ккал">
    <span class="mr-ico" aria-hidden="true">↻</span><span class="mr-body"><b>${when}</b><span class="mr-names">${esc(names)}</span></span><span class="mr-kcal mono">${r.kcal}</span></button>`;
}

/** Плашка снизу: что сделано и «Отменить». */
export const snackView = (text, undo = true) => `<span>${esc(text)}</span>${undo ? `<button class="ft-undo" id="snack-undo">Отменить</button>` : ""}`;

export function dayTipView({ T, day }) {
  return !L("dayTip") ? "" : day.dayType === "training"
    ? `<div class="nut-tip"><span class="dim small">⚔ Тренировочный день · за 2 ч до похода: ${NUTRITION.timing.pre.carbs.join("–")} г углеводов + ${NUTRITION.timing.pre.protein.join("–")} г белка · после: ${NUTRITION.timing.post.carbs.join("–")} г углеводов + ${NUTRITION.timing.post.protein.join("–")} г белка.</span></div>`
    : `<div class="nut-tip"><span class="dim small">☾ День отдыха · углеводы ровнее по приёмам, ужин легче. Белок держим ${T.protein} г.</span></div>`;
}

export function weekStripView({ date, winEnd }) {
  return Array.from({ length: 7 }, (_, i) => addDays(winEnd, -(6 - i))).map((iso) => {
    const d = new Date(iso + "T00:00:00Z");
    const rec = S.nutrition && S.nutrition.log[iso];
    const has = rec && (rec.items.length || rec.water > 0);
    const future = iso > today();
    return `<button class="cday ${iso === date ? "on" : ""} ${future ? "future" : ""}" data-d="${iso}" ${future ? "disabled" : ""}>
      <span class="cw">${WD[d.getUTCDay()]}</span><span class="cn">${d.getUTCDate()}</span>
      <span class="cdot ${has ? "has" : ""}"></span>
    </button>`;
  }).join("");
}

/* ================= экран добавления ================= */
export function foodSheetView({ meal }) {
  return `
    <div class="fs-head">
      <button class="fs-close" id="fs-close" aria-label="Закрыть">${icon("close")}</button>
      <div class="fs-meals" role="group" aria-label="Приём пищи">
        ${MEALS.map((m) => `<button class="fs-meal ${m.id === meal ? "on" : ""}" data-meal="${m.id}" aria-pressed="${m.id === meal}">${m.name}</button>`).join("")}
      </div>
    </div>
    <div class="fs-search-row">
      <label class="fs-search">${icon("search")}
        <input id="fs-q" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" placeholder="Найти продукт" aria-label="Найти продукт" />
      </label>
      <button class="fs-scan" id="fs-scan" aria-label="Сканировать штрихкод">${icon("barcode")}</button>
    </div>
    <div class="fs-tabs" id="fs-tabs" role="tablist">
      <button class="fs-tab" data-tab="recent" role="tab">Недавние</button>
      <button class="fs-tab" data-tab="frequent" role="tab">Частые</button>
      <button class="fs-tab" data-tab="mine" role="tab">Мои</button>
    </div>
    <div class="fs-list" id="fs-list"></div>
    <div class="fs-bottom">
      <div class="fs-toast" id="fs-toast" hidden></div>
      <button class="finish-btn fs-done" id="fs-done">Готово</button>
    </div>`;
}

/** Строка продукта: касание — порция, «+» — сразу обычную порцию. */
export function foodRowsView({ foods, portions }) {
  return foods.map((f) => {
    const pt = portions[f.id];
    return `
    <div class="fs-row" data-id="${esc(f.id)}">
      <button class="fs-main" data-open aria-label="Порция: ${esc(f.n)}">
        <span class="fs-name">${esc(f.n)}${f.src === "my" ? ` <span class="fs-tag">${f.recipe ? "блюдо" : "мой"}</span>` : ""}</span>
        <span class="fs-sub mono">${per100Line(f)} <i>/100 ${unitOf(f)}</i></span>
      </button>
      <button class="fs-add" data-quick aria-label="Добавить ${fmt(pt.amt)} ${pt.unit}"><b>+</b><span class="mono">${fmt(pt.amt)} ${pt.unit}</span></button>
    </div>`;
  }).join("");
}

export function foodListView({ rows, empty, status, create, dish = false, attribution }) {
  return `
    ${rows || (empty ? `<div class="empty fs-empty">${empty}</div>` : "")}
    ${status ? `<div class="fs-status dim small">${status}</div>` : ""}
    ${create || dish ? `<div class="fs-creates">${create ? `<button class="fs-create" id="fs-create">+ ${esc(create)}</button>` : ""}${dish ? `<button class="fs-create" id="fs-dish">+ Своё блюдо</button>` : ""}</div>` : ""}
    ${attribution ? `<div class="fs-attr dim">Часть данных — Open Food Facts, лицензия ODbL</div>` : ""}`;
}

export const toastView = ({ name, amt, unit }) =>
  `<span class="ft-text">${esc(name)} · ${fmt(amt)} ${esc(unit)}</span><button class="ft-undo" id="ft-undo">Отменить</button>`;

/* ================= порция ================= */
export function portionView({ editing, food, meal, amt, unit, chips }) {
  return `
    <div class="portion-card">
      <div class="portion-name display">${esc(food.n)}</div>
      <div class="dim small mono portion-per100">на 100 ${unitOf(food)}: ${per100Line(food)} · клетч ${fmt(food.fb || 0)}${food.fbEst ? "≈" : ""}</div>
      <div class="pt-meals" role="group" aria-label="Приём пищи">
        ${MEALS.map((m) => `<button class="fs-meal ${m.id === meal ? "on" : ""}" data-meal="${m.id}" aria-pressed="${m.id === meal}">${m.name}</button>`).join("")}
      </div>
      <div class="stepper">
        <button class="stp" id="p-minus" aria-label="Меньше">−</button>
        <div class="stp-mid"><input id="portion-g" inputmode="decimal" value="${amt}" aria-label="Количество" />
          <button class="stp-unit" id="p-unit" aria-label="Сменить единицу">${unit}</button></div>
        <button class="stp" id="p-plus" aria-label="Больше">+</button>
      </div>
      <div class="portion-chips" id="p-chips">${chips}</div>
      <div class="portion-preview" id="p-preview"></div>
      <div class="portion-actions ${editing ? "three" : ""}">
        ${editing ? `<button class="btn-ghost danger" id="portion-del">Удалить</button>` : ""}
        <button class="btn-ghost" id="portion-cancel">Отмена</button>
        <button class="finish-btn" id="portion-add" style="margin-top:0">${editing ? "Сохранить" : "Добавить"}</button>
      </div>
      ${food.src === "my" ? `<button class="pt-edit" id="pt-edit-food">Изменить продукт</button>` : ""}
    </div>`;
}

export const portionChipsView = ({ chips, unit, sv }) =>
  (sv ? `<button class="pchip sv" data-g="${sv}">порция · ${fmt(sv)} ${unit}</button>` : "") +
  chips.map((v) => `<button class="pchip" data-g="${v}">${v} ${unit}</button>`).join("");

export function portionPreviewView({ m, food, wml }) {
  const cell = (v, l, color) => `<div class="pv"><span class="pv-v mono" style="color:${color}">${v}</span><span class="pv-l">${l}</span></div>`;
  return cell(Math.round(food.k * m), "ккал", NUT_ACCENT.kcal) +
    cell(fmt(food.p * m), "белки", NUT_ACCENT.protein) +
    cell(fmt(food.f * m), "жиры", NUT_ACCENT.fat) +
    cell(fmt(food.cb * m), "углев.", NUT_ACCENT.carbs) +
    cell(fmt((food.fb || 0) * m), "клетч.", NUT_ACCENT.fiber) +
    (wml ? cell(wml, "вода, мл", "#7fc7d6") : "");
}

/* ================= свой продукт ================= */
export function customFoodView({ food, editing, code = "" }) {
  const v = (k) => (food && food[k] != null ? esc(String(food[k]).replace(".", ",")) : "");
  const field = (id, label, val, ph = "0") =>
    `<label class="cf-field"><span>${label}</span><input id="${id}" inputmode="decimal" value="${val}" placeholder="${ph}" autocomplete="off" /></label>`;
  return `
    <div class="portion-card cf-card">
      <div class="portion-name display">${editing ? "Изменить продукт" : "Свой продукт"}</div>
      ${code ? `<p class="dim small cf-code">Штрихкод <b class="mono">${esc(code)}</b> — в следующий раз продукт найдётся по нему сразу.</p>` : ""}
      <label class="cf-field cf-name"><span>Название</span><input id="cf-n" value="${food ? esc(food.n) : ""}" maxlength="120" autocomplete="off" placeholder="Например, сырники мамины" /></label>
      <div class="cf-per" role="group" aria-label="Значения указаны">
        <button class="fs-meal on" data-per="100">на 100 г</button>
        <button class="fs-meal" data-per="portion">на порцию</button>
        <label class="cf-portion" hidden><input id="cf-sv" inputmode="decimal" placeholder="вес" aria-label="Вес порции" /><span>г</span></label>
      </div>
      <div class="cf-grid">
        ${field("cf-k", "Ккал", v("k"), "по БЖУ")}
        ${field("cf-p", "Белки", v("p"))}
        ${field("cf-f", "Жиры", v("f"))}
        ${field("cf-cb", "Углеводы", v("cb"))}
        ${field("cf-fb", "Клетчатка", food && !food.fbEst ? v("fb") : "", "если есть")}
      </div>
      <button class="toggle-row cf-drink" id="cf-drink" aria-pressed="${!!(food && food.drink)}"><span>Напиток — считать воду</span><span class="tg ${food && food.drink ? "on" : ""}"><i></i></span></button>
      <div class="cf-preview mono small" id="cf-preview"></div>
      <div class="portion-actions ${editing ? "three" : ""}">
        ${editing ? `<button class="btn-ghost danger" id="cf-del">Удалить</button>` : ""}
        <button class="btn-ghost" id="cf-cancel">Отмена</button>
        <button class="finish-btn" id="cf-save" style="margin-top:0">Сохранить</button>
      </div>
    </div>`;
}

const CF_ERR = {
  no_name: "Введите название", name_too_long: "Слишком длинное название", bad_portion: "Укажите вес порции",
  bad_number: "Проверьте числа", no_values: "Введите калории или БЖУ",
  macros_over_100: "Белков, жиров и углеводов вместе не может быть больше 100 г на 100 г", kcal_over_900: "Больше 900 ккал на 100 г не бывает",
};
export function customPreviewView(res) {
  if (!res) return "";
  if (!res.ok) return `<span class="cf-err">${CF_ERR[res.error] || "Проверьте значения"}</span>`;
  const f = res.food;
  return `<span>На 100 ${unitOf(f)}: ${per100Line(f)} · клетч ${fmt(f.fb)}${f.fbEst ? "≈" : ""}</span>` +
    (res.warn.includes("kcal_mismatch") ? `<span class="cf-warn">Калории не сходятся с БЖУ — проверьте этикетку</span>` : "");
}

/* ================= своё блюдо ================= */
export function dishView({ dish, editing }) {
  return `
    <div class="ob-head">
      <button class="fs-close" id="dh-close" aria-label="Закрыть">${icon("close")}</button>
      <div class="np-title">${editing ? "Изменить блюдо" : "Своё блюдо"}</div>
      <span class="ob-head-pad"></span>
    </div>
    <div class="ob-body dish-body">
      <label class="cf-field cf-name"><span>Название</span><input id="dh-n" value="${esc(dish.n || "")}" maxlength="120" autocomplete="off" placeholder="Например, плов домашний" /></label>
      <div class="ob-label">Состав</div>
      <div id="dh-items"></div>
      <button class="fs-create" id="dh-add">+ Ингредиент</button>
      <div class="ob-grid2 dish-weights">
        <label class="ob-field"><span>Вес готового блюда</span><span class="ob-input"><input id="dh-total" inputmode="decimal" value="${dish.total || ""}" placeholder="сумма" /><i>г</i></span></label>
        <label class="ob-field"><span>Порция</span><span class="ob-input"><input id="dh-sv" inputmode="decimal" value="${dish.sv || ""}" placeholder="—" /><i>г</i></span></label>
      </div>
      <p class="ob-note">Вес готового блюда — если при варке вода ушла или крупа её впитала. Не знаете — оставьте пустым, посчитаем по сумме продуктов.</p>
      <div class="dish-preview" id="dh-preview" aria-live="polite"></div>
    </div>
    <div class="ob-foot portion-actions ${editing ? "three" : ""}">
      ${editing ? `<button class="btn-ghost danger" id="dh-del">Удалить</button>` : ""}
      <button class="btn-ghost" id="dh-cancel">Отмена</button>
      <button class="finish-btn" id="dh-save" style="margin-top:0">Сохранить</button>
    </div>`;
}

export function dishItemsView(items) {
  if (!items.length) return `<div class="empty dish-empty">Добавьте продукты, из которых готовите, — с весом в сыром виде.</div>`;
  return items.map((it, i) => `
    <div class="dish-row">
      <span class="dr-name">${esc(it.n)}<span class="dim small mono">${Math.round((it.k * (it.g || 0)) / 100)} ккал</span></span>
      <span class="ob-input dr-g"><input data-g="${i}" inputmode="decimal" value="${it.g ? String(it.g).replace(".", ",") : ""}" aria-label="Вес: ${esc(it.n)}" /><i>г</i></span>
      <button class="wh-del" data-del="${i}" aria-label="Убрать ${esc(it.n)}">✕</button>
    </div>`).join("");
}

const DISH_ERR = { no_name: "Введите название", no_items: "Добавьте хотя бы один продукт с весом", too_many: "Не больше 40 продуктов", bad_total: "Вес готового блюда не сходится с составом" };
export function dishPreviewView(res, sv) {
  if (!res) return "";
  if (!res.ok) return `<span class="cf-err">${DISH_ERR[res.error] || CF_ERR[res.error] || "Проверьте значения"}</span>`;
  const f = res.food, t = res.totals;
  return `
    <div class="dp-row"><span>На 100 г</span><b class="mono">${per100Line(f)} · клетч ${fmt(f.fb)}</b></div>
    ${sv > 0 ? `<div class="dp-row"><span>Порция ${fmt(sv)} г</span><b class="mono">${Math.round((f.k * sv) / 100)} ккал · Б ${fmt((f.p * sv) / 100)} · Ж ${fmt((f.f * sv) / 100)} · У ${fmt((f.cb * sv) / 100)}</b></div>` : ""}
    <div class="dp-row dim"><span>Всё блюдо · ${fmt(t.weight)} г</span><b class="mono">${Math.round(t.k)} ккал</b></div>`;
}

export function ingredientPickerView() {
  return `
    <div class="fs-head">
      <button class="fs-close" id="ip-close" aria-label="Закрыть">${icon("close")}</button>
      <div class="np-title">Ингредиент</div>
    </div>
    <label class="fs-search">${icon("search")}
      <input id="ip-q" type="search" inputmode="search" autocomplete="off" placeholder="Найти продукт" aria-label="Найти продукт" />
    </label>
    <div class="fs-list" id="ip-list"></div>`;
}

export function ingredientRowsView(foods) {
  return foods.length ? foods.map((f) => `
    <button class="fs-row ip-row" data-id="${esc(f.id)}">
      <span class="fs-main"><span class="fs-name">${esc(f.n)}</span><span class="fs-sub mono">${per100Line(f)} <i>/100 ${unitOf(f)}</i></span></span>
      <span class="fs-add"><b>+</b></span>
    </button>`).join("") : `<div class="empty fs-empty">Ничего не нашлось. Сначала заведите продукт через «Свой продукт».</div>`;
}
