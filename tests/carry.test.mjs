// Добор: тренировку разбили на две — несделанное собирается в отдельную тренировку,
// она считается второй частью той же тренировки, а не новым прохождением.
import { test } from "node:test";
import assert from "node:assert/strict";

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { S } = await import("../js/model/store.js");
const C = await import("../js/model/catalog.js");
const T = await import("../js/model/training.js");
const { PROGRAM, weekTonnage } = await import("../data/program.js");

const reset = () => { S.sessions = []; S.plan = {}; S.carry = {}; S.drafts = {}; S.cycleStart = 0; T.invalidateE1RM(); };
const WID = C.ORDER[0];

test("добор — только несделанные движения, с весами и под исходной тренировкой", () => {
  reset();
  const w = T.workoutOf(WID);
  const left = w.exercises.slice(-3);
  const id = C.makeCarry(WID, w.exercises, left, "2026-10-22");
  assert.match(id, /^c-[a-z0-9]+$/);
  const cw = T.workoutOf(id);
  assert.deepEqual(cw.exercises.map((x) => x.id), left.map((x) => x.id));
  assert.equal(cw.carryOf, WID);
  assert.equal(cw.carryDate, "2026-10-22");
  assert.ok(cw.exercises.every((x) => "w" in x), "веса посчитаны");
  assert.equal(C.baseWid(id), WID);
  assert.deepEqual(C.carryList(), [id]);
  assert.equal(C.planEdited(id), false, "свежий добор не считается правленым");
});

test("замены и добавления исходной тренировки переезжают в добор", () => {
  reset();
  const w0 = T.workoutOf(WID);
  const first = w0.exercises[0];
  C.setPlan(WID, { swap: { [first.id]: "front-squat" }, add: ["legext"] });
  const w = T.workoutOf(WID);
  const swapped = w.exercises.find((x) => x.swappedFrom === first.id);
  const added = w.exercises.find((x) => x.added);
  assert.ok(swapped && added);
  // сделали замену, не сделали добавленное и последнее движение
  const left = [added, w.exercises.filter((x) => !x.added).slice(-1)[0]];
  const id = C.makeCarry(WID, w.exercises, left, "2026-10-22");
  assert.deepEqual(T.workoutOf(id).exercises.map((x) => x.id).sort(), left.map((x) => x.id).sort());
  // сделали добавленное — из добора оно уходит
  const id2 = C.makeCarry(WID, w.exercises, [swapped], "2026-10-22");
  assert.deepEqual(T.workoutOf(id2).exercises.map((x) => x.id), [swapped.id]);
});

test("нечего переносить — добор не собирается", () => {
  reset();
  const w = T.workoutOf(WID);
  assert.equal(C.makeCarry(WID, w.exercises, [], "2026-10-22"), null);
  assert.equal(C.makeCarry(WID, w.exercises, w.exercises, "2026-10-22"), null, "всё несделано — это не разбивка");
});

test("правка состава добора и возврат к его составу", () => {
  reset();
  const w = T.workoutOf(WID);
  const left = w.exercises.slice(-2);
  const id = C.makeCarry(WID, w.exercises, left, "2026-10-22");
  C.setPlan(id, { hide: [...C.planOf(id).hide, left[0].swappedFrom || left[0].id] });
  assert.equal(T.workoutOf(id).exercises.length, 1);
  assert.equal(C.planEdited(id), true);
  C.resetPlan(id);
  assert.equal(T.workoutOf(id).exercises.length, 2, "вернулся состав добора, а не вся тренировка");
  C.dropCarry(id);
  assert.equal(T.workoutOf(id), null);
  assert.equal(S.plan[id], undefined);
  assert.deepEqual(C.carryList(), []);
});

test("добор не считается новым прохождением: следующая тренировка та же", () => {
  reset();
  S.sessions = [{ id: "1", workoutId: WID, date: "2026-10-21", entries: {} }];
  const next = T.nextWorkoutId();
  assert.notEqual(next, WID);
  S.sessions.push({ id: "2", workoutId: WID, carry: true, date: "2026-10-22", entries: {} });
  assert.equal(T.nextWorkoutId(), next);
});

test("тоннаж недели: добор прибавляется к первой части, а не заменяет её", () => {
  const wk = PROGRAM.weeks.find((x) => x.workouts.some((w) => w.id === WID));
  const s1 = { workoutId: WID, entries: { bench: [{ w: 100, r: 5 }] } };
  const s2 = { workoutId: WID, carry: true, entries: { row: [{ w: 60, r: 10 }] } };
  assert.equal(weekTonnage(wk, [s1, s2]).kg, 1100);
  assert.equal(weekTonnage(wk, [s1, s2]).quests, 1);
  const again = { workoutId: WID, entries: { bench: [{ w: 100, r: 3 }] } };
  assert.equal(weekTonnage(wk, [s1, s2, again]).kg, 300, "новый заход заменяет прошлый вместе с добором");
});

test("кривой добор с сервера игнорируется", () => {
  reset();
  S.carry = { "c-bad!": { from: WID, date: "2026-10-22", plan: {} }, "c-abcd1": { from: "nope", date: "2026-10-22", plan: {} },
    "c-abcd2": { from: WID, date: "x", plan: {} }, "c-abcd3": [], "c-abcd4": { from: WID, date: "2026-10-22", plan: {} } };
  assert.deepEqual(C.carryList(), ["c-abcd4"]);
  assert.equal(T.workoutOf("c-bad!"), null);
  S.carry = "x";
  assert.deepEqual(C.carryList(), []);
});
