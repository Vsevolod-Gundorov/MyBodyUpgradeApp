// Модель: настройки отображения и звука — язык, яркость, размер интерфейса, громкость.
// Значения проверяются здесь: журнал может прийти с сервера или из файла, и в настройках
// может оказаться что угодно. Копия того, что нужно до первой отрисовки, лежит
// отдельным ключом — её читает js/theme-boot.js, чтобы экран не мигал при запуске.
import { DEFAULT_LANG, LANGS, tr } from "../../data/i18n.js";
import { S, save } from "./store.js";

export const DISPLAY_KEY = "bodyupgrade.display";
export const SIZES = { s: 0.9, m: 1, l: 1.1, xl: 1.2 };
export const SIZE_ORDER = ["s", "m", "l", "xl"];
export const BRIGHT = { min: 60, max: 130, def: 100 };

const set = () => (S.settings ||= {});
const clampInt = (v, lo, hi, def) => {
  if (v == null || v === "") return def;          // не задано — значение по умолчанию, а не ноль
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
};

export const langNow = () => (LANGS[set().lang] ? set().lang : DEFAULT_LANG);
export const brightnessNow = () => clampInt(set().brightness, BRIGHT.min, BRIGHT.max, BRIGHT.def);
export const sizeNow = () => (SIZES[set().uiSize] ? set().uiSize : "m");
/** Громкость сигналов 0–100: конец отдыха, сохранение. 0 — без звука. */
export const volumeNow = () => clampInt(set().volume, 0, 100, 70);

/** Слово интерфейса на текущем языке. */
export const T = (key) => tr(langNow(), key);

/** Что нужно до первой отрисовки: язык, масштаб, яркость. */
export const displayNow = () => ({ lang: langNow(), zoom: SIZES[sizeNow()], bright: brightnessNow() });

function mirror() {
  try { localStorage.setItem(DISPLAY_KEY, JSON.stringify(displayNow())); } catch (e) { /* приватный режим */ }
}

export function setLang(v) { if (LANGS[v]) { set().lang = v; save(); mirror(); } }
export function setBrightness(v) { set().brightness = clampInt(v, BRIGHT.min, BRIGHT.max, BRIGHT.def); save(); mirror(); }
export function setSize(v) { if (SIZES[v]) { set().uiSize = v; save(); mirror(); } }
export function setVolume(v) { set().volume = clampInt(v, 0, 100, 70); save(); }
export const syncDisplayMirror = mirror;
