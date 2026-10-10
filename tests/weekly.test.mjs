// Итоги недели: тренировки, тоннаж и его динамика, рекорды, вес по тренду, питание.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { S } = await import("../js/model/store.js");
const W = await import("../js/model/weekly.js");
const { invalidateE1RM } = await import("../js/model/training.js");
const { addDays, isoWeekStart, today } = await import("../js/core/format.js");

const MON = isoWeekStart(today());
const PREV = addDays(MON, -7);
const sess = (date, w, r = 5, id = "bench") => ({ id: `${date}-${id}-${w}`, workoutId: "x", date, score: 90, exercises: [{ id, name: "Жим", sets: 3, reps: [4, 6], lift: id === "bench" ? "bench" : undefined }], entries: { [id]: [{ w, r }, { w, r }, { w, r }] } });

beforeEach(() => {
  S.sessions = []; S.nutrition = { log: {} }; S.body = { weights: [] }; S.profile = null;
  invalidateE1RM();
});

test("пустая неделя — нули и прочерки, без падений", () => {
  const w = W.weekSummary();
  assert.equal(w.start, MON); assert.equal(w.end, addDays(MON, 6)); assert.ok(w.current);
  assert.equal(w.sessions, 0); assert.equal(w.goal, 3); assert.equal(w.tonnage, 0); assert.equal(w.tonnageDelta, null);
  assert.deepEqual(w.prs, []); assert.equal(w.weight.change, null); assert.equal(w.nutrition.logged, 0);
});

test("тренировки, тоннаж к прошлой неделе и рекорды", () => {
  S.sessions = [sess(PREV, 100), sess(MON, 110)];
  invalidateE1RM();
  const w = W.weekSummary(MON);
  assert.equal(w.sessions, 1);
  assert.equal(w.tonnage, 110 * 5 * 3);
  assert.equal(w.tonnageDelta, 10, "+10% к прошлой неделе");
  assert.equal(w.prs.length, 1); assert.equal(w.prs[0].name, "Жим лёжа"); assert.ok(w.prs[0].kg > w.prs[0].before);
  // первая в жизни тренировка — не рекорд: побивать было нечего
  assert.equal(W.weekSummary(PREV).prs.length, 0);
});

test("вес за неделю — по тренду; питание — дни в норме", () => {
  S.body.weights = [{ date: addDays(PREV, 0), kg: 90 }, { date: addDays(PREV, 3), kg: 90 }, { date: MON, kg: 89 }];
  const w = W.weekSummary(MON);
  assert.ok(w.weight.change < 0 && w.weight.change > -1, `тренд сглаживает: ${w.weight.change}`);
  S.nutrition.log[MON] = { dayType: "rest", items: [{ n: "x", g: 100, k: 2750, p: 300, f: 0, cb: 0 }] };
  const n = W.weekSummary(MON).nutrition;
  assert.equal(n.logged, 1); assert.equal(n.protein, 1); assert.equal(n.avgKcal, 2750);
});

test("первая неделя — самая ранняя запись любого вида", () => {
  S.body.weights = [{ date: addDays(PREV, -14), kg: 90 }];
  assert.equal(W.firstWeek(), isoWeekStart(addDays(PREV, -14)));
});
