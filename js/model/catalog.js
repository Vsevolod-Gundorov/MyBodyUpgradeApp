// Модель: справочник квестов цикла и правки состава.
import { ARCHIVED_WORKOUTS, PROGRAM, buildExercises } from "../../data/program.js";
import { S, save } from "./store.js";

/* ================= справочники ================= */
export const WORKOUTS = {};

export const WEEK_OF = {};
PROGRAM.weeks.forEach((wk) => wk.workouts.forEach((w) => { WORKOUTS[w.id] = w; WEEK_OF[w.id] = wk; }));

export const ORDER = PROGRAM.weeks.flatMap((wk) => wk.workouts.map((w) => w.id));
// архив прошлых циклов: нужен, чтобы старые сессии открывались в «Хрониках» и учитывались
// в аналитике (в текущий цикл и его порядок ORDER они не входят)
(ARCHIVED_WORKOUTS || []).forEach((w) => { if (!WORKOUTS[w.id]) WORKOUTS[w.id] = w; });

// упражнения прошедшей сессии: снимок на момент прохождения, иначе текущий состав
export function sessionExercises(sess) {
  if (Array.isArray(sess.exercises) && sess.exercises.length) return sess.exercises;
  const meta = WORKOUTS[sess.workoutId];
  if (!meta) return [];
  return meta.exercises || buildExercises(meta);
}

// правки атлета для квеста
export const planOf = (wid) => ((S.plan || {})[wid] || {});

export function setPlan(wid, patch) {
  if (!S.plan) S.plan = {};
  const cur = { swap: {}, add: [], hide: [], ...(S.plan[wid] || {}) };
  S.plan[wid] = { ...cur, ...patch };
  save();
}
