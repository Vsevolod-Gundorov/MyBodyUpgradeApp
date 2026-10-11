// Вид: progress. Только разметка: данные приходят готовыми из контроллера.
import { EQUIP, exById } from "../../data/exercises.js";
import { exerciseIcon } from "../../data/icons-exercise.js";
import { EQUIP_ICON } from "../../data/icons-ui.js";
import { LIFT_NAMES, SCHEME, archivedExName } from "../../data/program.js";
import { PROG, stateOf } from "../../data/progression.js";
import { esc, fmt, fmtDate, plural3 } from "../core/format.js";
import { WORKOUTS } from "../model/catalog.js";
import { L, questName } from "../model/theme.js";
import { nextSlotFor, progressOf } from "../model/training.js";
import { num, sparkline, vcls } from "./components.js";
import { icon } from "./icons.js";

export function progressView() {
  return `
    ${L("logNote") ? `<p class="dim small" style="margin-top:2px">${L("logNote")}</p>` : ""}
    <div id="week-card"></div>
    <div id="weight-card"></div>
    <svg width="0" height="0" aria-hidden="true"><defs><linearGradient id="goldfade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c9a961" stop-opacity=".35"/><stop offset="1" stop-color="#c9a961" stop-opacity="0"/>
    </linearGradient></defs></svg>

    <div class="sec-head" style="margin:14px 2px 8px"><span class="eyebrow">Базовые движения · расчётный 1ПМ</span></div>
    <div id="charts" class="lift-grid"></div>

    <!-- рабочие веса устроены как каталог упражнений: заголовок со счётчиком,
         поиск, группы мышц отдельными плашками, строки со значком движения -->
    <section class="lr-cat" aria-label="Рабочие веса">
      <div class="lr-cat-head">
        <h2 class="lr-cat-title display">Рабочие веса</h2>
        <span class="badge" id="lr-count"></span>
        <button class="icon-btn" id="lr-how" aria-label="Как считаются рабочие веса">${icon("help")}</button>
      </div>
      <div class="search-bar lr-search">
        <span class="search-ico">${icon("search")}</span>
        <input class="search-input" id="lr-q" type="search" placeholder="Движение или мышца" autocomplete="off"
               autocorrect="off" spellcheck="false" aria-label="Поиск движения" />
      </div>
      <div id="lr-list"></div>
    </section>

    <section class="panel" aria-label="${L("logLast")}">
      <div class="eyebrow" style="margin-bottom:8px">${L("logLast")}</div>
      <div id="log"></div>
    </section>`;
}

/** Как считаются рабочие веса — справка по кнопке «?». */
export const progressHelpHTML = () => `
  <p><b>Двойная прогрессия.</b> Вес стоит на месте, пока ты добираешь повторы. Закрыл все подходы по <b>верхней</b> границе повторов — в следующий раз та же ${L("quest")} даёт <b>+один шаг снаряда</b> (штанга 2,5 кг, гантели 2 кг, тренажёр 5 кг). Не добрал <b>нижнюю</b> границу — шаг назад. Попал в коридор — вес держим.</p>
  <p><b>Рабочий вес</b> — вес на следующий раз. Его и подставляет ${L("quest")} в подходы, поэтому в зале считать нечего.</p>
  <p><b>Личный максимум</b> — расчётный 1ПМ лучшего подхода за всю историю (среднее формул <b>Эпли</b> и <b>Бжицки</b>, повторы капаются на 10). Он живёт отдельно и рабочий вес не задаёт: рекорд одного удачного дня не должен задирать рабочую неделю.</p>
  <p>Схемы цикла чередуются, поэтому рабочий вес хранится как максимум на <b>эффективных повторах</b> (повторы плана плюс запас до отказа). Прибавка, взятая на объёмной неделе, не теряется на силовой.</p>
  <p><b>Объём и отдых</b> входят в расчёт: каждый подход после первого стоит 2%, каждые полминуты недоотдыха до 3 минут — ещё 1,5%, глубже 18% поправка не идёт.</p>
  <p><b>Застой</b> — ${PROG.STALL} раза подряд без прибавки: пора делоад, смена движения или разбор сна и еды. Тренировка, отработанная заметно легче назначенного, рабочий вес не двигает вовсе.</p>`;

/* ---------------- итоги недели ---------------- */
const MON = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const dm = (iso) => { const d = new Date(iso + "T00:00:00Z"); return [d.getUTCDate(), MON[d.getUTCMonth()]]; };
export const weekLabel = (w) => {
  if (w.current) return "Эта неделя";
  const [d1, m1] = dm(w.start), [d2, m2] = dm(w.end);
  return m1 === m2 ? `${d1}–${d2} ${m2}` : `${d1} ${m1} – ${d2} ${m2}`;
};
const signed = (v, unit = "") => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${fmt(Math.abs(v))}${unit}`;
const tile = (v, label, cls = "", sub = "") => `<div class="wk-tile ${cls}"><b class="mono">${v}</b><span>${label}</span>${sub ? `<i class="mono">${sub}</i>` : ""}</div>`;

export function weekCardView({ w, canPrev, canNext, lastDate }) {
  const n = w.nutrition, done = w.sessions >= w.goal;
  const ton = w.tonnage ? `${fmt(w.tonnage / 1000)} т` : "—";
  const tDelta = w.tonnageDelta == null || !w.tonnage ? "" : `${w.tonnageDelta > 0 ? "▲" : w.tonnageDelta < 0 ? "▼" : "="} ${Math.abs(w.tonnageDelta)}%`;
  const nDays = w.days;   // в текущей неделе — сколько дней уже прошло
  return `
    <section class="panel wk-card" aria-label="Итоги недели">
      <div class="sec-head">
        <span class="eyebrow">Итоги недели</span>
        <span class="wk-nav">
          <button class="wk-arrow" id="wk-prev" ${canPrev ? "" : "disabled"} aria-label="Прошлая неделя">‹</button>
          <span class="wk-label">${weekLabel(w)}</span>
          <button class="wk-arrow" id="wk-next" ${canNext ? "" : "disabled"} aria-label="Следующая неделя">›</button>
        </span>
      </div>
      <div class="wk-grid">
        ${tile(`${w.sessions}<small>/${w.goal}</small>`, plural3(w.sessions, L("quest"), L("questA"), L("questMany")).replace(/^\d+\s/, ""), done ? "ok" : "")}
        ${tile(ton, "тоннаж", "", tDelta ? `<span class="${w.tonnageDelta > 0 ? "up" : w.tonnageDelta < 0 ? "down" : ""}">${tDelta}</span>` : "")}
        ${tile(w.prs.length || "—", plural3(w.prs.length, "рекорд", "рекорда", "рекордов").replace(/^\d+\s/, ""), w.prs.length ? "ok" : "")}
        ${tile(w.weight.change == null ? "—" : `${signed(w.weight.change)}<small> кг</small>`, "вес, тренд")}
        ${tile(n.logged ? `${n.protein}<small>/${nDays}</small>` : "—", "дней с белком", n.logged && n.protein >= Math.min(5, nDays) ? "ok" : "")}
        ${tile(n.logged ? `${n.kcal}<small>/${nDays}</small>` : "—", "дней в калориях", "", n.avgKcal ? `≈${n.avgKcal} ккал` : "")}
      </div>
      ${!w.sessions && !w.nutrition.logged && w.weight.change == null && lastDate ? `<div class="wk-prs dim small">Записей за неделю нет · последняя ${L("quest")} ${fmtDate(lastDate)}</div>` : ""}
      ${w.prs.length ? `<div class="wk-prs dim small">${w.prs.slice(0, 3).map((p) => `<span>${p.name} <b class="mono">${fmt(p.kg)} кг</b></span>`).join(" · ")}${w.prs.length > 3 ? ` · ещё ${w.prs.length - 3}` : ""}</div>` : ""}
    </section>`;
}

export function liftCardView({ arr, d, k, last, pts }) {
  return `
      <div class="head">
        <b>${LIFT_NAMES[k]}</b>
        <span class="delta ${d > 0.5 ? "up" : "flat"} mono">${fmt(last)}${d > 0.5 ? ` <small>▲ ${fmt(d)}</small>` : ""}</span>
      </div>
      ${arr.length ? sparkline(pts.map((p) => p.v)) : `<div class="dim small lift-empty">нет записей</div>`}`;
}

/** Тренд рабочего максимума словами и классом цвета. */
const arrow = (t) => t == null ? "—" : (t > 0.3 ? `▲ +${fmt(t)}%/мес` : (t < -0.3 ? `▼ ${fmt(t)}%/мес` : `≈ ${fmt(t)}%/мес`));
const tcls = (t) => t == null ? "flat" : (t > 0.3 ? "up" : (t < -0.3 ? "down" : "flat"));

/** Данные строки движения: имя, рабочий вес, тренд, статус и подробности. */
export function liftRowOf(k) {
  const src = exById(k);
  const slot = nextSlotFor(k);
  const ex = slot ? slot.ex : null;
  const p = ex ? ex.wp : progressOf(src, { reps: SCHEME.strength.acc.reps, rir: SCHEME.strength.acc.rir, sets: SCHEME.strength.acc.sets });
  const name = LIFT_NAMES[k] || (src ? src.name : archivedExName(k) || k);
  return { k, name, src, slot, ex, p };
}

function liftDetail({ src, slot, ex, p }) {
  if (!p || !p.target) return `<div class="dim small">Движение идёт со своим весом или на время — рабочий вес не считается.</div>`;
  const st = stateOf(p);
  const scheme = ex ? `${ex.sets} × ${ex.reps[0]}${ex.reps[1] !== ex.reps[0] ? "–" + ex.reps[1] : ""}` : null;
  const note = src && src.bw ? " довеском" : (src && src.perHand ? " на руку" : "");
  return `
    <div class="lc-status ${st.cls}" style="max-width:none;text-align:left;margin-bottom:8px">${st.text}</div>
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
      : "Журнал пока пуст — вес оценён от базовых лифтов"}</div>`;
}

// статус движения одним словом — для строки списка; полностью он в раскрытой строке
const STATE_SHORT = { none: "по ощущениям", deload: "разгрузка", new: "первый замер", manual: "вручную",
  drop: "откат", stall: "застой", hold: "держим вес", grow: "рост" };

function liftRowView(r, open) {
  const p = r.p, st = p && p.target ? stateOf(p) : null;
  const note = r.src && r.src.perHand ? "/рука" : "";
  const t = p && p.target ? (p.trend != null ? { cls: tcls(p.trend), txt: arrow(p.trend) }
    : p.deltaKg ? { cls: p.deltaKg > 0 ? "up" : "down", txt: `${p.deltaKg > 0 ? "▲ +" : "▼ "}${fmt(p.deltaKg)} кг` } : { cls: "flat", txt: "" }) : { cls: "flat", txt: "" };
  const ico = r.src ? icon(exerciseIcon(r.src)) : icon("machine");
  const eq = r.src && r.src.equip ? `<span class="pool-eq" title="${esc(EQUIP[r.src.equip] || "")}">${icon(EQUIP_ICON[r.src.equip] || "machine")}</span>` : "";
  return `
    <div class="lr ${open ? "open" : ""}">
      <button class="pool-row lr-row" data-k="${esc(r.k)}" aria-expanded="${open}">
        <span class="pool-ico" aria-hidden="true">${ico}${eq}</span>
        <span class="pool-body">
          <span class="pool-name">${esc(r.name)}</span>
          <span class="lr-sub"><span class="lr-dot ${st ? st.cls : ""}" aria-hidden="true"></span><span class="lr-st">${st ? STATE_SHORT[st.key] || "" : "свой вес"}</span>${t.txt ? `<span class="lr-t ${t.cls} mono">${t.txt}</span>` : ""}</span>
        </span>
        <span class="lr-w mono">${p && p.target ? `${fmt(p.target)}<i> кг${note}</i>` : "—"}</span>
        <span class="pool-chev">›</span>
      </button>
      ${open ? `<div class="lr-body">${liftDetail(r)}</div>` : ""}
    </div>`;
}

/**
 * Список рабочих весов: группы по мышцам плашками, как в каталоге; базовые — первыми.
 * groups: [{ key, name, rows }], openG — раскрытые группы, openK — раскрытое движение.
 */
export function liftListView({ groups, openG, openK, q }) {
  if (!groups.length) return `<div class="empty">${q ? "Ничего не нашлось. Попробуй другое слово — например «жим» или «спина»." : L("logEmptyW")}</div>`;
  return groups.map((g) => {
    const open = q || openG.has(g.key);
    return `
      <div class="panel pool-group lr-group ${open ? "open" : ""}">
        <button class="panel-head pool-toggle" data-g="${g.key}" aria-expanded="${!!open}">
          <span class="eyebrow">${g.name}</span>
          <span class="ph-right"><span class="badge b-dim">${g.rows.length}</span><span class="chev">›</span></span>
        </button>
        <div class="pool-list">${open ? g.rows.map((r) => liftRowView(r, openK === r.k)).join("") : ""}</div>
      </div>`;
  }).join("");
}

export function sessionLogView({ rows, more }) {
  return rows.length
    ? rows.map((s) => `<button class="log-row" data-sid="${esc(s.id)}">
        <span>${esc(questName(WORKOUTS[s.workoutId]) || s.workoutId)}</span>
        <span class="dim mono small">${fmtDate(s.date)}</span>
        <span class="${vcls(s.cls)} mono">${num(s.score)}% ›</span></button>`).join("") +
      (more ? `<button class="link-btn log-more" id="log-more">Показать все · ${more}</button>` : "")
    : `<div class="empty">${L("logEmpty")}</div>`;
}
