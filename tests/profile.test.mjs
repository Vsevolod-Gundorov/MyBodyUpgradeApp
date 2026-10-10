// Профиль атлета: обмен, нормы по дням, программы питания, сверка с весом, стартовые максимумы.
import { test } from "node:test";
import assert from "node:assert/strict";
import { adaptiveAdjust, bmr, checkProfile, computeTargets, estimateMaxes, oneRepMax, proteinWeight, weightTrend } from "../data/profile.js";

const ME = { sex: "m", age: 30, height: 180, weight: 93, activity: "moderate", direction: "maintain", pace: "normal", program: "balanced" };

test("основной обмен: Миффлин — Сан Жеор, эталонные значения", () => {
  assert.equal(bmr({ sex: "m", weight: 80, height: 180, age: 30 }), 1780);   // 800 + 1125 − 150 + 5
  assert.equal(bmr({ sex: "f", weight: 60, height: 165, age: 30 }), 1320.25); // 600 + 1031,25 − 150 − 161
});

test("день тренировки дороже дня отдыха ровно на тренировку, белок и жиры одинаковые", () => {
  const t = computeTargets(ME);
  assert.equal(t.maintenance.training - t.maintenance.rest, Math.round(4.4 * 93 / 10) * 10);
  assert.equal(t.training.protein, t.rest.protein);
  assert.equal(t.training.fat, t.rest.fat);
  assert.ok(t.training.carbs > t.rest.carbs, "разница — в углеводах");
  assert.equal(t.training.water - t.rest.water, 500);
  for (const d of [t.training, t.rest]) {
    const kcal = d.protein * 4 + d.fat * 9 + d.carbs * 4;
    assert.ok(Math.abs(kcal - d.kcal) <= 15, `БЖУ сходятся с калориями: ${kcal} vs ${d.kcal}`);
  }
});

test("цель: дефицит по темпу, но не глубже 25% и не ниже безопасного минимума", () => {
  const cut = computeTargets({ ...ME, direction: "cut", pace: "normal" });
  const keep = computeTargets(ME);
  assert.ok(Math.abs((keep.weekly - cut.weekly) - 550) <= 10, "−0,5 кг/нед ≈ −550 ккал/день");
  assert.equal(cut.expectedKgPerWeek, -0.5);
  const tiny = computeTargets({ sex: "f", age: 60, height: 150, weight: 45, activity: "sedentary", direction: "cut", pace: "fast", program: "balanced" });
  assert.ok(tiny.rest.kcal >= 1200, "не ниже 1200 ккал для женщин");
  const bulk = computeTargets({ ...ME, direction: "bulk", pace: "normal" });
  assert.ok(bulk.weekly > keep.weekly && bulk.expectedKgPerWeek > 0);
  const rc = computeTargets({ ...ME, direction: "recomp" });
  assert.equal(rc.training.kcal, keep.training.kcal, "рекомпозиция: в день тренировки — поддержание");
  assert.ok(rc.rest.kcal < keep.rest.kcal, "в день отдыха — небольшой дефицит");
  assert.equal(rc.expectedKgPerWeek, 0);
});

test("программы питания: белок по весу, кето ≤ 30 г углеводов, низкоуглеводная ~20%", () => {
  const hp = computeTargets({ ...ME, direction: "cut", program: "protein" });
  assert.equal(hp.rest.protein, Math.round(2.4 * 93));
  const keto = computeTargets({ ...ME, program: "keto" });
  assert.equal(keto.training.carbs, 30);
  assert.ok(keto.training.fat > keto.rest.fat, "на кето разница дней — в жирах");
  const lc = computeTargets({ ...ME, program: "lowcarb" });
  assert.ok(Math.abs((lc.rest.carbs * 4) / lc.rest.kcal - 0.2) < 0.02);
  const own = computeTargets({ ...ME, program: "custom", custom: { protein: 1.5, fat: 1 } });
  assert.deepEqual([own.rest.protein, own.rest.fat], [Math.round(1.5 * 93), 93]);
});

test("белок при ожирении считается от скорректированного веса", () => {
  assert.equal(proteinWeight({ weight: 80, height: 180 }), 80);
  const pw = proteinWeight({ weight: 140, height: 175 });
  assert.ok(pw > 76 && pw < 100, String(pw));
});

test("клетчатка 14 г на 1000 ккал, вода 35 мл/кг", () => {
  const t = computeTargets(ME);
  assert.equal(t.rest.fiber, Math.max(25, Math.round(t.rest.kcal / 1000 * 14)));
  assert.equal(t.rest.water, Math.round(35 * 93 / 50) * 50);
});

test("проверка ввода профиля", () => {
  assert.equal(checkProfile(ME), null);
  assert.equal(checkProfile({ ...ME, age: 9 }), "age");
  assert.equal(checkProfile({ ...ME, height: 300 }), "height");
  assert.equal(checkProfile({ ...ME, sex: "x" }), "sex");
  assert.equal(checkProfile({ ...ME, program: "custom", custom: { protein: 5, fat: 1 } }), "custom_protein");
  assert.equal(checkProfile({ ...ME, program: "custom", custom: { protein: 2, fat: 1 } }), null);
});

test("тренд веса и сверка: нужно 6+ взвешиваний на 14+ днях; поправка шагом 50, не больше ±300", () => {
  const now = new Date("2026-10-21T12:00:00Z");
  const day = (d) => new Date(now.getTime() - d * 864e5).toISOString().slice(0, 10);
  assert.equal(weightTrend([{ date: day(1), kg: 90 }, { date: day(2), kg: 90 }], now), null);
  // худеет по 0,2 кг в неделю, а план −0,5
  const slow = Array.from({ length: 10 }, (_, i) => ({ date: day(20 - i * 2), kg: 90 - (0.2 / 7) * (i * 2) }));
  const tr = weightTrend(slow, now);
  assert.ok(Math.abs(tr.kgPerWeek - -0.2) < 0.02, JSON.stringify(tr));
  const adj = adaptiveAdjust(slow, -0.5, now);
  assert.ok(adj.kcal < 0 && adj.kcal % 50 === 0 && adj.kcal >= -300, JSON.stringify(adj));
  // идёт по плану — молчим
  const ok = Array.from({ length: 10 }, (_, i) => ({ date: day(20 - i * 2), kg: 90 - (0.5 / 7) * (i * 2) }));
  assert.equal(adaptiveAdjust(ok, -0.5, now), null);
});

test("стартовые максимумы: по полу, весу, опыту, с запасом; новичку — меньше", () => {
  const nov = estimateMaxes({ sex: "m", weight: 80, age: 25, experience: "novice" });
  const adv = estimateMaxes({ sex: "m", weight: 80, age: 25, experience: "advanced" });
  assert.equal(nov.bench, Math.round(0.5 * 80 * 0.9 / 2.5) * 2.5);
  assert.ok(adv.squat > nov.squat * 2);
  const f = estimateMaxes({ sex: "f", weight: 60, age: 25, experience: "beginner" });
  assert.ok(f.bench < nov.bench);
  const old = estimateMaxes({ sex: "m", weight: 80, age: 60, experience: "advanced" });
  assert.ok(old.deadlift < adv.deadlift, "после 40 — поправка на возраст");
  for (const v of Object.values(nov)) assert.equal(v % 2.5, 0, "кратно шагу блинов");
});

test("1ПМ по подходу: Эпли + Бжицки, кратно 2,5", () => {
  assert.equal(oneRepMax(100, 1), 100);
  assert.equal(oneRepMax(100, 5), 115);
  assert.equal(oneRepMax(0, 5), 0);
  assert.equal(oneRepMax(100, 20), oneRepMax(100, 10), "повторы выше 10 не завышают оценку");
});
