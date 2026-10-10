// Модель: справочник квестов цикла и правки состава.
import { exById } from "../../data/exercises.js";
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
  let list;
  if (Array.isArray(sess.exercises) && sess.exercises.length) list = sess.exercises;
  else {
    const meta = WORKOUTS[sess.workoutId];
    list = meta ? (meta.exercises || buildExercises(meta)) : [];
  }
  // Подходы, записанные к движению вне состава (добавил или заменил в тот день, а снимка
  // состава у старых сессий нет), — тоже работа: без них прогрессия видела бы только
  // удачные дни и завышала вес. Коридор повторов — обычный для такого движения.
  const have = new Set(list.map((x) => x.id));
  const extra = Object.keys(sess.entries || {}).filter((id) => !have.has(id) && exById(id) && (sess.entries[id] || []).some((x) => x && x.r > 0))
    .map((id) => {
      const src = exById(id);
      const reps = src.tier === 1 ? [4, 6] : src.tier === 3 ? [10, 15] : [6, 10];
      return { id, name: src.name, sets: (sess.entries[id] || []).filter((x) => x && x.r > 0).length, reps, rir: 1, lift: src.lift, tier: src.tier, recovered: true };
    });
  return extra.length ? [...list, ...extra] : list;
}

// правки атлета для квеста
export const planOf = (wid) => ((S.plan || {})[wid] || {});

export function setPlan(wid, patch) {
  if (!S.plan) S.plan = {};
  const cur = { swap: {}, add: [], hide: [], ...(S.plan[wid] || {}) };
  S.plan[wid] = { ...cur, ...patch };
  save();
}
