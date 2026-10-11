// Знакомство: коротко, картинками, одним касанием. Проверяем разметку шагов без браузера.
import { test } from "node:test";
import assert from "node:assert/strict";

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const V = await import("../js/view/onboarding.js");
const { computeTargets, estimateMaxes } = await import("../data/profile.js");

const f = { name: "<b>x</b>", sex: "m", age: 30, height: 182, weight: 97, direction: "cut", pace: "normal", program: "balanced",
  custom: { protein: 2, fat: 0.9 }, activity: "moderate", experience: "intermediate", knowMaxes: false, sets: {} };

test("не больше шести экранов, и на четырёх из них ответ — одно касание", () => {
  assert.ok(V.STEPS.length <= 6, `шагов ${V.STEPS.length}`);
  assert.deepEqual([...V.AUTO_STEPS].sort(), ["activity", "experience", "goal", "sex"]);
  assert.equal(V.STEPS[V.STEPS.length - 1], "plan", "в конце — готовый план");
});

test("вопросы-плитки: у каждой варианта есть картинка и короткая подпись", () => {
  for (const html of [V.sexStepView(f), V.goalStepView(f), V.activityStepView(f), V.experienceStepView(f)]) {
    const tiles = html.match(/class="ob-tile[ "]/g) || [];
    assert.ok(tiles.length >= 2, "есть плитки");
    assert.equal((html.match(/<svg/g) || []).length >= tiles.length, true, "у каждой плитки — картинка");
    assert.ok(!/<span>[^<]{60,}/.test(html), "без длинных абзацев");
  }
  // пока ответа нет, кнопки «Далее» нет: ответ — само касание
  assert.match(V.wizardView({ step: "goal", editing: false, answered: false }), /class="ob-foot" hidden/);
  assert.doesNotMatch(V.wizardView({ step: "body", editing: false }), /class="ob-foot" hidden/);
});

test("числа — ползунками с готовыми значениями, имя экранируется", () => {
  const html = V.bodyStepView(f, { withName: true });
  assert.equal((html.match(/type="range"/g) || []).length, 3);
  assert.match(html, /id="ob-weight"[^>]*value="97"/);
  assert.ok(!html.includes("<b>x</b>"), "имя экранировано");
  assert.equal((V.sexStepView(f, { askName: true }).match(/id="ob-name"/g) || []).length, 1);
});

test("план показывает калории и БЖУ обоих дней", () => {
  const t = computeTargets({ ...f, adjust: 0 });
  const html = V.planStepView({ f, t, maxes: estimateMaxes(f), maxesNote: "оценка" });
  assert.ok(html.includes(String(t.training.kcal)) && html.includes(String(t.rest.kcal)));
  for (const k of ["Белки", "Жиры", "Углеводы"]) assert.ok(html.includes(k));
  assert.match(html, /data-group="program"/, "программу можно поменять тут же");
});
