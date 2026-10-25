// Расширенный пул движений: всё, что можно выбрать для замены и добавления, — с весом,
// значком, зонами нагрузки для жалоб и находится поиском.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EXERCISES, EQUIP, EQUIP_STEP, exById, searchExercises, workingWeight } from "../data/exercises.js";
import { EXERCISES_MORE } from "../data/exercises-more.js";
import { AREAS, stressOf } from "../data/complaints.js";
import { BASELINES, PROGRAM, buildExercises } from "../data/program.js";
import { EQUIP_ICON, UI_ICONS } from "../data/icons-ui.js";

test("пул большой: основной + расширенный, без повторов id и имён", () => {
  assert.ok(EXERCISES.length >= 200, `всего ${EXERCISES.length}`);
  assert.ok(EXERCISES_MORE.length >= 130);
  assert.equal(new Set(EXERCISES.map((e) => e.id)).size, EXERCISES.length);
  assert.equal(new Set(EXERCISES.map((e) => e.name.toLowerCase())).size, EXERCISES.length);
});

test("специфические движения на месте и находятся поиском", () => {
  for (const id of ["jefferson-curl", "jefferson-dl", "nordic", "reverse-nordic", "sissy", "copenhagen", "meadows", "z-press", "bayesian", "kb-swing", "pendlay", "zercher"]) {
    assert.ok(exById(id), `нет ${id}`);
  }
  assert.deepEqual(searchExercises("джефферсон").map((e) => e.id).sort(), ["jefferson-curl", "jefferson-dl"]);
  assert.ok(searchExercises("гиря").length >= 4, "гиря — снаряд, ищется по нему");
});

test("с весом — значит вес предлагается; свой вес без довеска — нет", () => {
  for (const e of EXERCISES_MORE) {
    const w = workingWeight(e, { baselines: BASELINES, bodyweight: 90, reps: [8, 10] });
    if (e.k > 0 && !e.bw) assert.ok(w.source === "estimate" && w.hi > 0, `${e.id}: вес не посчитан`);
    if (!e.k) assert.equal(w.source, "none", `${e.id}: своему весу вес не нужен`);
    if (e.equip === "bw") assert.ok(!e.k, `${e.id}: у движений со своим весом k = 0`);
  }
});

test("гиря: снаряд с шагом и значком", () => {
  assert.equal(EQUIP.kb, "Гиря");
  assert.ok(EQUIP_STEP.kb > 0);
  assert.ok(UI_ICONS[EQUIP_ICON.kb]);
  const w = workingWeight(exById("kb-swing"), { baselines: BASELINES, reps: [10, 15] });
  assert.equal(w.hi % EQUIP_STEP.kb, 0, "вес гири кратен шагу");
});

test("зоны нагрузки расширенного пула попадают в жалобы", () => {
  for (const e of EXERCISES_MORE) {
    for (const [area, lvl] of Object.entries(e.load || {})) {
      assert.ok(AREAS[area], `${e.id}: неизвестная зона ${area}`);
      assert.ok(lvl === 1 || lvl === 2, `${e.id}: уровень ${lvl}`);
      assert.equal(stressOf(e.id, area), lvl, `${e.id}: ${area}`);
    }
  }
  assert.equal(stressOf("jefferson-curl", "lowback"), 2, "Jefferson curl сильно грузит поясницу");
  assert.equal(stressOf("bench", "shoulder"), 1, "основной пул не переписан");
});

test("программа цикла собирается из основного пула, расширенный — только по выбору", () => {
  const more = new Set(EXERCISES_MORE.map((e) => e.id));
  const used = PROGRAM.weeks.flatMap((w) => w.workouts).flatMap((w) => buildExercises(w)).map((x) => x.id);
  assert.ok(used.length > 50, "программа собралась");
  for (const id of used) assert.ok(!more.has(id), `${id} попал в программу без решения`);
});
