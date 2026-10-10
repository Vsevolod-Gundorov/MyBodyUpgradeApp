// Модель: текущая редакция оформления и слова интерфейса в ней.
import { DEFAULT_THEME, THEMES, say } from "../../data/theme.js";
import { TEMPLATES, TYPE_NAMES } from "../../data/program.js";
import { achDesc, achName, catName, visibleAchievements } from "../../data/achievements.js";
import { S } from "./store.js";

/* ================= оформление: «Сага» или «Чистая» =================
   Тема живёт в настройках журнала, а её копия — в отдельном ключе
   localStorage: его читает крошечный скрипт в index.html ещё до отрисовки,
   иначе при каждом запуске на долю секунды мигала бы не та тема. */
export const THEME_KEY = "bodyupgrade.theme";

export function themeNow() {
  const t = S && S.settings && S.settings.theme;
  return THEMES[t] ? t : DEFAULT_THEME;
}

/** Слово в текущей теме: квест или тренировка, Персонаж или Профиль. */
export const L = (key) => say(themeNow(), key);

/** Добавка в текущей редакции: в «Саге» у неё игровое имя, в «Чистой» —
 *  настоящее название вещества, которое и так лежит рядом в данных. */
export const BN = (b) => (themeNow() === "plain" ? (b.real || b.name) : (b.name || b.real || ""));

/** Подпись под названием: в «Саге» это настоящее вещество, в «Чистой» оно уже
 *  стоит заголовком — повторять его второй строкой незачем. */
export const BSub = (b) => (themeNow() === "plain" ? "" : (b.real || ""));

/** Достижение в текущей редакции: название, условие и раздел списка. */
export const AN = (a) => achName(a, themeNow());

export const AD = (a) => achDesc(a, themeNow());

export const CN = (k) => catName(k, themeNow());

/** Достижения, видимые в текущей редакции. */
export const AVIS = () => visibleAchievements(themeNow());

/** Название тренировки: в «Саге» это имя босса, в «Чистой» — что за день и какой.
 *  Имена боссов остаются в данных: переключил тему обратно — они вернулись. */
export function questName(w) {
  if (!w) return "";
  if (themeNow() !== "plain") return w.boss || w.title || "";
  const tpl = TEMPLATES[w.tpl];
  if (tpl) return TYPE_NAMES[w.type] ? `${tpl.name} · ${TYPE_NAMES[w.type]}` : tpl.name;
  return w.title || w.boss || "";
}
