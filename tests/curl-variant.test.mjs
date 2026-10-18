// Сгибания ног лёжа без ягодиц: вес всегда легче обычных сгибаний лёжа, а разовая
// замена «на сегодняшней тренировке» срабатывает ровно один раз и только в свой день.
import { test } from "node:test";
import assert from "node:assert/strict";

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { S } = await import("../js/model/store.js");
const T = await import("../js/model/training.js");
const { ORDER, planOf } = await import("../js/model/catalog.js");
const { runOneOffs, swapTodayCurl, todayWorkoutId } = await import("../js/model/oneoff.js");
const { exById } = await import("../data/exercises.js");

const NG = exById("legcurl-l-ng"), L = exById("legcurl-l");
const opts = { reps: [8, 10], rir: 1, sets: 3 };
const reset = () => { S.sessions = []; S.plan = {}; S.oneOff = {}; S.workReset = {}; S.questStart = {}; S.questTicks = {}; S.cycleStart = 0; T.invalidateE1RM(); };

test("новое упражнение — бицепс бедра, изоляция, легче обычных сгибаний лёжа", () => {
  assert.ok(NG, "есть в справочнике");
  assert.equal(NG.group, "hams"); assert.equal(NG.tier, 3); assert.equal(NG.equip, "machine");
  assert.equal(NG.from, "legcurl-l"); assert.ok(NG.fk < 1 && NG.k < L.k);
});

test("без журнала: оценка от становой, на 15% легче обычных сгибаний", () => {
  reset();
  const a = T.progressOf(NG, opts), b = T.progressOf(L, opts);
  assert.ok(a.target > 0 && a.target < b.target, `${a.target} должно быть меньше ${b.target}`);
});

test("с журналом обычных сгибаний: от твоего рабочего веса × 0,85", () => {
  reset();
  // обычные сгибания лёжа 60 кг × 10, трижды — в тренировке, где они стоят по плану
  const wid = "w1f";
  S.sessions = ["2026-09-01", "2026-09-08", "2026-09-15"].map((date, i) => ({ id: `s${i}`, workoutId: wid, date,
    entries: { "legcurl-l": [{ w: 60, r: 10 }, { w: 60, r: 10 }, { w: 60, r: 10 }] } }));
  T.invalidateE1RM();
  const b = T.progressOf(L, opts), a = T.progressOf(NG, opts);
  assert.ok(b.target >= 55, `обычные идут от журнала: ${b.target}`);
  assert.ok(a.target < b.target, `без ягодиц легче: ${a.target} < ${b.target}`);
  assert.ok(a.work1RM < b.work1RM * 0.86 && a.work1RM > b.work1RM * 0.84, "максимум — 85% от обычных");
  assert.ok(b.target - a.target >= (a.step || 5), "на тренажёре — минимум на шаг ниже, даже если 15% съедает округление");
});

test("замена в сегодняшней тренировке: сгибания → без ягодиц, один раз", () => {
  reset();
  S.cycleStart = ORDER.indexOf("w1f");   // сегодня — тренировка со сгибаниями лёжа
  const wid = T.nextWorkoutId();
  const before = T.workoutOf(wid).exercises.find((x) => /^legcurl/.test(x.id));
  assert.ok(before, `в ${wid} есть сгибания`);
  assert.equal(runOneOffs("2026-10-18"), true);
  const after = T.workoutOf(wid).exercises;
  assert.ok(after.some((x) => x.id === "legcurl-l-ng"), "заменено");
  assert.ok(!after.some((x) => x.id === before.id), "старых сгибаний нет");
  assert.ok(after.find((x) => x.id === "legcurl-l-ng").w > 0, "вес посчитан");
  // повторно — ничего: отметка стоит
  S.plan = {};
  assert.equal(runOneOffs("2026-10-18"), false);
  assert.deepEqual(planOf(wid), {}, "второй раз не меняет");
});

test("просрочено или уже тренировался сегодня — не трогаем", () => {
  reset();
  S.cycleStart = ORDER.indexOf("w1f");
  assert.equal(runOneOffs("2026-10-25"), false, "через неделю правка неуместна");
  assert.deepEqual(S.plan, {});
  reset();
  S.sessions = [{ id: "x", workoutId: ORDER[0], date: "2026-10-18", entries: {} }];
  assert.equal(swapTodayCurl("2026-10-18"), false, "сегодняшняя уже закрыта — следующую не трогаем");
});

test("сегодняшняя — та, что сегодня открыта, а не просто следующая по плану", () => {
  reset();
  const at = (iso) => new Date(iso).getTime();
  S.questStart = { w2l: at("2026-10-17T18:00:00Z"), w3l: at("2026-10-18T07:30:00Z") };
  S.questTicks = { w3l: [at("2026-10-18T07:40:00Z")] };
  assert.equal(todayWorkoutId("2026-10-18"), "w3l", "открыта сегодня — она и есть сегодняшняя");
  assert.equal(todayWorkoutId("2026-10-20"), T.nextWorkoutId(), "сегодня ничего не открывали — следующая по плану");
  assert.equal(swapTodayCurl("2026-10-18"), true);
  assert.ok(T.workoutOf("w3l").exercises.some((x) => x.id === "legcurl-l-ng"), "замена — в открытой сегодня тренировке");
});

test("в подписи видно, откуда вес: от своих сгибаний лёжа, а не от становой", async () => {
  reset();
  S.sessions = ["2026-09-01", "2026-09-08"].map((date, i) => ({ id: `s${i}`, workoutId: "w1f", date,
    entries: { "legcurl-l": [{ w: 60, r: 10 }, { w: 60, r: 10 }, { w: 60, r: 10 }] } }));
  T.invalidateE1RM();
  const { moveLabel, stateOf } = await import("../data/progression.js");
  const a = T.progressOf(NG, opts);
  assert.match(moveLabel(a).text, /от твоих «сгибания лёжа» −15%/);
  assert.match(stateOf(a).text, /−15%/);
  reset();
  assert.equal(moveLabel(T.progressOf(NG, opts)).text, "оценка от базовых лифтов", "журнала нет — честно: от базовых");
});
