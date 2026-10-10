// Вид: настройка питания — цель, темп, программа, ручные нормы, сверка с весом.
import { DIRECTIONS, DIRECTION_ORDER, PACES, PROGRAMS, PROGRAM_ORDER } from "../../data/profile.js";
import { fmt } from "../core/format.js";
import { icon } from "./icons.js";

const SHORT_DIR = { cut: "Снизить", maintain: "Держать", recomp: "Рекомп.", bulk: "Набрать" };
const kg = (v) => String(Math.abs(v)).replace(".", ",");

const seg = (group, items, cur) => `<div class="ob-seg" role="group">${items.map(([id, name]) =>
  `<button class="ob-seg-b ${id === cur ? "on" : ""}" data-group="${group}" data-value="${id}" aria-pressed="${id === cur}">${name}</button>`).join("")}</div>`;

export function nutPlanView({ f, t, manual, suggestion, adjust }) {
  const paces = PACES[f.direction];
  const dayCard = (key, name) => {
    const d = t[key], m = manual[key];
    return `
      <div class="np-day ${m ? "manual" : ""}" data-day="${key}">
        <div class="np-day-h"><b>${name}</b><span class="mono np-kcal" id="np-kcal-${key}">${m ? m.kcal : d.kcal}</span><span class="dim small">ккал</span></div>
        ${m ? `<div class="np-inputs">
            ${["protein", "fat", "carbs"].map((k) => `<label class="np-in"><span>${{ protein: "Б", fat: "Ж", carbs: "У" }[k]}</span><input id="np-${key}-${k}" inputmode="decimal" value="${m[k]}" aria-label="${name}: ${{ protein: "белки", fat: "жиры", carbs: "углеводы" }[k]}, г" /></label>`).join("")}
          </div>`
        : `<div class="ob-macros mono"><span>Б ${d.protein}</span><span>Ж ${d.fat}</span><span>У ${d.carbs}</span></div>`}
      </div>`;
  };
  return `
    <div class="ob-head">
      <button class="fs-close" id="np-close" aria-label="Закрыть">${icon("close")}</button>
      <div class="np-title">Питание</div>
      <span class="ob-head-pad"></span>
    </div>
    <div class="ob-body">
      <div class="ob-label" style="margin-top:4px">Цель</div>
      ${seg("direction", DIRECTION_ORDER.map((id) => [id, SHORT_DIR[id]]), f.direction)}
      <p class="ob-note">${DIRECTIONS[f.direction].note}</p>
      ${paces ? `<div class="ob-label">Темп</div>${seg("pace", paces.map((p) => [p.id, `${p.name}<small>${f.direction === "cut" ? "−" : "+"}${kg(p.kg)} кг/нед</small>`]), f.pace)}` : ""}

      <div class="ob-label">Программа</div>
      <div class="np-programs">${PROGRAM_ORDER.map((id) => `<button class="fs-meal ${f.program === id ? "on" : ""}" data-group="program" data-value="${id}" aria-pressed="${f.program === id}">${PROGRAMS[id].name}</button>`).join("")}</div>
      <p class="ob-note">${PROGRAMS[f.program].note}</p>
      ${f.program === "custom" ? `<div class="ob-grid2">
        <label class="ob-field"><span>Белок</span><span class="ob-input"><input id="np-cp" inputmode="decimal" value="${f.custom.protein}" /><i>г/кг</i></span></label>
        <label class="ob-field"><span>Жиры</span><span class="ob-input"><input id="np-cf" inputmode="decimal" value="${f.custom.fat}" /><i>г/кг</i></span></label>
      </div>` : ""}

      ${suggestion ? `<div class="np-adjust">
        <b>${suggestion.kcal < 0 ? "Вес идёт медленнее плана" : "Вес идёт быстрее плана"}</b>
        <span>За 3 недели: ${suggestion.actual > 0 ? "+" : "−"}${kg(suggestion.actual)} кг/нед, по плану ${suggestion.planned > 0 ? "+" : suggestion.planned < 0 ? "−" : ""}${kg(suggestion.planned)}. Предлагаю ${suggestion.kcal > 0 ? "прибавить" : "убрать"} ${Math.abs(suggestion.kcal)} ккал в день.</span>
        <div class="np-adjust-b"><button class="btn-ghost" id="np-adj-no">Не сейчас</button><button class="finish-btn" id="np-adj-yes" style="margin-top:0">Применить</button></div>
      </div>` : ""}
      ${adjust ? `<p class="ob-note">Учтена поправка по весу: ${adjust > 0 ? "+" : "−"}${Math.abs(adjust)} ккал/день. <button class="link-btn" id="np-adj-reset">Сбросить</button></p>` : ""}

      <div class="ob-label">Нормы на день</div>
      <div class="ob-days">${dayCard("training", "Тренировка")}${dayCard("rest", "Отдых")}</div>
      <button class="toggle-row ob-know" id="np-manual" aria-pressed="${!!(manual.training || manual.rest)}"><span>Задать БЖУ вручную</span><span class="tg ${manual.training || manual.rest ? "on" : ""}"><i></i></span></button>
      <p class="ob-note">${manual.training || manual.rest ? "Калории считаются по БЖУ: белки и углеводы — 4 ккал/г, жиры — 9." : `Вода: ${fmt(t.rest.water / 1000)}–${fmt(t.training.water / 1000)} л · клетчатка от ${t.rest.fiber} г.`}</p>
      <div class="ob-error" id="np-error" role="alert"></div>
    </div>
    <div class="ob-foot"><button class="finish-btn" id="np-save">Сохранить</button></div>`;
}

/** Подсказка на экране питания: вес расходится с планом. */
export const adjustHintView = (s) => !s ? "" : `
  <div class="np-hint">
    <span>${s.kcal < 0 ? "Вес меняется медленнее плана." : "Вес меняется быстрее плана."} ${s.kcal > 0 ? "Добавить" : "Убрать"} ${Math.abs(s.kcal)} ккал в день?</span>
    <button class="link-btn" id="adj-open">Подробнее</button>
  </div>`;
