// Модель: профиль атлета, вес тела и его нормы.
//
// Всё, что раньше было зашито под одного человека (вес 93 кг, нормы 3150/2750 ккал,
// стартовые максимумы 147/170/195/100), теперь берётся из профиля. Пока профиля нет —
// старое поведение, чтобы ничего не сломалось до первого заполнения.
import { NUTRITION, WATER_TARGET_ML } from "../../data/nutrition.js";
import { BASELINES } from "../../data/program.js";
import { ageOf, checkProfile, computeTargets, estimateMaxes } from "../../data/profile.js";
import { today } from "../core/format.js";
import { S } from "./store.js";

/* ---------------- вес тела ---------------- */
const weights = () => ((S.body ||= { weights: [] }).weights ||= []);

/** Свежий вес: последняя запись, иначе прежнее поле профиля героя. */
export function currentWeight() {
  const w = weights();
  return (w.length ? w[w.length - 1].kg : S.hero.bodyweight) || 90;
}

export const weightLog = () => weights();

/** Записать вес на дату (одна запись в день — новая заменяет прежнюю). */
export function logWeight(kg, date = today()) {
  const v = Math.round(kg * 10) / 10;
  if (!(v >= 30 && v <= 300)) return false;
  const w = weights().filter((e) => e.date !== date);
  w.push({ date, kg: v });
  w.sort((a, b) => a.date.localeCompare(b.date));
  if (w.length > 1000) w.splice(0, w.length - 1000);
  S.body.weights = w;
  S.hero.bodyweight = w[w.length - 1].kg;          // для расчётов, которые читают старое поле
  return true;
}

export function deleteWeight(date) {
  S.body.weights = weights().filter((e) => e.date !== date);
  S.hero.bodyweight = currentWeight();
}

/* ---------------- профиль ---------------- */
export const profile = () => S.profile || null;

/** Данные для расчёта: профиль + свежий вес + возраст на сегодня. */
export function profileInput(p = profile()) {
  return p ? { ...p, weight: currentWeight(), age: ageOf(p.birthYear) } : null;
}

export const hasProfile = () => { const p = profileInput(); return !!p && !checkProfile(p); };

/**
 * Сохранить профиль из мастера. Вес пишется в историю веса, имя — в героя.
 * Для тех, у кого уже есть журнал тренировок, стартовые максимумы сохраняются
 * прежними: рабочие веса и так идут по истории, а менять базу задним числом нельзя.
 */
export function saveProfile(form) {
  const prev = profile() || {};
  const birthYear = new Date().getFullYear() - form.age;
  const p = {
    sex: form.sex, birthYear, height: form.height,
    activity: form.activity, direction: form.direction, pace: form.pace || "normal",
    program: form.program, custom: form.program === "custom" ? { protein: form.custom.protein, fat: form.custom.fat } : null,
    experience: form.experience,
    adjust: prev.direction === form.direction && prev.program === form.program ? (prev.adjust || 0) : 0,
    override: prev.override || null,
    createdAt: prev.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  if (form.maxes) { p.maxes = form.maxes; p.maxesSource = "entered"; }
  else if (prev.maxes && prev.maxesSource === "entered") { p.maxes = prev.maxes; p.maxesSource = "entered"; }
  else if (S.sessions.length) { p.maxes = { ...BASELINES }; p.maxesSource = "journal"; }
  else { p.maxes = estimateMaxes({ sex: form.sex, weight: form.weight, age: form.age, experience: form.experience }); p.maxesSource = "estimated"; }
  const err = checkProfile({ ...p, weight: form.weight, age: form.age });
  if (err) return { ok: false, error: err };
  S.profile = p;
  if (form.name && form.name.trim()) S.hero.name = form.name.trim().slice(0, 40);
  if (Math.abs(currentWeight() - form.weight) >= 0.05 || !weights().length) logWeight(form.weight);
  return { ok: true, profile: p };
}

/** Стартовые максимумы базовых движений: из профиля, иначе прежние. */
export const baselines = () => (profile() && profile().maxes) || BASELINES;

/* ---------------- нормы ---------------- */
const LEGACY = (dayType) => {
  const d = NUTRITION.dayTypes[dayType] || NUTRITION.dayTypes.rest;
  return { kcal: d.kcal, protein: d.protein, fat: d.fat, carbs: d.carbs, fiber: NUTRITION.constants.fiber[0], water: WATER_TARGET_ML };
};
export const DAY_LABELS = { training: "Тренировка", rest: "Отдых" };

/** Полный расчёт по профилю (или null, если профиля нет). */
export function plan() {
  const p = profileInput();
  if (!p || checkProfile(p)) return null;
  return computeTargets(p);
}

/**
 * Нормы на день: kcal, protein, fat, carbs, fiber, water.
 * Ручная настройка (override) главнее расчёта — но только по калориям и БЖУ.
 */
export function targetsFor(dayType) {
  const pl = plan();
  if (!pl) return { ...LEGACY(dayType), label: DAY_LABELS[dayType] || DAY_LABELS.rest, legacy: true };
  const key = dayType === "training" ? "training" : "rest";
  const base = pl[key];
  const ov = profile().override && profile().override[key];
  return { ...base, ...(ov || {}), label: DAY_LABELS[key], manual: !!ov };
}

/** Ручные нормы на тип дня; null — вернуться к расчёту. */
export function setOverride(dayType, values) {
  const p = profile();
  if (!p) return;
  const o = { ...(p.override || {}) };
  if (values) o[dayType] = values; else delete o[dayType];
  p.override = Object.keys(o).length ? o : null;
}

/** Принять поправку калорий по реальному весу (см. adaptiveAdjust). */
export function applyAdjust(kcal) {
  const p = profile();
  if (!p) return;
  p.adjust = Math.max(-800, Math.min(800, (p.adjust || 0) + kcal));
  p.adjustedAt = today();
}
