// Модель: программа растяжки атлета — неделя цикла, отметки упражнений, журнал и тесты.
// Хранится в S.stretch и уезжает на сервер вместе с журналом. Без DOM.
//   S.stretch = {
//     week, cycle,                 // где атлет в программе (data/stretch.js)
//     marks: { A: [id], B: [id] }, // что отмечено в незаконченной тренировке
//     log:   [{ date, w, week, cycle, done, total }],
//     tests: [{ date, cycle, week, id, v }],
//   }
import { STRETCH, STRETCH_CYCLE_WEEKS, STRETCH_TESTS, TEST_WEEKS, nextStretchWeek, stretchItems } from "../../data/stretch.js";
import { today } from "../core/format.js";
import { S, save } from "./store.js";

const LOG_MAX = 400;
const TESTS_MAX = 400;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const int = (v, lo, hi, def) => (Number.isInteger(v) && v >= lo && v <= hi ? v : def);

/**
 * Состояние программы, приведённое к правильному виду. Журнал мог приехать с другого
 * телефона или из старой версии — всё лишнее и кривое отбрасывается, ничего не падает.
 */
export function stretchNow() {
  const raw = S.stretch && typeof S.stretch === "object" && !Array.isArray(S.stretch) ? S.stretch : {};
  const marks = {};
  Object.keys(STRETCH).forEach((w) => {
    const ids = new Set(stretchItems(w).map((x) => x.id));
    const got = raw.marks && Array.isArray(raw.marks[w]) ? raw.marks[w] : [];
    marks[w] = [...new Set(got.filter((id) => ids.has(id)))];
  });
  const log = (Array.isArray(raw.log) ? raw.log : []).filter((e) => e && STRETCH[e.w] && DATE_RE.test(e.date))
    .map((e) => ({ date: e.date, w: e.w, week: int(e.week, 1, STRETCH_CYCLE_WEEKS, 1), cycle: int(e.cycle, 1, 999, 1),
      done: int(e.done, 0, 99, 0), total: int(e.total, 0, 99, 0) }));
  const testIds = new Set(STRETCH_TESTS.map((t) => t.id));
  const tests = (Array.isArray(raw.tests) ? raw.tests : []).filter((e) => e && testIds.has(e.id) && DATE_RE.test(e.date) && Number.isFinite(e.v))
    .map((e) => ({ date: e.date, cycle: int(e.cycle, 1, 999, 1), week: int(e.week, 1, STRETCH_CYCLE_WEEKS, 1), id: e.id, v: e.v }));
  S.stretch = {
    week: int(raw.week, 1, STRETCH_CYCLE_WEEKS, 1),
    cycle: int(raw.cycle, 1, 999, 1),
    marks, log: log.slice(-LOG_MAX), tests: tests.slice(-TESTS_MAX),
  };
  return S.stretch;
}

/** Какие тренировки (A, B) уже сделаны в текущей неделе программы. */
export function doneThisWeek(st = stretchNow()) {
  return new Set(st.log.filter((e) => e.week === st.week && e.cycle === st.cycle).map((e) => e.w));
}

export const marksOf = (wid) => new Set(stretchNow().marks[wid] || []);

/** Отметить упражнение сделанным или снять отметку. */
export function toggleMark(wid, id) {
  const st = stretchNow();
  if (!st.marks[wid] || !stretchItems(wid).some((x) => x.id === id)) return false;
  const set = new Set(st.marks[wid]);
  if (set.has(id)) set.delete(id); else set.add(id);
  st.marks[wid] = [...set];
  save();
  return set.has(id);
}

/**
 * Закончить тренировку: запись в журнал, отметки сбрасываются. Неделя засчитывается,
 * когда в ней сделаны и A, и B; после разгрузки — новый цикл с недели 2.
 * @returns { week, cycle, advanced, left } — left: какая тренировка недели ещё осталась
 */
export function finishStretch(wid, date = today()) {
  const st = stretchNow();
  if (!STRETCH[wid]) return null;
  const total = stretchItems(wid).length;
  st.log.push({ date, w: wid, week: st.week, cycle: st.cycle, done: st.marks[wid].length, total });
  if (st.log.length > LOG_MAX) st.log.splice(0, st.log.length - LOG_MAX);
  st.marks[wid] = [];
  const done = doneThisWeek(st);
  const next = nextStretchWeek(st, done);
  const advanced = next.week !== st.week || next.cycle !== st.cycle;
  const left = advanced ? null : Object.keys(STRETCH).find((w) => !done.has(w)) || null;
  st.week = next.week; st.cycle = next.cycle;
  save();
  return { week: st.week, cycle: st.cycle, advanced, left };
}

/** Неделя тестов: первая и разгрузочная. */
export const isTestWeek = (week) => TEST_WEEKS.includes(week);

/** Записать результат теста. В одной неделе цикла у теста одна запись — повтор её заменяет. */
export function saveTest(id, value, date = today()) {
  const t = STRETCH_TESTS.find((x) => x.id === id);
  const v = Number(value);
  if (!t || !Number.isFinite(v)) return false;
  const st = stretchNow();
  const clamped = Math.min(t.max, Math.max(t.min, Math.round(v)));
  st.tests = st.tests.filter((e) => !(e.id === id && e.cycle === st.cycle && e.week === st.week));
  st.tests.push({ date, cycle: st.cycle, week: st.week, id, v: clamped });
  if (st.tests.length > TESTS_MAX) st.tests.splice(0, st.tests.length - TESTS_MAX);
  save();
  return true;
}

/**
 * Последний результат каждого теста и сдвиг к предыдущему.
 * better — сдвиг в лучшую сторону (у «см до пола» лучше меньше, у секунд — больше).
 * @returns { id: { v, prev, delta, better } }
 */
export function testResults(st = stretchNow()) {
  const out = {};
  STRETCH_TESTS.forEach((t) => {
    const list = st.tests.filter((e) => e.id === t.id);
    if (!list.length) return;
    const last = list[list.length - 1], prev = list.length > 1 ? list[list.length - 2] : null;
    const delta = prev ? last.v - prev.v : null;
    out[t.id] = { v: last.v, prev: prev ? prev.v : null, delta, better: delta == null || delta === 0 ? null : (t.better === "less" ? delta < 0 : delta > 0) };
  });
  return out;
}

/** Результат теста, записанный в текущей неделе цикла (для правки), иначе — последний. */
export function testValueNow(id, st = stretchNow()) {
  const list = st.tests.filter((e) => e.id === id);
  return list.length ? list[list.length - 1].v : null;
}

// какая тренировка растяжки мешает какому тяжёлому движению (data/stretch.js → timing)
const CLASH = { squat: "A", deadlift: "A", bench: "B" };

/**
 * Тяжёлые движения следующей силовой тренировки, которым мешает растяжка:
 * A — присед и становая, B — жим. Тяжёлое — главное движение до 6 повторов.
 * @returns { A: ["squat"], B: ["bench"] } — пустые списки, если мешать нечему
 */
export function stretchClash(workout) {
  const out = { A: [], B: [] };
  (workout && Array.isArray(workout.exercises) ? workout.exercises : []).forEach((ex) => {
    const w = CLASH[ex.lift];
    const lo = Array.isArray(ex.reps) ? ex.reps[0] : 99;
    if (w && lo <= 6 && !out[w].includes(ex.lift)) out[w].push(ex.lift);
  });
  return out;
}
