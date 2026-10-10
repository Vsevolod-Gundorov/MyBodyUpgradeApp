// Модель профиля: сохранение из мастера, нормы по дням, ручные нормы, поправка по весу, тип дня.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const store = await import("../js/model/store.js");
const P = await import("../js/model/profile.js");
const N = await import("../js/model/nutrition.js");
const { BASELINES } = await import("../data/program.js");

const FORM = { name: "Анна", sex: "f", age: 29, height: 168, weight: 64.5, direction: "cut", pace: "normal", program: "protein", activity: "light", experience: "beginner", custom: { protein: 2, fat: 0.9 } };
beforeEach(() => { mem.clear(); store.reloadState(); });

test("без профиля — прежние нормы и максимумы, ничего не ломается", () => {
  assert.equal(P.hasProfile(), false);
  assert.equal(P.targetsFor("training").kcal, 3150);
  assert.deepEqual(P.baselines(), BASELINES);
});

test("новый человек: профиль, вес в истории, стартовые максимумы — свои, а не чужие", () => {
  const r = P.saveProfile(FORM);
  assert.equal(r.ok, true);
  assert.equal(P.hasProfile(), true);
  assert.equal(store.S.hero.name, "Анна");
  assert.deepEqual(P.weightLog().map((w) => w.kg), [64.5]);
  assert.equal(P.currentWeight(), 64.5);
  assert.equal(store.S.profile.maxesSource, "estimated");
  assert.ok(P.baselines().bench < 50, "у новичка 64 кг жим не 147");
  const tr = P.targetsFor("training"), rs = P.targetsFor("rest");
  assert.ok(tr.kcal > rs.kcal && tr.protein === rs.protein);
});

test("у кого есть журнал — максимумы прежние: рабочие веса не меняются задним числом", () => {
  store.S.sessions.push({ id: "s1", workoutId: "w1u", date: "2026-10-01", entries: {}, score: 90 });
  P.saveProfile({ ...FORM, sex: "m", weight: 93, experience: "intermediate" });
  assert.deepEqual(P.baselines(), BASELINES);
  assert.equal(store.S.profile.maxesSource, "journal");
});

test("введённые результаты главнее оценки и переживают правку профиля", () => {
  P.saveProfile({ ...FORM, maxes: { bench: 50, squat: 60, deadlift: 80, ohp: 30 } });
  P.saveProfile({ ...FORM, height: 170 });
  assert.equal(P.baselines().bench, 50);
});

test("вес: запись на день заменяет прежнюю, история по порядку, свежий вес — в расчётах", () => {
  P.saveProfile(FORM);
  P.logWeight(64, "2026-10-01"); P.logWeight(63.6, "2026-10-08"); P.logWeight(63.8, "2026-10-08");
  assert.deepEqual(P.weightLog().map((w) => w.date).slice(0, 2), ["2026-10-01", "2026-10-08"]);
  assert.equal(P.weightLog().find((w) => w.date === "2026-10-08").kg, 63.8);
  assert.equal(P.logWeight(5), false, "неправдоподобный вес не пишется");
});

test("смена цели и программы; ручные нормы главнее расчёта и снимаются", () => {
  P.saveProfile(FORM);
  const before = P.targetsFor("rest").kcal;
  assert.equal(P.setNutritionPlan({ direction: "maintain", program: "balanced" }).ok, true);
  assert.ok(P.targetsFor("rest").kcal > before);
  assert.equal(P.setNutritionPlan({ direction: "maintain", program: "custom", custom: { protein: 9, fat: 1 } }).ok, false);
  P.setOverride("rest", { kcal: 1800, protein: 130, fat: 60, carbs: 180 });
  assert.deepEqual([P.targetsFor("rest").kcal, P.targetsFor("rest").manual], [1800, true]);
  assert.ok(P.targetsFor("rest").water > 0, "вода и клетчатка остаются расчётными");
  P.setOverride("rest", null);
  assert.equal(P.targetsFor("rest").manual, false);
});

test("поправка по весу: предлагается при расхождении, после ответа молчит неделю", () => {
  P.saveProfile({ ...FORM, sex: "m", weight: 95, height: 182, activity: "moderate" });
  const now = new Date();
  const day = (d) => new Date(now.getTime() - d * 864e5).toISOString().slice(0, 10);
  // план −0,4 кг/нед (урезан до безопасного), а вес стоит на месте
  for (let i = 0; i < 10; i++) P.logWeight(95 + (i % 2 ? 0.1 : -0.1), day(20 - i * 2));
  const s = P.adjustSuggestion(now);
  assert.ok(s && s.kcal < 0, JSON.stringify(s));
  const k = P.targetsFor("rest").kcal;
  P.applyAdjust(s.kcal);
  assert.equal(P.targetsFor("rest").kcal, Math.max(k + s.kcal, P.plan().floor), "поправка ложится на норму, но не ниже безопасного минимума");
  assert.ok(P.targetsFor("training").kcal < P.plan().maintenance.training);
  assert.equal(P.adjustSuggestion(now), null, "неделю после применения — тихо");
  store.S.profile.adjustedAt = null; P.dismissAdjust();
  assert.equal(P.adjustSuggestion(now), null, "и после «Не сейчас»");
});

test("на безопасном минимуме дефицит не предлагается", () => {
  P.saveProfile({ ...FORM, sex: "f", age: 60, height: 150, weight: 45, activity: "sedentary", pace: "fast" });
  const now = new Date();
  const day = (d) => new Date(now.getTime() - d * 864e5).toISOString().slice(0, 10);
  for (let i = 0; i < 10; i++) P.logWeight(45, day(20 - i * 2));
  assert.equal(P.adjustSuggestion(now), null);
});

test("тип дня: закрытая тренировка делает день тренировочным, ручной выбор главнее", () => {
  N.markTrainingDay("2026-10-10");
  assert.equal(store.S.nutrition.log["2026-10-10"].dayType, "training");
  N.setDayType("2026-10-11", "rest");
  N.markTrainingDay("2026-10-11");
  assert.equal(store.S.nutrition.log["2026-10-11"].dayType, "rest");
});
