// Вид: мастер профиля — знакомство при первом запуске и правка из профиля.
// Пять коротких шагов, как у лучших приложений питания и тренировок: каждый — один
// вопрос на экран, крупные варианты вместо выпадающих списков, итог плана в конце.
import {
  ACTIVITY, ACTIVITY_ORDER, DIRECTIONS, DIRECTION_ORDER, EXPERIENCE, EXPERIENCE_ORDER,
  LIFTS, PACES, PROGRAMS, PROGRAM_ORDER, SEXES,
} from "../../data/profile.js";
import { LIFT_NAMES } from "../../data/program.js";
import { esc, fmt } from "../core/format.js";
import { icon } from "./icons.js";

const BACK = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4l-8 8 8 8V4z"/></svg>';
export const STEPS = ["about", "goal", "food", "training", "plan"];
const TITLES = {
  about: ["О вас", "Нужно для точного расчёта обмена веществ."],
  goal: ["Цель", "От неё зависит калорийность и темп."],
  food: ["Питание и образ жизни", "Как распределить белки, жиры и углеводы."],
  training: ["Опыт в зале", "Чтобы стартовые веса были вашими, а не чужими."],
  plan: ["Ваш план", "Его можно поменять в профиле в любой момент."],
};

const choice = (group, id, name, note, on) => `
  <button class="ob-choice ${on ? "on" : ""}" data-group="${group}" data-value="${id}" aria-pressed="${on}">
    <b>${name}</b>${note ? `<span>${note}</span>` : ""}
  </button>`;
const seg = (group, items, cur) => `<div class="ob-seg" role="group">${items.map(([id, name]) =>
  `<button class="ob-seg-b ${id === cur ? "on" : ""}" data-group="${group}" data-value="${id}" aria-pressed="${id === cur}">${name}</button>`).join("")}</div>`;
const num = (id, label, val, unit, ph = "") => `
  <label class="ob-field"><span>${label}</span>
    <span class="ob-input"><input id="${id}" inputmode="decimal" value="${val ?? ""}" placeholder="${ph}" autocomplete="off" />${unit ? `<i>${unit}</i>` : ""}</span>
  </label>`;

export function wizardView({ step, editing }) {
  const i = STEPS.indexOf(step);
  const [title, sub] = TITLES[step];
  return `
    <div class="ob-head">
      ${editing || i > 0 ? `<button class="fs-close" id="ob-back" aria-label="${i > 0 ? "Назад" : "Закрыть"}">${i > 0 ? BACK : icon("close")}</button>` : `<span class="ob-head-pad"></span>`}
      <div class="ob-progress" aria-label="Шаг ${i + 1} из ${STEPS.length}">${STEPS.map((s, k) => `<i class="${k <= i ? "on" : ""}"></i>`).join("")}</div>
      ${editing && i > 0 ? `<button class="fs-close" id="ob-close" aria-label="Закрыть">${icon("close")}</button>` : `<span class="ob-head-pad"></span>`}
    </div>
    <div class="ob-body" id="ob-body">
      <h2 class="ob-title">${title}</h2>
      <p class="ob-sub">${sub}</p>
      <div id="ob-step"></div>
      <div class="ob-error" id="ob-error" role="alert"></div>
    </div>
    <div class="ob-foot">
      <button class="finish-btn" id="ob-next">${step === "plan" ? (editing ? "Сохранить" : "Начать") : "Далее"}</button>
    </div>`;
}

export function aboutStepView(f) {
  return `
    <label class="ob-field"><span>Имя</span><span class="ob-input"><input id="ob-name" value="${esc(f.name || "")}" maxlength="40" autocomplete="given-name" /></span></label>
    <div class="ob-field"><span>Пол</span>${seg("sex", Object.entries(SEXES), f.sex)}</div>
    <div class="ob-grid3">
      ${num("ob-age", "Возраст", f.age, "лет")}
      ${num("ob-height", "Рост", f.height, "см")}
      ${num("ob-weight", "Вес", f.weight, "кг")}
    </div>`;
}

export function goalStepView(f) {
  const paces = PACES[f.direction];
  return `
    <div class="ob-choices">${DIRECTION_ORDER.map((id) => choice("direction", id, DIRECTIONS[id].name, DIRECTIONS[id].note, f.direction === id)).join("")}</div>
    ${paces ? `<div class="ob-field ob-pace"><span>Темп</span>${seg("pace", paces.map((p) => [p.id, `${p.name}<small>${f.direction === "cut" ? "−" : "+"}${String(p.kg).replace(".", ",")} кг/нед</small>`]), f.pace)}</div>` : ""}`;
}

export function foodStepView(f) {
  return `
    <div class="ob-label">Программа питания</div>
    <div class="ob-choices">${PROGRAM_ORDER.map((id) => choice("program", id, PROGRAMS[id].name, PROGRAMS[id].note, f.program === id)).join("")}</div>
    ${f.program === "custom" ? `<div class="ob-grid2">
      ${num("ob-cp", "Белок", f.custom.protein, "г/кг", "2")}
      ${num("ob-cf", "Жиры", f.custom.fat, "г/кг", "0,9")}
    </div>` : ""}
    <div class="ob-label">Образ жизни без учёта тренировок</div>
    <div class="ob-choices">${ACTIVITY_ORDER.map((id) => choice("activity", id, ACTIVITY[id].name, ACTIVITY[id].note, f.activity === id)).join("")}</div>`;
}

export function trainingStepView(f, { hasJournal, estimated }) {
  return `
    <div class="ob-choices">${EXPERIENCE_ORDER.map((id) => choice("experience", id, EXPERIENCE[id].name, EXPERIENCE[id].note, f.experience === id)).join("")}</div>
    ${hasJournal && !f.knowMaxes ? `<p class="ob-note">Рабочие веса уже идут по вашему журналу тренировок — стартовые оценки нужны только для движений, которых в нём ещё нет.</p>` : ""}
    <button class="toggle-row ob-know" id="ob-know" aria-pressed="${!!f.knowMaxes}"><span>Знаю свои результаты в базовых движениях</span><span class="tg ${f.knowMaxes ? "on" : ""}"><i></i></span></button>
    ${f.knowMaxes ? `<div class="ob-lifts">${LIFTS.map((l) => `
      <div class="ob-lift">
        <span class="ob-lift-n">${LIFT_NAMES[l]}</span>
        <span class="ob-input sm"><input id="ob-w-${l}" inputmode="decimal" value="${(f.sets[l] && f.sets[l].w) || ""}" placeholder="вес" aria-label="${LIFT_NAMES[l]}: вес" /><i>кг</i></span>
        <span class="ob-x">×</span>
        <span class="ob-input sm"><input id="ob-r-${l}" inputmode="numeric" value="${(f.sets[l] && f.sets[l].r) || ""}" placeholder="повт." aria-label="${LIFT_NAMES[l]}: повторы" /></span>
      </div>`).join("")}
      <p class="ob-note">Лучший недавний подход: например, 80 кг × 5. Можно заполнить не все — для остальных возьмём оценку.</p></div>`
    : (!hasJournal && estimated ? `<div class="ob-est"><span class="ob-label">Стартовая оценка 1ПМ</span>${LIFTS.map((l) => `<span class="ob-est-r"><span>${LIFT_NAMES[l]}</span><b class="mono">${fmt(estimated[l])} кг</b></span>`).join("")}<p class="ob-note">С запасом 10% — первые тренировки сами поднимут веса.</p></div>` : "")}`;
}

export function planStepView({ f, t, maxes, maxesNote }) {
  const day = (name, d) => `
    <div class="ob-day">
      <div class="ob-day-h"><b>${name}</b><span class="mono">${d.kcal} ккал</span></div>
      <div class="ob-macros mono"><span>Б ${d.protein}</span><span>Ж ${d.fat}</span><span>У ${d.carbs}</span></div>
      <div class="ob-day-f dim small">вода ${fmt(d.water / 1000)} л · клетч. ${d.fiber} г</div>
    </div>`;
  const pace = t.expectedKgPerWeek;
  return `
    <div class="ob-summary">
      <div class="ob-sum-row"><span>Цель</span><b>${DIRECTIONS[f.direction].name}${pace ? ` · ${pace > 0 ? "+" : "−"}${String(Math.abs(pace)).replace(".", ",")} кг/нед` : ""}</b></div>
      ${t.capped ? `<div class="ob-note ob-capped">Темп уменьшен до безопасного: ${f.direction === "cut" ? "дефицит больше 25% обмена бьёт по мышцам и самочувствию" : "профицит больше 15% уходит в жир"}.</div>` : ""}
      <div class="ob-sum-row"><span>Питание</span><b>${PROGRAMS[f.program].name}</b></div>
      <div class="ob-sum-row"><span>Обмен в покое</span><b class="mono">${t.bmr} ккал</b></div>
    </div>
    <div class="ob-days">${day("День тренировки", t.training)}${day("День отдыха", t.rest)}</div>
    <div class="ob-est"><span class="ob-label">Стартовые максимумы${maxesNote ? ` · ${maxesNote}` : ""}</span>
      ${LIFTS.map((l) => `<span class="ob-est-r"><span>${LIFT_NAMES[l]}</span><b class="mono">${fmt(maxes[l])} кг</b></span>`).join("")}</div>
    <p class="ob-note">Нормы — расчёт по формуле. Записывайте вес раз в несколько дней: через 2–3 недели приложение сверит его с целью и предложит точную поправку калорий.</p>`;
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
      <div class="panel-head"><span class="eyebrow">Цели и нормы</span><button class="link-btn" id="goals-edit">Изменить</button></div>
      <div class="gp-row"><span>${DIRECTIONS[p.direction].name}</span><span class="dim">${PROGRAMS[p.program].name}</span></div>
      <div class="gp-days">
        <div><span class="dim small">Тренировка</span><b class="mono">${tTrain.kcal}</b><span class="dim small mono">Б ${tTrain.protein} · Ж ${tTrain.fat} · У ${tTrain.carbs}</span></div>
        <div><span class="dim small">Отдых</span><b class="mono">${tRest.kcal}</b><span class="dim small mono">Б ${tRest.protein} · Ж ${tRest.fat} · У ${tRest.carbs}</span></div>
      </div>
      ${tTrain.manual || tRest.manual ? `<div class="dim small">Нормы заданы вручную</div>` : ""}
      ${adjustHint || ""}
    </div>`;
}
