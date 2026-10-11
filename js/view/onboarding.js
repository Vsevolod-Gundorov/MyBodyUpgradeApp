// Вид: мастер профиля — знакомство при первом запуске и правка из профиля.
//
// Как у лучших фитнес- и медицинских приложений (Fitbod, Noom, Apple Health, Flo):
//   • один вопрос на экран и короткий заголовок вместо абзацев;
//   • крупные плитки с картинками: выбор — одним касанием, и сразу следующий вопрос;
//   • числа — ползунком и кнопками ±, без клавиатуры; разумные значения уже стоят;
//   • в знакомстве только то, без чего не посчитать план. Программа питания, темп
//     и стартовые веса стоят по умолчанию и меняются на экране плана или в профиле;
//   • в конце — «вот ваш план» крупными цифрами.
import {
  ACTIVITY, ACTIVITY_ORDER, DIRECTIONS, DIRECTION_ORDER, EXPERIENCE, EXPERIENCE_ORDER,
  LIFTS, LIMITS, PACES, PROGRAMS, PROGRAM_ORDER, SEXES,
} from "../../data/profile.js";
import { FEMALE, MALE, levelBars } from "../../data/onboarding-art.js";
import { LIFT_NAMES } from "../../data/program.js";
import { NUT_ACCENT, NUT_GRAD } from "./components.js";
import { esc, fmt } from "../core/format.js";
import { icon } from "./icons.js";

const BACK = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4l-8 8 8 8V4z"/></svg>';

/** Шаги первого знакомства. Остальные (food) открываются только правкой из профиля. */
export const STEPS = ["sex", "body", "goal", "activity", "experience", "plan"];
/** Шаги, где выбор одним касанием сразу ведёт дальше. */
export const AUTO_STEPS = new Set(["sex", "goal", "activity", "experience"]);
const TITLES = {
  sex: "Ваш пол",
  body: "Ваши параметры",
  goal: "Ваша цель",
  activity: "Как проходит ваш день?",
  experience: "Опыт в зале",
  food: "Питание",
  plan: "Ваш план готов",
};
const SUBS = { activity: "Без учёта тренировок", plan: "Всё можно поменять в профиле" };

// коротко — то, что видно на плитках; длинные описания остаются в data/profile.js
const GOAL_ICON = { cut: "flame", maintain: "on-target", recomp: "cycle", bulk: "biceps" };
const STEPS_TXT = { sedentary: "до 5 тыс. шагов", light: "5–8 тыс. шагов", moderate: "8–12 тыс. шагов", active: "12+ тыс. шагов" };
const ACT_SHORT = { sedentary: "Сижу почти весь день", light: "Немного хожу", moderate: "Много на ногах", active: "Физическая работа" };
const EXP_TXT = { novice: "меньше 6 месяцев", beginner: "6 месяцев – 2 года", intermediate: "2–5 лет", advanced: "больше 5 лет" };
const PROGRAM_ICON = { balanced: "meal", protein: "steak", lowcarb: "avocado", keto: "flame", custom: "notebook" };

const seg = (group, items, cur) => `<div class="ob-seg" role="group">${items.map(([id, name]) =>
  `<button class="ob-seg-b ${id === cur ? "on" : ""}" data-group="${group}" data-value="${id}" aria-pressed="${id === cur}">${name}</button>`).join("")}</div>`;
const tile = (group, id, on, art, name, note = "", cls = "") => `
  <button class="ob-tile ${cls} ${on ? "on" : ""}" data-group="${group}" data-value="${id}" aria-pressed="${on}">
    <span class="ob-tile-art">${art}</span>
    <span class="ob-tile-t"><b>${name}</b>${note ? `<i>${note}</i>` : ""}</span>
  </button>`;
const num = (id, label, val, unit, ph = "") => `
  <label class="ob-field"><span>${label}</span>
    <span class="ob-input"><input id="${id}" inputmode="decimal" value="${val ?? ""}" placeholder="${ph}" autocomplete="off" />${unit ? `<i>${unit}</i>` : ""}</span>
  </label>`;

/**
 * Каркас мастера. steps — шаги этого прохода, quick — правка одного пункта из профиля.
 * Кнопка внизу нужна там, где ответ — число или несколько полей; на плитках выбор
 * одним касанием и так ведёт дальше (кнопка появляется, только если ответ уже есть).
 */
export function wizardView({ step, steps = STEPS, editing, quick = false, answered = false }) {
  const i = steps.indexOf(step);
  const first = quick || i === 0;
  const auto = !quick && AUTO_STEPS.has(step);
  return `
    <div class="ob-head">
      ${editing || i > 0 ? `<button class="fs-close" id="ob-back" aria-label="${first ? "Закрыть" : "Назад"}">${first ? icon("close") : BACK}</button>` : `<span class="ob-head-pad"></span>`}
      ${quick ? `<span class="ob-quick-t">Профиль</span>` : `<div class="ob-progress" aria-label="Шаг ${i + 1} из ${steps.length}">${steps.map((s, k) => `<i class="${k <= i ? "on" : ""}"></i>`).join("")}</div>`}
      ${editing && !first ? `<button class="fs-close" id="ob-close" aria-label="Закрыть">${icon("close")}</button>` : `<span class="ob-head-pad"></span>`}
    </div>
    <div class="ob-body ob-step-${step}" id="ob-body">
      <h2 class="ob-title">${TITLES[step]}</h2>
      ${SUBS[step] ? `<p class="ob-sub">${SUBS[step]}</p>` : ""}
      <div id="ob-step"></div>
      <div class="ob-error" id="ob-error" role="alert"></div>
    </div>
    <div class="ob-foot" ${auto && !answered ? "hidden" : ""}>
      <button class="finish-btn" id="ob-next">${quick || (step === "plan" && editing) ? "Сохранить" : step === "plan" ? "Начать" : "Далее"}</button>
    </div>`;
}

/** Пол — две фигуры. Имени нет в Telegram (обычный браузер) — спросим тут же. */
export function sexStepView(f, { askName = false } = {}) {
  return `
    ${askName ? `<label class="ob-field"><span>Как к вам обращаться</span><span class="ob-input"><input id="ob-name" value="${esc(f.name || "")}" maxlength="40" autocomplete="given-name" /></span></label>` : ""}
    <div class="ob-sex">
      ${tile("sex", "m", f.sex === "m", MALE, "Мужчина", "", "ob-tile-big")}
      ${tile("sex", "f", f.sex === "f", FEMALE, "Женщина", "", "ob-tile-big")}
    </div>`;
}

/** Ползунок с крупным числом и кнопками ±: без клавиатуры, но точно. */
const ruler = (id, ic, label, val, unit, [lo, hi], step) => `
  <div class="ob-ruler">
    <div class="ob-ruler-h"><span class="ob-ruler-ico">${icon(ic)}</span><span>${label}</span></div>
    <div class="ob-ruler-v">
      <button class="ob-pm" data-pm="${id}" data-d="-${step}" aria-label="${label}: меньше">−</button>
      <output class="mono" id="${id}-out" for="${id}"><b>${fmt(val)}</b><i>${unit}</i></output>
      <button class="ob-pm" data-pm="${id}" data-d="${step}" aria-label="${label}: больше">+</button>
    </div>
    <input type="range" id="${id}" min="${lo}" max="${hi}" step="${step}" value="${val}" aria-label="${label}" />
  </div>`;

/** Тело: возраст, рост, вес — три ползунка с уже выставленными значениями. Имя — при правке. */
export function bodyStepView(f, { withName = false, withSex = false } = {}) {
  return `
    ${withName ? `<label class="ob-field"><span>Имя</span><span class="ob-input"><input id="ob-name" value="${esc(f.name || "")}" maxlength="40" autocomplete="given-name" /></span></label>` : ""}
    ${withSex ? `<div class="ob-field"><span>Пол</span>${seg("sex", Object.entries(SEXES), f.sex)}</div>` : ""}
    ${ruler("ob-age", "calendar", "Возраст", f.age, "лет", LIMITS.age, 1)}
    ${ruler("ob-height", "stairs", "Рост", f.height, "см", LIMITS.height, 1)}
    ${ruler("ob-weight", "weight-scale", "Вес", f.weight, "кг", LIMITS.weight, 0.5)}`;
}

export function goalStepView(f, { showPace = false } = {}) {
  const paces = PACES[f.direction];
  return `
    <div class="ob-grid-tiles">${DIRECTION_ORDER.map((id) => tile("direction", id, f.direction === id, icon(GOAL_ICON[id]), DIRECTIONS[id].name)).join("")}</div>
    ${showPace && paces ? `<div class="ob-field ob-pace"><span>Темп</span>${seg("pace", paces.map((p) => [p.id, `${p.name}<small>${f.direction === "cut" ? "−" : "+"}${String(p.kg).replace(".", ",")} кг/нед</small>`]), f.pace)}</div>` : ""}`;
}

export function activityStepView(f) {
  return `<div class="ob-list-tiles">${ACTIVITY_ORDER.map((id, i) => tile("activity", id, f.activity === id, levelBars(i + 1), ACT_SHORT[id], STEPS_TXT[id], "ob-tile-row")).join("")}</div>`;
}

export function experienceStepView(f, { edit = false, hasJournal = false } = {}) {
  return `
    <div class="ob-list-tiles">${EXPERIENCE_ORDER.map((id, i) => tile("experience", id, f.experience === id, levelBars(i + 1), EXPERIENCE[id].name, EXP_TXT[id], "ob-tile-row")).join("")}</div>
    ${edit ? maxesBlock(f, hasJournal) : ""}`;
}

/** Свои результаты в базовых движениях — только при правке из профиля. */
function maxesBlock(f, hasJournal) {
  return `
    ${hasJournal && !f.knowMaxes ? `<p class="ob-note">Рабочие веса уже идут по журналу тренировок.</p>` : ""}
    <button class="toggle-row ob-know" id="ob-know" aria-pressed="${!!f.knowMaxes}"><span>Знаю свои результаты в базовых движениях</span><span class="tg ${f.knowMaxes ? "on" : ""}"><i></i></span></button>
    ${f.knowMaxes ? `<div class="ob-lifts">${LIFTS.map((l) => `
      <div class="ob-lift">
        <span class="ob-lift-n">${LIFT_NAMES[l]}</span>
        <span class="ob-input sm"><input id="ob-w-${l}" inputmode="decimal" value="${(f.sets[l] && f.sets[l].w) || ""}" placeholder="вес" aria-label="${LIFT_NAMES[l]}: вес" /><i>кг</i></span>
        <span class="ob-x">×</span>
        <span class="ob-input sm"><input id="ob-r-${l}" inputmode="numeric" value="${(f.sets[l] && f.sets[l].r) || ""}" placeholder="повт." aria-label="${LIFT_NAMES[l]}: повторы" /></span>
      </div>`).join("")}
      <p class="ob-note">Лучший недавний подход, например 80 × 5. Пустые — оценим сами.</p></div>` : ""}`;
}

/** Программа питания — правка из профиля: плитки, у «Своей» — белок и жиры. */
export function foodStepView(f) {
  return `
    <div class="ob-grid-tiles">${PROGRAM_ORDER.map((id) => tile("program", id, f.program === id, icon(PROGRAM_ICON[id]), PROGRAMS[id].name)).join("")}</div>
    ${f.program === "custom" ? `<div class="ob-grid2">
      ${num("ob-cp", "Белок", f.custom.protein, "г/кг", "2")}
      ${num("ob-cf", "Жиры", f.custom.fat, "г/кг", "0,9")}
    </div>` : ""}
    <div class="ob-label">Образ жизни</div>
    <div class="ob-list-tiles">${ACTIVITY_ORDER.map((id, i) => tile("activity", id, f.activity === id, levelBars(i + 1), ACT_SHORT[id], STEPS_TXT[id], "ob-tile-row")).join("")}</div>`;
}

/**
 * План: калории крупно, БЖУ полосками — сразу видно, что получилось.
 * Программу питания и темп можно поменять тут же: цифры пересчитываются на глазах.
 */
export function planStepView({ f, t, maxes, maxesNote }) {
  const MAC = [["protein", "Белки", "steak"], ["fat", "Жиры", "avocado"], ["carbs", "Углеводы", "wheat"]];
  const day = (name, d, on) => {
    const sum = d.protein * 4 + d.fat * 9 + d.carbs * 4 || 1;
    return `
      <div class="ob-plan-day ${on ? "on" : ""}">
        <span class="ob-plan-n">${name}</span>
        <b class="mono">${d.kcal}</b><i>ккал</i>
        <span class="ob-plan-bar">${MAC.map(([k]) => `<i style="width:${((d[k] * (k === "fat" ? 9 : 4)) / sum * 100).toFixed(1)}%;background:${NUT_GRAD[k]}"></i>`).join("")}</span>
        <span class="ob-plan-m">${MAC.map(([k, n, ic]) => `<span><span class="ob-plan-ico" style="color:${NUT_ACCENT[k]}">${icon(ic)}</span><em>${n}</em><b class="mono">${d[k]}</b><small>г</small></span>`).join("")}</span>
      </div>`;
  };
  const pace = t.expectedKgPerWeek;
  const paces = PACES[f.direction];
  return `
    <div class="ob-plan-goal">
      <span class="ob-plan-gi">${icon(GOAL_ICON[f.direction])}</span>
      <span><b>${DIRECTIONS[f.direction].name}</b>${pace ? `<i class="mono">${pace > 0 ? "+" : "−"}${String(Math.abs(pace)).replace(".", ",")} кг в неделю</i>` : ""}</span>
    </div>
    ${t.capped ? `<div class="ob-note ob-capped">Темп снижен до безопасного.</div>` : ""}
    <div class="ob-plan-days">${day("Тренировка", t.training, true)}${day("Отдых", t.rest, false)}</div>
    ${paces ? `<div class="ob-label">Темп</div>${seg("pace", paces.map((p) => [p.id, p.name]), f.pace)}` : ""}
    <div class="ob-label">Питание</div>
    <div class="ob-chips">${PROGRAM_ORDER.filter((id) => id !== "custom").map((id) => `<button class="ob-chip ${f.program === id ? "on" : ""}" data-group="program" data-value="${id}" aria-pressed="${f.program === id}">${icon(PROGRAM_ICON[id])}<span>${PROGRAMS[id].name}</span></button>`).join("")}</div>
    <div class="ob-plan-max"><span class="ob-label">Стартовые веса${maxesNote ? ` · ${maxesNote}` : ""}</span>
      <span class="ob-plan-max-r">${LIFTS.map((l) => `<span>${LIFT_NAMES[l]} <b class="mono">${fmt(maxes[l])}</b></span>`).join("")}</span></div>`;
}

export const OB_ERRORS = {
  sex: "Выберите пол", age: "Возраст — от 14 до 90 лет", height: "Рост — от 130 до 230 см", weight: "Вес — от 35 до 250 кг",
  direction: "Выберите цель", program: "Выберите программу питания", activity: "Выберите образ жизни",
  custom_protein: "Белок — от 0,8 до 3,5 г на кг", custom_fat: "Жиры — от 0,4 до 2,5 г на кг", experience: "Выберите уровень подготовки",
  name: "Как к вам обращаться?",
};

/** Панель профиля «Цели и нормы». */
export function goalsPanelView({ p, tTrain, tRest, adjustHint }) {
  if (!p) return `
    <div class="panel goals-panel">
      <div class="gp-empty"><b>Заполните профиль</b><span class="dim small">Нормы питания и стартовые веса посчитаются под вас.</span></div>
      <button class="finish-btn" id="goals-edit" style="margin-top:12px">Заполнить</button>
    </div>`;
  return `
    <div class="panel goals-panel">
      <div class="panel-head"><span class="eyebrow">Нормы на день · ${DIRECTIONS[p.direction].name.toLowerCase()}</span><span class="gp-actions"><button class="link-btn" id="goals-nut">Настроить</button></span></div>
      <div class="gp-days">
        <div><span class="dim small">Тренировка</span><b class="mono">${tTrain.kcal}</b><span class="dim small mono">Б ${tTrain.protein} · Ж ${tTrain.fat} · У ${tTrain.carbs}</span></div>
        <div><span class="dim small">Отдых</span><b class="mono">${tRest.kcal}</b><span class="dim small mono">Б ${tRest.protein} · Ж ${tRest.fat} · У ${tRest.carbs}</span></div>
      </div>
      ${tTrain.manual || tRest.manual ? `<div class="dim small">Нормы заданы вручную</div>` : ""}
      ${adjustHint || ""}
    </div>`;
}
