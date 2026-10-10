// Модель: итоги недели — тренировки, тоннаж, рекорды, вес и питание.
// Неделя — с понедельника по воскресенье. Текущая неделя считается по сегодняшний день.
import { exById } from "../../data/exercises.js";
import { weightTrendSeries } from "../../data/profile.js";
import { LIFT_NAMES, archivedExName } from "../../data/program.js";
import { e1rm } from "../../data/progression.js";
import { addDays, isoWeekStart, today } from "../core/format.js";
import { sessionTonnage } from "./achievements.js";
import { nutTotals } from "./nutrition.js";
import { targetsFor, weightLog } from "./profile.js";
import { S } from "./store.js";
import { movementHistory } from "./training.js";

/** Цель недели — та же, что в серии «недели подряд»: три тренировки. */
export const WEEK_GOAL = 3;

const nameOf = (k) => LIFT_NAMES[k] || (exById(k) || {}).name || archivedExName(k) || k;
const tonnOf = (from, to) => S.sessions.filter((s) => s.date >= from && s.date <= to).reduce((a, s) => a + sessionTonnage(s), 0);

/** Рекорды недели: расчётный 1ПМ движения выше всего, что было до этой тренировки. */
function weekPRs(from, to) {
  const out = [];
  Object.entries(movementHistory()).forEach(([k, hist]) => {
    let best = 0;
    hist.forEach((h) => {
      const top = Math.max(0, ...h.sets.filter((x) => x.w > 0 && x.r > 0).map((x) => e1rm(x.w, Math.min(x.r, 10))));
      if (!top) return;
      if (h.date >= from && h.date <= to && best > 0 && top > best + 0.4) {
        const prev = out.find((p) => p.key === k);
        if (prev) prev.kg = Math.max(prev.kg, top); else out.push({ key: k, name: nameOf(k), kg: top, before: best });
      }
      best = Math.max(best, top);
    });
  });
  return out.sort((a, b) => (b.kg - b.before) / b.before - (a.kg - a.before) / a.before);
}

/** Изменение веса за неделю — по тренду, а не по случайным взвешиваниям. */
function weekWeight(from, to) {
  const series = weightTrendSeries(weightLog());
  const at = (iso) => { let v = null; for (const p of series) { if (p.date <= iso) v = p.trend; else break; } return v; };
  const end = at(to), start = at(addDays(from, -1));
  const inWeek = series.some((p) => p.date >= from && p.date <= to);
  return { change: end != null && start != null && inWeek ? Math.round((end - start) * 10) / 10 : null, now: end };
}

function weekNutrition(from, to) {
  const log = (S.nutrition && S.nutrition.log) || {};
  const r = { logged: 0, protein: 0, kcal: 0, kcalSum: 0 };
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const day = log[d];
    if (!day || !(day.items && day.items.length)) continue;
    const t = nutTotals(day), T = targetsFor(day.dayType);
    r.logged++; r.kcalSum += t.k;
    if (t.p >= T.protein) r.protein++;
    if (t.k > 0 && Math.abs(t.k - T.kcal) <= T.kcal * 0.07) r.kcal++;
  }
  return { logged: r.logged, protein: r.protein, kcal: r.kcal, avgKcal: r.logged ? Math.round(r.kcalSum / r.logged) : null };
}

/** Самая ранняя неделя, где есть хоть что-то: тренировка, питание или взвешивание. */
export function firstWeek() {
  const dates = [
    ...S.sessions.map((s) => s.date),
    ...Object.keys((S.nutrition && S.nutrition.log) || {}),
    ...weightLog().map((w) => w.date),
  ].filter(Boolean).sort();
  return isoWeekStart(dates[0] || today());
}

/**
 * Итоги недели, которая начинается в понедельник `start` (по умолчанию — текущая).
 * days — сколько дней недели уже прошло: для текущей недели это не 7.
 */
export function weekSummary(start = isoWeekStart(today())) {
  const now = today();
  const end = addDays(start, 6);
  const to = end < now ? end : now;
  const days = Math.max(0, Math.round((new Date(to + "T00:00:00Z") - new Date(start + "T00:00:00Z")) / 864e5) + 1);
  const sessions = S.sessions.filter((s) => s.date >= start && s.date <= end);
  const tonnage = tonnOf(start, end), prev = tonnOf(addDays(start, -7), addDays(start, -1));
  return {
    start, end, days, current: end >= now,
    sessions: sessions.length, goal: WEEK_GOAL,
    tonnage, tonnagePrev: prev, tonnageDelta: prev > 0 ? Math.round(((tonnage - prev) / prev) * 100) : null,
    prs: weekPRs(start, end),
    weight: weekWeight(start, to),
    nutrition: weekNutrition(start, to),
  };
}
