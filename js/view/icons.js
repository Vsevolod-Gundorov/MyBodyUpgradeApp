// Вид: наборы иконок и отрисовка значка по имени.
import { ACHIEVEMENT_ICONS } from "../../data/icons-achievements.js";
import { EXERCISE_ICONS } from "../../data/icons-exercise.js";
import { GAME_ICONS } from "../../data/icons.js";
import { PLAIN_ICONS, PLAIN_VB } from "../../data/icons-plain.js";
import { UI_ICONS } from "../../data/icons-ui.js";
import { themeNow } from "../model/theme.js";

/* ================= иконки (game-icons.net, CC BY 3.0; fill = currentColor) ================= */
export const ICONS = Object.assign({}, GAME_ICONS, ACHIEVEMENT_ICONS, UI_ICONS, EXERCISE_ICONS);

// алиасы под имена, которые используются по приложению
export const alias = (a, b) => { if (GAME_ICONS[b]) ICONS[a] = GAME_ICONS[b]; };
alias("hammer", "muscle");
alias("bolt", "lightning");
alias("layers", "weight");
alias("heart", "endurance");
alias("drumstick", "meat");
alias("apple", "meat");
// флаг «старт цикла» — рисованный: у набора game-icons нет флага той же плотности,
// а текстовый символ ⚑ мельче соседних иконок и выглядит по-разному на iOS и Android
ICONS.flag = { vb: "0 0 512 512", inner: '<path d="M132 28h36v456h-36z"/><path d="M168 56h268l-64 88 64 88H168z"/>' };

// штриховой набор второй темы: те же имена, другой рисунок
export const LINE_ICONS = {};
Object.entries(PLAIN_ICONS).forEach(([k, v]) => (LINE_ICONS[k] = { vb: PLAIN_VB, inner: v, stroke: true }));

export const icon = (name, cls = "") => {
  // анатомические иконки движений одинаковы в обеих темах: они и так предметные
  const g = (themeNow() === "plain" && LINE_ICONS[name]) || ICONS[name] || LINE_ICONS[name];
  if (!g) return "";
  const a = g.stroke
    ? ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
    : "";
  return `<svg class="ico ${g.stroke ? "ico-line " : ""}${cls}" viewBox="${g.vb}"${a} aria-hidden="true">${g.inner}</svg>`;
};
