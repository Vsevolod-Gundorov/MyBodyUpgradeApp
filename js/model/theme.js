// Модель: текущая редакция оформления и слова интерфейса в ней.
import { DEFAULT_THEME, THEMES, say } from "../../data/theme.js";
import { ARCHIVED_WORKOUTS, PROGRAM, TEMPLATES, TYPE_NAMES } from "../../data/program.js";
import { achDesc, achName, catName } from "../../data/achievements.js";
import { S } from "./store.js";

/* ================= оформление: «Сага» или «Чистая» =================
   Тема живёт в настройках журнала, а её копия — в отдельном ключе
   localStorage: его читает крошечный скрипт в index.html ещё до отрисовки,
   иначе при каждом запуске на долю секунды мигала бы не та тема. */
export const THEME_KEY = "bodyupgrade.theme";

/** «Чистая» редакция: без уровня, опыта и игровых слов. */
export const plainNow = () => themeNow() === "plain";

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

/** Короткое название для шапки тренировки: тип дня уже стоит строкой ниже. */
export function questTitle(w) {
  if (!w) return "";
  if (themeNow() !== "plain") return w.boss || w.title || "";
  const tpl = TEMPLATES[w.tpl];
  return (tpl && tpl.name) || w.title || w.boss || "";
}

/** Название тренировки: в «Саге» это имя босса, в «Чистой» — что за день и какой.
 *  Имена боссов остаются в данных: переключил тему обратно — они вернулись. */
export function questName(w) {
  if (!w) return "";
  if (themeNow() !== "plain") return w.boss || w.title || "";
  const tpl = TEMPLATES[w.tpl];
  if (tpl) return TYPE_NAMES[w.type] ? `${tpl.name} · ${TYPE_NAMES[w.type]}` : tpl.name;
  return w.title || w.boss || "";
}

/* Заметки в журнале получений пишутся словами той редакции, в которой знак выдан,
   и хранятся как есть — это история. Но в «Чистой» читать «10 квестов позади ·
   «Столпы Земли»» странно, поэтому при показе слова переводятся, а имена боссов
   убираются. Сам журнал не меняется: вернул «Сагу» — всё как было. */
const BOSSES = new Set([...PROGRAM.weeks.flatMap((wk) => wk.workouts), ...ARCHIVED_WORKOUTS].map((w) => w.boss).filter(Boolean));
const PLAIN_WORDS = [
  [/квестов/g, "тренировок"], [/квеста/g, "тренировки"], [/квесты/g, "тренировки"], [/квест/g, "тренировка"],
  [/Квест/g, "Тренировка"], [/кругов/g, "циклов"], [/побед подряд/g, "подряд на 85%+"], [/дар судьбы/g, "бонус"],
  [/ позади/g, ""],
];
export function plainText(text) {
  if (!text || !plainNow()) return text || "";
  let t = String(text).replace(/\s*·?\s*«([^»]+)»/g, (m, n) => (BOSSES.has(n) ? "" : m));
  PLAIN_WORDS.forEach(([re, to]) => { t = t.replace(re, to); });
  return t.trim().replace(/^·\s*/, "") || "—";
}
