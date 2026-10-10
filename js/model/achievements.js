// Модель: контекст и начисление достижений.
import { PROGRAM } from "../../data/program.js";
import { TIERS, catHidden, evaluate as evaluateAchievements } from "../../data/achievements.js";
import { addDays, isoWeekStart, today } from "../core/format.js";
import { buffById, buffTimes } from "./buffs.js";
import { ORDER } from "./catalog.js";
import { heroStats } from "./hero.js";
import { drinkWaterOf, nutTotals } from "./nutrition.js";
import { baselines, currentWeight, targetsFor } from "./profile.js";
import { S, save } from "./store.js";
import { themeNow } from "./theme.js";

export function sessionTonnage(sess) { let t = 0; Object.values(sess.entries || {}).forEach((sets) => sets.forEach(({ w, r }) => (t += (w || 0) * (r || 0)))); return t; }

// недели подряд с ≥min квестов; текущая неполная неделя серию не рвёт
export function weekStreak(sessions, min = 3) {
  const counts = {};
  sessions.forEach((x) => { const k = isoWeekStart(x.date); counts[k] = (counts[k] || 0) + 1; });
  let wk = isoWeekStart(today());
  if ((counts[wk] || 0) < min) wk = addDays(wk, -7);
  let n = 0;
  while ((counts[wk] || 0) >= min) { n++; wk = addDays(wk, -7); }
  return { streak: n, maxWeek: Math.max(0, ...Object.values(counts)) };
}

export function nutritionStats() {
  const log = (S.nutrition && S.nutrition.log) || {};
  const out = { daysLogged: 0, proteinDays: 0, waterDays: 0, kcalDays: 0, fiberDays: 0, fullDays: 0, distinctFoods: 0 };
  const foods = new Set();
  Object.values(log).forEach((day) => {
    if (!day || !((day.items && day.items.length) || day.water > 0)) return;
    out.daysLogged++;
    const t = nutTotals(day);
    const target = targetsFor(day.dayType);
    const protein = t.p >= target.protein;
    const water = (day.water || 0) + drinkWaterOf(day) >= target.water;
    const kcal = t.k > 0 && Math.abs(t.k - target.kcal) <= target.kcal * 0.07;
    if (protein) out.proteinDays++;
    if (water) out.waterDays++;
    if (kcal) out.kcalDays++;
    if (t.fb >= target.fiber) out.fiberDays++;
    if (protein && water && kcal) out.fullDays++;
    (day.items || []).forEach((it) => foods.add((it.n || "").trim().toLowerCase()));
  });
  out.distinctFoods = foods.size;
  return out;
}

export function buffStats() {
  const b = S.buffs || {};
  const log = b.log || {};
  const active = Object.keys(b.active || {}).map(buffById).filter(Boolean);
  let takenTotal = 0, fullDays = 0;
  Object.values(log).forEach((day) => {
    const keys = Object.keys(day || {});
    takenTotal += keys.length;
    if (active.length && active.every((bf) => buffTimes(bf).every((sl) => day[`${bf.id}@${sl}`]))) fullDays++;
  });
  return { takenTotal, fullDays, activeCount: active.length, customCount: (b.custom || []).length, checkedEver: !!b.checkedAt };
}

export function buildAchievementCtx(event) {
  const h = heroStats();
  const cur = S.sessions.filter((x) => ORDER.includes(x.workoutId));
  const perQuest = Object.fromEntries(ORDER.map((id) => [id, cur.filter((x) => x.workoutId === id).length]));
  // квесты по типу сессии: «сага» закрывается, когда пройдены все силовые (или все объёмные) квесты цикла
  const typeIds = (type) => PROGRAM.weeks.flatMap((wk) => wk.workouts.filter((w) => w.type === type).map((w) => w.id));
  let lifetime = 0; S.sessions.forEach((x) => (lifetime += sessionTonnage(x)));
  let goldStreak = 0; for (let i = S.sessions.length - 1; i >= 0 && S.sessions[i].score >= 85; i--) goldStreak++;
  const ws = weekStreak(S.sessions, 3);
  const BASE = baselines();
  const gains = Object.keys(BASE).map((k) => Math.max(0, (h.lifts[k].cur - BASE[k]) / BASE[k]));
  return {
    theme: themeNow(),   // от редакции зависят слова в заметках журнала получений
    event, session: event.session || null,
    hero: { level: h.level, xp: S.xp, stats: h.stats, cls: h.cls, bodyweight: currentWeight() },
    lifts: h.lifts,
    totals: {
      sessions: S.sessions.length,
      cycles: ORDER.length ? Math.min(...ORDER.map((id) => perQuest[id])) : 0,
      sagaStrength: typeIds("strength").length > 0 && typeIds("strength").every((id) => perQuest[id] > 0),
      sagaVolume: typeIds("volume").length > 0 && typeIds("volume").every((id) => perQuest[id] > 0),
      lifetimeT: lifetime / 1000,
      big3: h.lifts.bench.cur + h.lifts.squat.cur + h.lifts.deadlift.cur,
      avgGain: gains.reduce((a, v) => a + v, 0) / gains.length,
      weekStreak: ws.streak, maxWeek: ws.maxWeek, goldStreak,
    },
    nutrition: nutritionStats(),
    buffs: buffStats(),
    meta: S.meta || {},
  };
}

// Проверить достижения после события. Возвращает список новых/повторных; показывает тост, если не silent.
export function checkAchievements(event, { silent = false } = {}) {
  const ctx = buildAchievementCtx(event || { type: "silent" });
  const { earned, unlocked } = evaluateAchievements(ctx, S.achievements || {}, today());
  S.achievements = earned;
  // начисляем все, показываем только видимые в этой редакции: в «Чистой» нет
  // уровня и характеристик, и всплывашка про «20 уровень» там ничего не значит
  const shown = unlocked.filter((u) => !catHidden(u.ach.cat, themeNow()));
  if (shown.length && !silent) { save(); achListeners.forEach((f) => f(shown)); }
  else if (unlocked.length && !silent) save();
  return shown;
}

export const tierName = (t) => (TIERS[t] ? TIERS[t].name : t);

/** Подписаться на новые достижения (показ всплывашки — забота контроллера). */
const achListeners = new Set();
export const onAchievements = (f) => { achListeners.add(f); return () => achListeners.delete(f); };

