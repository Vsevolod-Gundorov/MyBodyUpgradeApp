// Сколько на самом деле длилась тренировка.
//
// Старый таймер считал от открытия квеста до нажатия «завершить». Заглянул в состав
// днём, пришёл в зал вечером — и в журнал уезжало шесть часов. Считать надо не по
// экрану, а по работе: отметки ставятся, когда заполняется подход, а паузы длиннее
// перерыва между подходами (ушёл, отвлёкся, закрыл телефон) в зачёт не идут.

/** Пауза, после которой считается, что тренировка прервана, а не идёт отдых между подходами. */
export const BREAK_MS = 15 * 60e3;

/**
 * Активное время по отметкам активности.
 * @param {number[]} ticks — метки времени (мс), в любом порядке
 * @param {{breakMs?: number, now?: number}} opts — now учитывает текущий, ещё не закрытый интервал
 * @returns {number} секунды
 */
export function activeSeconds(ticks, { breakMs = BREAK_MS, now = null } = {}) {
  const t = (Array.isArray(ticks) ? ticks : [])
    .filter((x) => Number.isFinite(x) && x > 0)
    .concat(Number.isFinite(now) ? [now] : [])
    .sort((a, b) => a - b);
  let ms = 0;
  for (let i = 1; i < t.length; i++) {
    const gap = t[i] - t[i - 1];
    if (gap > 0 && gap <= breakMs) ms += gap;   // длинная пауза — это не тренировка
  }
  return Math.round(ms / 1000);
}

/** Добавить отметку активности, не раздувая список: чаще раза в 20 секунд не пишем. */
export function pushTick(ticks, now = Date.now(), { minGapMs = 20e3, cap = 600 } = {}) {
  const t = Array.isArray(ticks) ? ticks.slice() : [];
  const last = t[t.length - 1];
  if (Number.isFinite(last) && now - last < minGapMs) return t;
  t.push(now);
  return t.length > cap ? t.slice(-cap) : t;
}

/** 0:45 · 1:12:30 — минуты для короткого, часы для длинного. */
export function fmtDuration(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

/**
 * Можно ли верить длительности записи. У старых записей замера активности нет —
 * их время считалось от открытия квеста, и часы там ничего не значат.
 */
export function durationTrusted(session) {
  return !!(session && session.timing === "active");
}
