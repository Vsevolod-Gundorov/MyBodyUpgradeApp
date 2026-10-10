// Вид: cycle. Только разметка: данные приходят готовыми из контроллера.
import { PROGRAM, TYPE_NAMES, sessionLoad, weekProgress } from "../../data/program.js";
import { DELOAD } from "../../data/progression.js";
import { esc, fmtTonn, plural } from "../core/format.js";
import { ORDER } from "../model/catalog.js";
import { S } from "../model/store.js";
import { L, questName, themeNow } from "../model/theme.js";
import { workoutOf } from "../model/training.js";
import { num, vcls } from "./components.js";
import { icon } from "./icons.js";

export function cycleView({ LOAD_TXT, TONN, nextId, pickStart, startId, weekOpen }) {
  return `
    <div class="bar">
      <button class="pill-btn" id="open-pool">${icon("arsenal")}<span>${L("pool")}</span></button>
      <span class="bar-actions">
        <button class="icon-btn ${pickStart ? "on" : ""}" id="pick-start" aria-label="${L("questStart")}" title="${L("questStart")}">${icon("flag")}</button>
        <button class="icon-btn" id="cycle-help" aria-label="О цикле">${icon("help")}</button>
      </span>
    </div>
    ${PROGRAM.weeks.map((wk) => {
      const st = wk.workouts.filter((w) => w.type === "strength").length;
      const vol = wk.workouts.length - st;
      const pr = weekProgress(wk, S.sessions);
      const open = pickStart || weekOpen.has(wk.n);   // при выборе старта видны все квесты
      const tn = TONN[wk.n] || { kg: 0, sets: 0, delta: null };
      return `
      <div class="week-block ${open ? "open" : ""} ${wk.deload ? "deload" : ""}">
        <button class="week-head" data-week="${wk.n}" aria-expanded="${open}">
          <span class="week-title">
            <span class="week-n">Неделя ${wk.n}</span>${wk.saga && themeNow() !== "plain" ? `<span class="saga display">${wk.saga}</span>` : ""}
          </span>
          <span class="week-badges">
            ${open
              ? `${wk.deload ? `<span class="badge b-deload">разгрузка</span>` : ""}
                 ${st ? `<span class="badge b-str">${plural(st, "силовая", "силовых")}</span>` : ""}
                 ${vol ? `<span class="badge b-vol">${plural(vol, "объёмная", "объёмных")}</span>` : ""}`
              : `${wk.deload ? `<span class="badge b-deload">разгрузка</span>` : ""}
                 <span class="badge ${pr.complete ? "b-vol" : pr.done ? "b-plan" : "b-dim"}">${pr.done} из ${pr.total}</span>`}
            <span class="week-chev">${open ? "▾" : "▸"}</span>
          </span>
        </button>
        ${!open ? "" : `
        ${!tn.kg && themeNow() === "plain" ? "" : `
        <div class="week-tonn ${tn.kg ? "" : "empty"}" id="tonn-${wk.n}">
          ${tn.kg
            ? `<span class="tonn-val mono">${fmtTonn(tn.kg)}</span>
               <span class="tonn-lbl dim small">поднято · ${plural(tn.sets, "рабочий подход", "рабочих подходов")}</span>
               ${tn.delta == null ? "" : `<span class="tonn-delta ${tn.delta > 0 ? "up" : tn.delta < 0 ? "down" : ""}">${tn.delta > 0 ? "▲ +" : tn.delta < 0 ? "▼ " : "= "}${tn.delta}% <span class="dim">к неделе ${tn.vs}</span></span>`}`
            : `<span class="tonn-lbl dim small">нагрузка недели появится, когда закроешь ${L("firstQuest")}</span>`}
        </div>`}
        ${wk.workouts.map((w) => {
          const idx = ORDER.indexOf(w.id);
          const done = S.sessions.filter((s) => s.workoutId === w.id);
          const last = done[done.length - 1];
          const isNext = w.id === nextId;
          const isStart = w.id === startId;
          const built = workoutOf(w.id);
          const sl = built ? sessionLoad(built.exercises) : null;
          return `
          <div class="wcard-wrap">
            <button class="wcard ${last ? "done" : ""} ${isNext ? "next" : ""}" data-w="${w.id}">
              <span class="medallion">${icon(w.icon || "anvil")}</span>
              <span class="wcard-body">
                <span class="row1">
                  <span class="boss">${questName(w)}</span>
                  ${last ? `<span class="verdict-chip ${vcls(last.cls)} clickable" data-sid="${esc(last.id)}">${num(last.score)}% ›</span>` : ""}
                </span>
                <span class="badges">
                  ${isNext ? `<span class="badge b-next">${L("nextQuest")}</span>` : ""}
                  <span class="badge b-${w.type === "volume" ? "vol" : "str"}">${TYPE_NAMES[w.type]}</span>
                  <span class="badge">${built ? built.exercises.length : 0} упр</span>
                  ${sl && sl.level === "high" ? `<span class="badge b-load">${LOAD_TXT.high}</span>` : ""}
                </span>
              </span>
            </button>
            ${pickStart || isStart ? `<button class="wflag ${isStart ? "on" : ""}" data-i="${idx}" aria-label="Отметить стартом цикла"
              title="${isStart ? "Старт цикла" : "Сделать стартом цикла"}">${icon("flag")}</button>` : ""}
          </div>`;
        }).join("")}`}
      </div>`; }).join("")}`;
}

export function cycleHelpView() {
  return `<p>${L("programNote") || PROGRAM.note}</p>
      <div class="info-legend">
        <div><span class="badge b-str">силовая</span> тяжёлые веса, 4–8 повторов, запас в баке</div>
        <div><span class="badge b-vol">объёмная</span> больше повторов и подходов, ближе к отказу</div>
        <div><span class="badge b-load">тяжёлый</span> ${L("helpHeavy")}</div>
        <div><span class="badge b-next">${L("nextQuest")}</span> ${L("quest")}, которую движок предлагает закрыть</div>
        <div><span class="badge b-deload">разгрузка</span> пятая неделя: ${L("helpDeload")}, но вес −${Math.round((1 - DELOAD) * 100)}%. Усталость копится быстрее силы, и такая неделя возвращает свежесть до того, как она превратится в застой. Рабочий максимум разгрузка не двигает</div>
        <div><span class="tonn-val mono">12,4 т</span> недельный тоннаж: сумма вес × повторы по рабочим подходам, разминка не в счёт. Рядом — сравнение с прошлой неделей: по нему видно, растёт нагрузка или ты её уже не вывозишь</div>
        <div><span class="badge">⚑</span> ${L("helpStart")}</div>
      </div>`;
}
