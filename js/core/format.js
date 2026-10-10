// Форматирование чисел, дат и русского счёта. Ни состояния, ни DOM.

export const epley = (w, r) => (r >= 1 ? w * (1 + r / 30) : 0);

export const fmt = (n) => (Math.round(n * 10) / 10).toString().replace(".", ",");

// тоннаж: килограммы до тонны, дальше — тонны с одним знаком
export const fmtTonn = (kg) => (kg >= 1000 ? `${fmt(kg / 1000)} т` : `${Math.round(kg)} кг`);

export const today = () => new Date().toISOString().slice(0, 10);

export const fmtDate = (iso) => { const [y, m, d] = iso.split("-"); return `${d}.${m}.${String(y).slice(2)}`; };

/* ================= таймеры квеста и умного отдыха ================= */
export const fmtClock = (sec) => { sec = Math.max(0, Math.round(sec)); const m = Math.floor(sec / 60); return `${m}:${String(sec % 60).padStart(2, "0")}`; };

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// русский счёт: 1 квест, 2 квеста, 5 квестов
export const plural3 = (n, one, few, many) => {
  const d = Math.abs(n) % 100, u = d % 10;
  return `${n} ${d > 10 && d < 20 ? many : u === 1 ? one : u >= 2 && u <= 4 ? few : many}`;
};

/* ================= достижения (знаки отличия) ================= */
// Правила и список — data/achievements.js. Здесь: сборка контекста из состояния и показ.
export const isoWeekStart = (iso) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };

export const WD = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

// даты считаем в UTC — согласованно с today() (он тоже из toISOString)
export function addDays(iso, n) { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

export function dateLabel(iso) { const d = new Date(iso + "T00:00:00Z"); return `${WD[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; }

/**
 * Текст в разметку: названия продуктов приходят из Open Food Facts, общего каталога
 * и от пользователя — без экранирования «<img …>» в названии стал бы частью страницы.
 */
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
