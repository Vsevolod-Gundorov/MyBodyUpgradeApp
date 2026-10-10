// Вид: переиспользуемые куски разметки.
import { CORE_MUSCLES, coverLevel } from "../../data/bodymap.js";
import { EQUIP, MUSCLES, MUSCLE_ORDER, exById } from "../../data/exercises.js";
import { EQUIP_ICON } from "../../data/icons-ui.js";
import { exerciseIcon } from "../../data/icons-exercise.js";
import { moveLabel } from "../../data/progression.js";
import { sessionLoad } from "../../data/program.js";
import { esc, fmt, fmtDate } from "../core/format.js";
import { plainText } from "../model/theme.js";
import { poolWeight, workoutOf } from "../model/training.js";
import { icon } from "./icons.js";

// какая иконка у какой характеристики + свой цвет шкалы и акцент
export const STAT_ICONS = { СИЛА: "hammer", МОЩЬ: "bolt", ВЫНОСЛ: "flame", ОБЪЁМ: "layers", ДИСЦИПЛ: "shield", СТОЙКОСТЬ: "gem" };

export const STAT_GRAD = {
  СИЛА: "linear-gradient(90deg,#8f3030,#cf5a4a,#ec8a72)",       // багрянец
  МОЩЬ: "linear-gradient(90deg,#5a3f8f,#8a6bcf,#b49ae8)",       // фиолет
  ВЫНОСЛ: "linear-gradient(90deg,#b5732f,#e0a24a,#f3c66e)",     // янтарь
  ОБЪЁМ: "linear-gradient(90deg,#2f7d7a,#4fb0aa,#8fd8d0)",      // бирюза
  ДИСЦИПЛ: "linear-gradient(90deg,#2f5a8f,#4f86c0,#8fb6e0)",    // синь
  СТОЙКОСТЬ: "linear-gradient(90deg,#5c7d3f,#8fb15e,#c0dd92)",  // зелень
};

export const STAT_ACCENT = { СИЛА: "#e07a5f", МОЩЬ: "#a98be0", ВЫНОСЛ: "#e0a24a", ОБЪЁМ: "#5fc0b8", ДИСЦИПЛ: "#6fa0dc", СТОЙКОСТЬ: "#9fc46e" };

export const runeSVG = `<svg viewBox="0 0 24 24"><path d="M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1z"/></svg>`;

// метка тяжёлого дня в списке квестов
export function loadTag(wid) {
  const w = workoutOf(wid);
  if (!w) return "";
  const sl = sessionLoad(w.exercises);
  return sl.level === "high" ? ` · <span class="load-mark">тяжёлый</span>` : "";
}

// подпись рабочего веса: число + откуда оно взялось
export function weightLabel(ex) {
  if (!ex.w) {
    const src = exById(ex.id);
    return `<span class="badge b-dim">${src && src.bw ? "свой вес" : (ex.wNote || "вес по ощущениям")}</span>`;
  }
  const range = `${fmt(ex.w)} кг`;
  const mark = ex.wSource === "work" ? `<span class="w-src own" title="посчитано по твоим подходам">★</span>` : `<span class="w-src" title="оценка от базовых лифтов — уточнится после первых подходов">◎</span>`;
  const note = ex.wNote === "на каждую руку" ? "на руку" : ex.wNote;
  return `<span class="badge b-weight">${range} ${mark}</span>${note ? `<span class="badge b-dim">${note}</span>` : ""}`;
}

export const poolRow = (ex) => {
  const ww = poolWeight(ex);
  const w = ww && ww.est1RM ? `${fmt(ww.target)} кг` : null;
  return `<button class="pool-row" data-ex="${ex.id}">
    <span class="pool-ico" title="${ex.name}">${icon(exerciseIcon(ex))}
      <span class="pool-eq" title="${EQUIP[ex.equip] || ""}">${icon(EQUIP_ICON[ex.equip] || "machine")}</span></span>
    <span class="pool-body">
      <span class="pool-name">${ex.name}</span>
      <span class="badges">
        ${w ? `<span class="badge b-weight">${w}${ww.source === "work" ? " ★" : " ◎"}</span>` : ""}
        ${ex.lift ? `<span class="badge b-main">база</span>` : ""}
        ${ex.stretch ? `<span class="badge b-ss">растяжение</span>` : ""}
      </span>
    </span>
    <span class="pool-chev">›</span>
  </button>`;
};

/** Итог по карте: сколько основных групп получают свои два дня, а какие просели. */
export function coverSummary(cov) {
  const core = MUSCLE_ORDER.filter((g) => CORE_MUSCLES.includes(g));
  const miss = core.filter((g) => coverLevel(cov[g], g) === "miss");
  const low = core.filter((g) => coverLevel(cov[g], g) === "low");
  if (miss.length) return `<b class="warn">Выпали из недели: ${miss.map((g) => MUSCLES[g]).join(", ")}</b>`;
  if (low.length) return `${core.length - low.length} из ${core.length} основных групп работают 2×/нед. Один день у: ${low.map((g) => MUSCLES[g]).join(", ")}`;
  return `Все ${core.length} основных групп работают дважды в неделю — неделя собрана правильно`;
}

/* Данные журнала могут прийти из файла или с другого устройства: в разметку — только
   известный класс вердикта и только числа там, где ждём число. */
export const vcls = (c) => (/^verdict-(gold|mid|fail)$/.test(String(c)) ? c : "verdict-mid");
export const num = (v) => (Number.isFinite(+v) ? +v : 0);

export const achMedallion = (a, cls = "") => `<span class="medallion tiered tier-${a.tier} ${cls}">${icon(a.icon || "gem")}</span>`;

/* журнал получений знака: дата и причина каждого раза, свежие сверху */
export function achLogHTML(got) {
  const log = (got.log || []).filter((e) => e && (e.date || e.note));
  if (!log.length) return "";
  const rows = [...log].reverse();
  return `<div class="ach-log">
    <div class="eyebrow" style="margin-bottom:6px">Журнал получений · ${rows.length}</div>
    ${rows.map((e, i) => `<div class="ach-log-row"><span class="mono ach-log-n">${rows.length - i}</span><span class="mono ach-log-date">${e.date ? fmtDate(e.date) : "—"}</span><span class="ach-log-note">${esc(plainText(e.note)) || "—"}</span></div>`).join("")}
  </div>`;
}

/* ================= РЕСУРСЫ (снабжение / питание) ================= */
export const NUT_ICON = { kcal: "flame", protein: "drumstick", carbs: "wheat", fat: "avocado", fiber: "leaf" };

// у каждой шкалы — свой цвет заливки и акцент иконки
export const NUT_GRAD = {
  kcal: "linear-gradient(90deg,#b5732f,#e0a24a,#f3c66e)",    // янтарь
  protein: "linear-gradient(90deg,#8f3030,#cf5a4a,#ec8a72)", // багрянец
  carbs: "linear-gradient(90deg,#9a7a24,#d8b43f,#f2dd78)",   // золото
  fat: "linear-gradient(90deg,#5c7d3f,#8fb15e,#c0dd92)",     // зелень
  fiber: "linear-gradient(90deg,#5f7d2f,#9bb84a,#cbe07a)",   // лайм
};

export const NUT_ACCENT = { kcal: "#e0a24a", protein: "#e07a5f", carbs: "#e6c24a", fat: "#9fc46e", fiber: "#bcd35f" };

// Откуда взялся вес: одна строка под бейджами движения. Раньше здесь стояли
// «потолок» и «пол» — два числа, из которых не следовало, что ставить сегодня.
export function exTargetHTML(ex) {
  const p = ex.wp;
  const m = moveLabel(p);
  if (!m) return "";
  const cls = { "▲": "up", "▼": "down" }[m.icon] || "flat";
  return `<span class="ex-prog ${cls}"><i class="mono">${m.icon}</i>${m.text}</span>`;
}

export function sparkline(values) {
  const W = 320, H = 64, pad = 6;
  const min = Math.min(...values) * 0.98, max = Math.max(...values) * 1.02;
  const x = (i) => pad + (i * (W - 2 * pad)) / Math.max(1, values.length - 1);
  const y = (v) => H - pad - ((v - min) / Math.max(0.001, max - min)) * (H - 2 * pad);
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(values.length - 1).toFixed(1)},${H - pad} L${pad},${H - pad} Z`;
  const lastX = x(values.length - 1), lastY = y(values[values.length - 1]);
  return `<svg class="sparkline" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <path class="area" d="${area}"/><path class="line" d="${line}"/>
    <circle cx="${lastX}" cy="${lastY}" r="3"/></svg>`;
}

/** Полоска «Готово» над цифровой клавиатурой iOS. */
export function kbdBarView() {
  return `<button type="button" class="kbd-done">Готово</button>`;
}
