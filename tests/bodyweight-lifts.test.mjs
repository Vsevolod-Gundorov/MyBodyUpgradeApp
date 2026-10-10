// Подтягивания и брусья с довеском: рабочие подходы засчитываются, вес тела — на дату
// подхода, после «не дотянул» вес не растёт, потолок можно задать своим подходом.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isWarmup, judge, progressionOf } from "../data/progression.js";

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { S } = await import("../js/model/store.js");
const T = await import("../js/model/training.js");
const { sessionExercises } = await import("../js/model/catalog.js");
const { exById } = await import("../data/exercises.js");

const BW = { bw: true, bodyweight: 97 };
const plan = { sets: 4, reps: [6, 8], rir: 1 };
const h = (date, sets, bodyweight, p = plan) => ({ date, sets, bodyweight, plan: p });

test("довесок 15 при рабочих 25 и весе 97 — рабочий подход, а не разминка", () => {
  assert.equal(isWarmup({ w: 15, r: 8 }, 25, BW), false, "112 из 122 кг — 92%");
  assert.equal(isWarmup({ w: 15, r: 8 }, 25), true, "у штанги 15 при 25 — разминка");
  assert.equal(isWarmup({ w: 0, r: 10 }, 25, BW), false, "без пояса — тоже подход");
  // в разборе дня засчитываются все три рабочих подхода
  assert.equal(judge([{ w: 10, r: 8 }, { w: 15, r: 8 }, { w: 20, r: 8 }], { sets: 3, reps: [6, 10] }, true, { bodyweight: 93 }).work, 3);
});

test("пол считается от полной нагрузки: 20 кг на поясе при рабочих 25 — не недобор", () => {
  const p = progressionOf([h("2026-09-01", [{ w: 25, r: 8 }, { w: 25, r: 8 }, { w: 25, r: 8 }, { w: 25, r: 8 }], 97)], { reps: [6, 8], rir: 1, sets: 4, equip: "bwp", ...BW });
  assert.ok(p.floor <= 15, `пол ${p.floor}: 90% от 122 кг — это ~13 кг довеска, а не 22,5`);
});

test("стал тяжелее — старые подтягивания не дорожают задним числом", () => {
  const hist = (bw) => [h("2026-08-11", [{ w: 20, r: 8 }, { w: 20, r: 8 }, { w: 20, r: 8 }, { w: 20, r: 8 }], bw)];
  const was93 = progressionOf(hist(93), { reps: [6, 8], rir: 1, sets: 4, equip: "bwp", ...BW });
  const as97 = progressionOf(hist(97), { reps: [6, 8], rir: 1, sets: 4, equip: "bwp", ...BW });
  assert.ok(was93.target < as97.target, `${was93.target} при весе 93 тогда должно быть меньше ${as97.target}`);
  assert.ok(was93.target <= 20, "та же нагрузка при +4 кг тела — довеска меньше");
});

test("20 × 7, 6, 5 — вес не растёт, пока не закрыт верх коридора", () => {
  const hist = [
    h("2026-08-11", [{ w: 10, r: 8 }, { w: 15, r: 8 }, { w: 20, r: 8 }], 93, { sets: 3, reps: [6, 10], rir: 1 }),
    h("2026-09-05", [{ w: 20, r: 7 }, { w: 20, r: 6 }, { w: 20, r: 5 }], 93, { sets: 4, reps: [6, 10], rir: 1 }),
  ];
  const p = progressionOf(hist, { reps: [6, 8], rir: 1, sets: 4, equip: "bwp", ...BW });
  assert.ok(p.target <= 17.5, `при весе 97 та же нагрузка — ~16 кг, назначено ${p.target}`);
  assert.notEqual(p.move, "light", "это не лёгкий день, а честный недобор");
  // закрыл 6–8 на этом весе — шаг вверх, а не прыжок к старому уровню
  const next = progressionOf([...hist, h("2026-09-12", Array.from({ length: 4 }, () => ({ w: p.target, r: 8 })), 97)], { reps: [6, 8], rir: 1, sets: 4, equip: "bwp", ...BW });
  assert.ok(next.target - p.target <= 2.5, `после закрытия — один шаг: ${p.target} → ${next.target}`);
  assert.ok(next.target > p.target, "и всё-таки вверх");
});

test("подходы к движению вне состава тренировки попадают в историю", () => {
  const sess = { id: "s1", workoutId: "t7", date: "2026-09-05", entries: { deadlift: [{ w: 200, r: 5 }], pullup: [{ w: 20, r: 7 }, { w: 20, r: 6 }] } };
  const list = sessionExercises(sess);
  const pull = list.find((x) => x.id === "pullup");
  assert.ok(pull, "подтягивания, добавленные в тот день, не потерялись");
  assert.equal(pull.sets, 2); assert.ok(pull.recovered);
  assert.equal(sessionExercises({ ...sess, entries: { ...sess.entries, "../evil": [{ w: 1, r: 1 }] } }).some((x) => x.id === "../evil"), false, "неизвестные id не попадают");
});

test("потолок по своему подходу: «25 × 5 на пределе» при весе 97", () => {
  S.sessions = []; S.workReset = {}; S.body = { weights: [{ date: "2026-10-10", kg: 97 }] }; S.hero.bodyweight = 97;
  T.invalidateE1RM();
  assert.equal(T.setWorkFromSet("pullup", 25, 0), null, "ноль повторов — не подход");
  assert.equal(T.setWorkFromSet("pullup", -5, 5), null);
  assert.equal(T.setWorkFromSet("bench", 0, 5), null, "у штанги вес обязателен");
  T.setWorkFromSet("pullup", 25, 5);
  const p = T.progressOf(exById("pullup"), { reps: [6, 8], rir: 1, sets: 4 });
  assert.equal(p.source, "manual");
  assert.ok(p.target < 25 && p.target >= 0, `на 4 × 6–8 — легче, чем предельные 25 × 5: ${p.target}`);
  // без пояса на пределе 8 раз — довесок 0
  T.setWorkFromSet("pullup", 0, 8);
  assert.equal(T.progressOf(exById("pullup"), { reps: [6, 8], rir: 1, sets: 4 }).target, 0);
});
