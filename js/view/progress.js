// Вид: progress. Только разметка: данные приходят готовыми из контроллера.
import { exById } from "../../data/exercises.js";
import { LIFT_NAMES, SCHEME, archivedExName } from "../../data/program.js";
import { PROG, stateOf } from "../../data/progression.js";
import { fmt, fmtDate, plural3 } from "../core/format.js";
import { WORKOUTS } from "../model/catalog.js";
import { L, questName } from "../model/theme.js";
import { nextSlotFor, progressOf } from "../model/training.js";
import { runeSVG, sparkline } from "./components.js";

export function progressView({ anCards }) {
  return `
    ${L("logNote") ? `<p class="dim small" style="margin-top:2px">${L("logNote")}</p>` : ""}
    <div id="weight-card"></div>
    <svg width="0" height="0"><defs><linearGradient id="goldfade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c9a961" stop-opacity=".35"/><stop offset="1" stop-color="#c9a961" stop-opacity="0"/>
    </linearGradient></defs></svg>

    <div class="panel">
      <div class="eyebrow" style="margin-bottom:10px">Рабочие веса</div>
      <div class="limits">${anCards}</div>
      <details class="method">
        <summary>Как это считается</summary>
        <div class="method-body dim small">
          <p><b>Двойная прогрессия.</b> Вес в квесте стоит на месте, пока ты добираешь повторы. Закрыл все подходы по <b>верхней</b> границе повторов — в следующий раз тот же квест даёт <b>+один шаг снаряда</b> (штанга 2,5 кг, гантели 2 кг, тренажёр 5 кг). Не добрал <b>нижнюю</b> границу — шаг назад. Попал в коридор — вес держим.</p>
          <p><b>Рабочий вес</b> — вес на следующий раз: верх это цель подхода, низ — шаг назад, ниже опускаться незачем. Её же квест подставляет в подходы, поэтому в зале считать нечего.</p>
          <p><b>Личный максимум</b> — расчётный 1ПМ лучшего подхода за всю историю (среднее формул <b>Эпли</b> и <b>Бжицки</b>, повторы капаются на 10). Он живёт отдельно и вес в квесте не задаёт: рекорд одного удачного дня не должен задирать рабочую неделю.</p>
          <p>Схемы цикла чередуются, поэтому рабочий вес хранится как максимум на <b>эффективных повторах</b> (повторы плана плюс запас до отказа). Прибавка, взятая на объёмной неделе, не теряется на силовой.</p>
          <p><b>Объём и отдых</b> входят в расчёт: один подход на десять повторов и четыре таких подхода по полторы минуты отдыха — это разные веса. Каждый подход после первого стоит 2%, каждые полминуты недоотдыха до 2,5 минут — ещё 1,5%, глубже 18% поправка не идёт. Поэтому на объёмной неделе вес заметно легче силовой, хотя движение одно и то же.</p>
          <p><b>Застой</b> — ${PROG.STALL} квеста подряд без прибавки: пора делоад, смена движения или разбор сна и еды. Квест, отработанный заметно легче назначенного, рабочий вес не двигает вовсе.</p>
        </div>
      </details>
    </div>

    <div class="rune-divider">${runeSVG}</div>
    <div class="eyebrow" style="margin:2px 0 8px">Кривые роста</div>
    <div id="charts"></div>

    <div class="rune-divider">${runeSVG}</div>
    <div class="panel">
      <div class="eyebrow" style="margin-bottom:8px">${L("logLast")}</div>
      <div id="log"></div>
    </div>`;
}

export function liftCardView({ arr, d, k, last, pts }) {
  return `
      <div class="head">
        <b>${LIFT_NAMES[k]}</b>
        <span class="delta ${d > 0.5 ? "up" : "flat"} mono">${fmt(last)} кг ${d > 0.5 ? "▲ +" + fmt(d) : ""}</span>
      </div>
      ${arr.length ? sparkline(pts.map((p) => p.v)) : (L("logEmptyR") ? `<div class="empty">${L("logEmptyR")}</div>` : "")}`;
}

/** Тренд рабочего максимума словами и классом цвета. */
const arrow = (t) => t == null ? "—" : (t > 0.3 ? `▲ +${fmt(t)}%/мес` : (t < -0.3 ? `▼ ${fmt(t)}%/мес` : `≈ ${fmt(t)}%/мес`));
const tcls = (t) => t == null ? "flat" : (t > 0.3 ? "up" : (t < -0.3 ? "down" : "flat"));

export function limitCardsView({ keys }) {
  return keys.map((k) => {
    const src = exById(k);
    const slot = nextSlotFor(k);
    const ex = slot ? slot.ex : null;
    const p = ex ? ex.wp : progressOf(src, { reps: SCHEME.strength.acc.reps, rir: SCHEME.strength.acc.rir, sets: SCHEME.strength.acc.sets });
    const name = LIFT_NAMES[k] || (src ? src.name : archivedExName(k) || k);
    if (!p || !p.target) return `
      <div class="limit-card">
        <div class="lc-head"><b>${name}</b><span class="dim small">вес не считается</span></div>
        <div class="dim small">Движение идёт со своим весом или на время.</div>
      </div>`;
    const st = stateOf(p);
    const scheme = ex ? `${ex.sets} × ${ex.reps[0]}${ex.reps[1] !== ex.reps[0] ? "–" + ex.reps[1] : ""}` : null;
    const note = src && src.bw ? " довеском" : (src && src.perHand ? " на руку" : "");
    return `
      <div class="limit-card">
        <div class="lc-head"><b>${name}</b><span class="lc-status ${st.cls}">${st.text}</span></div>
        <div class="lc-grid">
          <div class="lc-cell">
            <span class="lc-l">Рабочий вес</span>
            <span class="lc-v mono">${fmt(p.target)}<i> кг${note}</i></span>
            <span class="lc-t ${p.trend != null ? tcls(p.trend) : (p.deltaKg > 0 ? "up" : p.deltaKg < 0 ? "down" : "flat")} mono">${
              p.trend != null ? arrow(p.trend) : (p.deltaKg ? `${p.deltaKg > 0 ? "▲ +" : "▼ "}${fmt(p.deltaKg)} кг` : "—")}</span>
          </div>
          <div class="lc-cell">
            <span class="lc-l">Максимум 1ПМ</span>
            <span class="lc-v mono">${p.oneRMBar > 0 ? fmt(p.oneRMBar) : "—"}<i> кг${note}</i></span>
            <span class="lc-t flat mono">${p.best ? `с ${fmt(p.best.w)} × ${p.best.r}` : "—"}</span>
          </div>
        </div>
        <div class="lc-target mono dim small">${slot
          ? `Следующий раз — ${questName(WORKOUTS[slot.wid]) || slot.boss}: ${scheme}, ставим ${fmt(p.target)} кг${note}${p.floor ? ` · пол ${fmt(p.floor)}` : ""}`
          : `В текущем цикле движения нет — вилка показана для схемы ${SCHEME.strength.acc.reps[0]}–${SCHEME.strength.acc.reps[1]}`}</div>
        <div class="lc-meta dim small">${p.last
          ? `${L("lastQuest")}: ${fmt(p.last.top)} × ${p.last.topReps} в ${plural3(p.last.sets, "подходе", "подходах", "подходах")} · ${plural3(p.sessions, L("quest"), L("questA"), L("questMany"))} в журнале`
          : "Журнал пока пуст — вес оценён от базовых лифтов"}</div>
      </div>`;
  }).join("") || `<div class="empty">${L("logEmptyW")}</div>`;
}

export function sessionLogView({ rows }) {
  return rows.length
    ? rows.map((s) => `<button class="log-row" data-sid="${s.id}">
        <span>${questName(WORKOUTS[s.workoutId]) || s.workoutId}</span>
        <span class="dim mono small">${fmtDate(s.date)}</span>
        <span class="${s.cls} mono">${s.score}% ›</span></button>`).join("")
    : `<div class="empty">${L("logEmpty")}</div>`;
}
