// Вид: раздел «Растяжка» — главная программы и экран тренировки. Только разметка:
// данные приходят готовыми из контроллера. Тексты из программы проходят через esc.
import { PELVIC_FIND, PELVIC_SIGNS, PELVIC_STOP, STRETCH_CYCLE_WEEKS, STRETCH_METHODS, STRETCH_RULES, STRETCH_TESTS, doseParts } from "../../data/stretch.js";
import { esc } from "../core/format.js";
import { T } from "../model/settings.js";
import { blockHead } from "./components.js";
import { icon } from "./icons.js";

const BACK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4l-8 8 8 8V4z"/></svg>';
const LIFT_GEN = { squat: "приседа", deadlift: "становой", bench: "жима" };   // «не ближе 24 ч до …»
const TEST_ICON = { squat: "footprint", fold: "spine", split: "stairs", straddle: "mountain", wall: "wings", pelvic: "lotus" };
const SIGN = Object.fromEntries(PELVIC_SIGNS.map((p) => [p.s, p]));

const head = (title, extra = "") => `
  <div class="qstack">
    <div class="qhead">
      <button class="icon-btn" id="back" aria-label="${T("back")}">${BACK}</button>
      ${title}
      ${extra}
    </div>
  </div>`;

const row = (ico, label, value, attrs = "") => `
  <div class="sx-kv" ${attrs}><span class="pf-ico">${ico}</span><span class="sx-k">${label}</span><span class="sx-v">${value}</span></div>`;

/** Главная программы: неделя цикла, A | B, тазовое дно, тесты. */
export function stretchHomeView({ st, wk, done, workouts, clash, pf, testsNow, results }) {
  const fmtV = (t, r) => `${r.v} ${esc(t.unit)}`;
  return `
    ${head(`<h2 class="qhead-title display sx-qt">${T("stretch")}</h2>`,
      `<span class="badge">цикл ${st.cycle}</span>
       <button class="icon-btn" id="sx-help" aria-label="Как устроена программа">${icon("help")}</button>`)}

    <section class="panel sx-sec" aria-label="Неделя программы">
      ${blockHead(`Неделя ${wk.n} · ${esc(wk.name)}`)}
      <div class="sx-weeks" role="img" aria-label="Неделя ${wk.n} из ${STRETCH_CYCLE_WEEKS}">
        ${Array.from({ length: STRETCH_CYCLE_WEEKS }, (_, i) => i + 1).map((n) =>
          `<span class="sx-wk ${n < wk.n ? "past" : n === wk.n ? "on" : ""}">${n}</span>`).join("")}
      </div>
      ${row(icon("flame"), "Ощущение", esc(wk.feel))}
      ${row(icon("lightning"), "PAILs / RAILs", esc(wk.pails))}
      ${row(icon("lotus"), "Тазовое дно", esc(wk.pf))}
    </section>

    <section class="panel sx-sec" aria-label="Тренировки недели">
      ${blockHead("Тренировки", `<span class="badge ${done.size >= workouts.length ? "b-vol" : ""}">${done.size} из ${workouts.length}</span>`)}
      <div class="sx-tiles">
        ${workouts.map((w) => `
          <button class="sx-tile ${done.has(w.id) ? "done" : ""}" data-sw="${w.id}">
            <span class="sx-tile-ico">${icon(w.icon)}</span>
            <span class="sx-tile-t">${w.id} · ${esc(w.name)}</span>
            <span class="sx-tile-m mono">${w.min} мин · ${w.count} упр</span>
            <span class="sx-tile-s">${done.has(w.id) ? "✓ сделана" : w.marked ? `${w.marked} из ${w.count} ›` : "начать ›"}</span>
          </button>`).join("")}
      </div>
      ${workouts.filter((w) => clash[w.id] && clash[w.id].length && !done.has(w.id)).map((w) => `
        <div class="sx-warn">${icon("hourglass")}<span>${w.id} — не ближе 24 ч до ${clash[w.id].map((l) => LIFT_GEN[l]).join(" и ")}</span></div>`).join("")}
    </section>

    <section class="panel sx-sec" aria-label="Тазовое дно">
      ${blockHead("Тазовое дно", `<span class="sx-hd"><span class="badge">5 мин${pf.note ? ` · ${esc(pf.note)}` : ""}</span>
        <button class="pf-sq" id="sx-pf-help" aria-label="Как выполнять">${icon("help")}</button></span>`)}
      ${pf.items.map(([s, dose]) => row(`<b class="sx-sign">${s}</b>`, esc(SIGN[s] ? SIGN[s].name : ""), esc(dose))).join("")}
    </section>

    <section class="panel sx-sec" aria-label="Тесты">
      ${blockHead("Тесты", `<span class="badge ${testsNow ? "b-next" : "b-dim"}">${testsNow ? "эта неделя" : "недели 1 и 5"}</span>`)}
      ${STRETCH_TESTS.map((t) => {
        const r = results[t.id];
        const delta = r && r.delta ? `<i class="sx-d ${r.better ? "up" : "down"}">${r.delta > 0 ? "+" : "−"}${Math.abs(r.delta)}</i>` : "";
        return `
        <button class="sx-kv sx-test" data-test="${t.id}">
          <span class="pf-ico">${icon(TEST_ICON[t.id])}</span><span class="sx-k">${esc(t.name)}</span>
          <span class="sx-v">${r ? `${delta}<b>${fmtV(t, r)}</b>` : `<span class="dim">записать</span>`}</span>
          <span class="pf-chev" aria-hidden="true">›</span>
        </button>`;
      }).join("")}
    </section>`;
}

/** Экран тренировки: блоки, в строке — отметка, название с дозой недели, таймер позы. */
export function stretchWorkoutView({ w, week, marks, open }) {
  const total = w.blocks.reduce((n, b) => n + b.items.length, 0);
  return `
    ${head(`<span class="medallion medallion--sm">${icon(w.icon)}</span>
      <h2 class="qhead-title display sx-qt">${w.id} · ${esc(w.name)}</h2>`,
      `<span class="badge">неделя ${week}</span>`)}
    ${w.blocks.map((b) => `
      <section class="panel sx-sec" aria-label="${esc(b.name)}">
        ${blockHead(esc(b.name), `<span class="badge">${b.min} мин</span>`)}
        ${b.items.map((x) => {
          const on = marks.has(x.id), isOpen = open === x.id;
          const parts = doseParts(x.dose[week - 1]);
          const sec = x.sec ? x.sec[week - 1] : 0;
          return `
          <div class="sx-item ${on ? "on" : ""} ${isOpen ? "open" : ""}">
            <div class="sx-row">
              <button class="sx-chk" data-mark="${x.id}" aria-pressed="${on}" aria-label="${on ? "Снять отметку" : "Отметить сделанным"}">${on ? "✓" : ""}</button>
              <button class="sx-body" data-open="${x.id}" aria-expanded="${isOpen}">
                <span class="sx-name">${esc(x.name)}</span>
                <span class="sx-dose">${parts.map((p, i) => `<span class="sx-chip ${i ? "" : "main"}">${esc(p)}</span>`).join("")}${x.pf ? `<span class="sx-chip pf">${esc(x.pf)}</span>` : ""}</span>
              </button>
              ${sec ? `<button class="pf-sq sx-timer" data-hold="${x.id}" aria-label="Таймер ${sec} с">${icon("stopwatch")}</button>` : ""}
            </div>
            ${isOpen ? `
            <div class="sx-more">
              <p>${esc(x.cues)}</p>
              ${x.video ? `<button class="blk-link sx-video" data-video="${x.id}">▶ Видео техники</button>` : ""}
            </div>` : ""}
          </div>`;
        }).join("")}
      </section>`).join("")}
    <button class="finish-btn" id="sx-finish" ${marks.size ? "" : "disabled"}>Завершить · ${marks.size} из ${total}</button>`;
}

/** Справка по программе: методы и правила. */
export function stretchHelpView({ timingA, timingB }) {
  const list = (rows) => rows.map(([t, d]) => `<div><b>${esc(t)}</b> — ${esc(d)}</div>`).join("");
  return `
    <p>Две тренировки в неделю, цикл 5 недель: адаптация, объём, интенсивность, пик и разгрузка с тестами. Неделя засчитывается, когда сделаны обе тренировки. После разгрузки новый цикл начинается с недели 2.</p>
    <p><b>A</b> — ${esc(timingA)}. <b>B</b> — ${esc(timingB)}.</p>
    <div class="eyebrow" style="margin:10px 0 6px">Методы</div>
    <div class="info-legend">${list(STRETCH_METHODS)}</div>
    <div class="eyebrow" style="margin:10px 0 6px">Правила</div>
    <div class="info-legend">${list(STRETCH_RULES)}</div>`;
}

/** Справка по тазовому дну: как найти мышцы, что значат знаки, когда остановиться. */
export function pelvicHelpView() {
  return `
    <p>${esc(PELVIC_FIND)}</p>
    <div class="info-legend">${PELVIC_SIGNS.map((p) => `<div><b class="sx-sign">${p.s}</b> <b>${esc(p.name)}</b> — ${esc(p.how)}</div>`).join("")}</div>
    <p class="sx-stop">${esc(PELVIC_STOP)}</p>`;
}

/** Ввод результата теста: крупное число, кнопки ±. */
export function testInputView({ t, value }) {
  return `
    <p class="dim small" style="margin:0 0 4px">${esc(t.how)}</p>
    <p class="small" style="margin:0 0 12px">Цель: ${esc(t.goal)}</p>
    <div class="sx-step">
      <button class="pf-sq" id="sx-minus" aria-label="Меньше">−</button>
      <span class="sx-num"><b class="mono" id="sx-val">${value}</b><i>${esc(t.unit)}</i></span>
      <button class="pf-sq" id="sx-plus" aria-label="Больше">+</button>
    </div>
    <button class="finish-btn sx-save" id="sx-save">Сохранить</button>`;
}

/** Итог тренировки: что дальше по программе. */
export function stretchDoneText({ res, wk, newCycle }) {
  if (res.advanced) return `<p>Неделя засчитана. ${newCycle ? `Цикл ${res.cycle}, ` : "Дальше — "}неделя ${res.week} · ${esc(wk.name)}.</p>`;
  return res.left ? `<p>Осталась тренировка ${res.left} — после неё неделя засчитается.</p>` : "";
}
