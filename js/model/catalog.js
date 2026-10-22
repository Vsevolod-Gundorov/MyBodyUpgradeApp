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

/* ================= добор: тренировка из недоделанного =================
   Не успел всё — первая часть закрывается сделанным, остальное собирается в «добор»
   на другой день. Добор — та же тренировка с правкой состава: его план — копия плана
   исходной, где сделанные движения скрыты. Поэтому замены, добавления и веса на экране
   добора работают как обычно, а сессия добора пишется под id исходной тренировки
   с пометкой carry: недельный тоннаж и прогрессия видят обе части как одну тренировку.
   S.carry = { "c-…": { from, date, plan } } */
const CARRY_RE = /^c-[a-z0-9]{4,20}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);

/** Запись добора, если она цела: исходная тренировка есть в текущем цикле. */
export function carryOf(wid) {
  if (typeof wid !== "string" || !CARRY_RE.test(wid) || !isObj(S.carry)) return null;
  const c = S.carry[wid];
  if (!isObj(c) || !ORDER.includes(c.from) || !DATE_RE.test(c.date) || !isObj(c.plan)) return null;
  return c;
}

/** Описание тренировки-добора для сборки: исходная тренировка под id добора. */
export function carryMeta(wid) {
  const c = carryOf(wid);
  return c ? { ...WORKOUTS[c.from], id: wid, carryOf: c.from, carryDate: c.date } : null;
}

/** id тренировки цикла: у добора — исходная, у обычной — она сама. */
export const baseWid = (wid) => { const c = carryOf(wid); return c ? c.from : wid; };

/** Доборы, которые ждут, — старые первыми. */
export function carryList() {
  return Object.keys(isObj(S.carry) ? S.carry : {}).filter((id) => carryOf(id))
    .sort((a, b) => S.carry[a].date.localeCompare(S.carry[b].date) || a.localeCompare(b));
}

/**
 * Собрать добор из несделанного. wid — тренировка, которую закрывают (обычная или сам добор),
 * exercises — её собранный состав, left — несделанные движения из него.
 * @returns id добора или null, если переносить нечего
 */
export function makeCarry(wid, exercises, left, date) {
  const leftIds = new Set(left.map((x) => x.id));
  if (!leftIds.size || !exercises.some((x) => !leftIds.has(x.id))) return null;
  const from = baseWid(wid);
  const src = planOf(wid);
  const plan = JSON.parse(JSON.stringify({ swap: {}, add: [], hide: [], ...src }));
  exercises.filter((x) => !leftIds.has(x.id)).forEach((x) => {
    if (x.added) plan.add = plan.add.filter((a) => a !== x.id);
    else if (!plan.hide.includes(x.swappedFrom || x.id)) plan.hide.push(x.swappedFrom || x.id);
  });
  let id;
  do { id = `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`; } while (S.carry && S.carry[id]);
  if (!isObj(S.carry)) S.carry = {};
  S.carry[id] = { from, date, plan: JSON.parse(JSON.stringify(plan)) };
  if (!S.plan) S.plan = {};
  S.plan[id] = plan;
  return id;
}

/** Убрать добор: его план, черновик, таймер и заметки. Сохранение — на вызывающем. */
export function dropCarry(id) {
  if (isObj(S.carry)) delete S.carry[id];
  [S.plan, S.drafts, S.questStart, S.questTicks, S.exNotes].forEach((m) => { if (isObj(m)) delete m[id]; });
}

/** Состав тренировки правили руками? У добора — сравнение с его исходным составом. */
export function planEdited(wid) {
  const c = carryOf(wid), pl = planOf(wid);
  if (c) return JSON.stringify(pl) !== JSON.stringify(c.plan);
  return !!((pl.hide || []).length || Object.keys(pl.swap || {}).length || (pl.add || []).length
    || (pl.pair || []).length || (pl.unpair || []).length);
}

/** Вернуть состав по умолчанию; у добора — тот, с которым его собрали. */
export function resetPlan(wid) {
  const c = carryOf(wid);
  if (!S.plan) S.plan = {};
  if (c) S.plan[wid] = JSON.parse(JSON.stringify(c.plan)); else delete S.plan[wid];
}
