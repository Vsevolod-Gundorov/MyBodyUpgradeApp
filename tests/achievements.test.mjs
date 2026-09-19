// Тесты бизнес-логики достижений: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { ACHIEVEMENTS, ACH_BY_ID, TIERS, TIER_ORDER, evaluate, migrateLegacyStatuses, summary } from "../data/achievements.js";
import { GAME_ICONS } from "../data/icons.js";
import { ACHIEVEMENT_ICONS } from "../data/icons-achievements.js";

const ICONS = Object.assign({}, GAME_ICONS, ACHIEVEMENT_ICONS);

// базовый «пустой» контекст новичка
const base = (over = {}) => ({
  event: { type: "silent" },
  session: null,
  hero: { level: 1, xp: 0, stats: { СИЛА: 62, МОЩЬ: 60, ВЫНОСЛ: 40, ОБЪЁМ: 0, ДИСЦИПЛ: 0, СТОЙКОСТЬ: 0 }, cls: { novice: true, hybrid: false }, bodyweight: 93 },
  lifts: { bench: { cur: 147, base: 147 }, squat: { cur: 170, base: 170 }, deadlift: { cur: 195, base: 195 }, ohp: { cur: 100, base: 100 } },
  totals: { sessions: 0, cycles: 0, sagaStrength: false, sagaVolume: false, lifetimeT: 0, big3: 512, avgGain: 0, weekStreak: 0, maxWeek: 0, goldStreak: 0 },
  nutrition: { daysLogged: 0, proteinDays: 0, waterDays: 0, kcalDays: 0, fiberDays: 0, fullDays: 0, distinctFoods: 0 },
  buffs: { takenTotal: 0, fullDays: 0, activeCount: 0, customCount: 0, checkedEver: false },
  meta: { exports: 0, imports: 0 },
  rng: () => 1, // судьба выключена
  ...over,
});
const sessionCtx = (session, over = {}) => base({ event: { type: "session" }, session: { score: 0, doneSets: 0, plannedSets: 30, tonn: 0, durationSec: 0, prLifts: [], prMain: false, firstClear: false, hour: 12, feel: "norm", totalReps: 0, gapDays: 1, ...session }, ...over });
const ids = (r) => r.unlocked.map((u) => u.ach.id).sort();

test("каталог: ровно 100 достижений, уникальные id и имена, валидные ранги и иконки", () => {
  assert.equal(ACHIEVEMENTS.length, 100);
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, 100);
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.name)).size, 100);
  for (const a of ACHIEVEMENTS) {
    assert.ok(TIERS[a.tier], `ранг ${a.tier} у ${a.id}`);
    assert.ok(ICONS[a.icon], `нет иконки ${a.icon} у ${a.id}`);
    assert.ok(a.desc && a.name, `пустое описание у ${a.id}`);
    assert.equal(typeof a.test, "function");
    if (a.repeat) assert.equal(a.when, "session");
  }
  // все шесть рангов представлены
  for (const t of TIER_ORDER) assert.ok(ACHIEVEMENTS.some((a) => a.tier === t), `нет достижений ранга ${t}`);
  // ранги по возрастанию
  assert.deepEqual(TIER_ORDER.map((t) => TIERS[t].rank), [1, 2, 3, 4, 5, 6]);
});

test("новичок без данных не получает ничего", () => {
  const r = evaluate(base(), {}, "2026-09-19");
  assert.deepEqual(r.unlocked, []);
  assert.deepEqual(r.earned, {});
});

test("уникальное достижение выдаётся один раз и не дублируется при повторной проверке", () => {
  const ctx = base({ totals: { ...base().totals, sessions: 1 } });
  const r1 = evaluate(ctx, {}, "2026-09-01");
  assert.deepEqual(ids(r1), ["awakened"]);
  assert.equal(r1.earned.awakened.count, 1);
  assert.equal(r1.earned.awakened.first, "2026-09-01");
  const r2 = evaluate(ctx, r1.earned, "2026-09-02");
  assert.deepEqual(r2.unlocked, []);
  assert.equal(r2.earned.awakened.count, 1, "счётчик уникального не растёт");
  assert.equal(r2.earned.awakened.first, "2026-09-01");
});

test("повторяемое достижение растёт счётчиком и помечается isNew только в первый раз", () => {
  const ctx = sessionCtx({ score: 92 });
  const r1 = evaluate(ctx, {}, "2026-09-01");
  const u1 = r1.unlocked.find((u) => u.ach.id === "flawless");
  assert.ok(u1 && u1.isNew && u1.count === 1);
  const r2 = evaluate(ctx, r1.earned, "2026-09-03");
  const u2 = r2.unlocked.find((u) => u.ach.id === "flawless");
  assert.ok(u2 && !u2.isNew && u2.count === 2);
  assert.equal(r2.earned.flawless.first, "2026-09-01");
  assert.equal(r2.earned.flawless.last, "2026-09-03");
});

test("повторяемые проверяются только по событию «session»", () => {
  const ctx = base({ event: { type: "nutrition" }, session: { score: 100, doneSets: 30, plannedSets: 30, prLifts: ["bench", "squat"] } });
  const r = evaluate(ctx, {}, "2026-09-01");
  assert.ok(!ids(r).some((id) => ACH_BY_ID[id].repeat), "повторяемые не должны срабатывать вне сессии");
});

test("исходное earned не мутируется", () => {
  const earned = { awakened: { count: 1, first: "x", last: "x" } };
  const snapshot = JSON.stringify(earned);
  evaluate(sessionCtx({ score: 95 }, { totals: { ...base().totals, sessions: 10 } }), earned, "2026-09-01");
  assert.equal(JSON.stringify(earned), snapshot);
});

test("квест: счёт, подходы, рекорды, время, усталость, тоннаж", () => {
  const r = evaluate(sessionCtx({ score: 100, doneSets: 30, plannedSets: 30, tonn: 15200, durationSec: 3500, prLifts: ["bench", "squat"], prMain: true, firstClear: true, hour: 7, feel: "tired", totalReps: 320, gapDays: 20 }), {}, "2026-09-01");
  const got = ids(r);
  for (const id of ["firstblood", "overkill", "flawless", "perfect", "pr", "pr_double", "pr_main", "sprint", "dawn", "fatigue", "reps300", "comeback", "iron8", "iron10", "iron12", "iron15"]) assert.ok(got.includes(id), id);
  assert.ok(!got.includes("owl"));
});

test("квест: граничные условия не проходят", () => {
  const r = evaluate(sessionCtx({ score: 89, doneSets: 29, plannedSets: 30, tonn: 7999, durationSec: 3601, prLifts: [], hour: 9, feel: "norm", totalReps: 299, gapDays: 13 }), {}, "2026-09-01");
  assert.deepEqual(ids(r), []);
  const r2 = evaluate(sessionCtx({ score: 85, doneSets: 30, plannedSets: 30, durationSec: 0, hour: 22 }), {}, "2026-09-01");
  assert.ok(ids(r2).includes("overkill") && ids(r2).includes("owl"));
  assert.ok(!ids(r2).includes("sprint"), "без таймера «Молниеносный» не выдаётся");
});

test("путь героя и тоннаж: пороги по числу квестов, кругам и суммарным тоннам", () => {
  const r = evaluate(base({ totals: { ...base().totals, sessions: 100, cycles: 3, sagaStrength: true, sagaVolume: true, lifetimeT: 500 } }), {}, "d");
  const got = ids(r);
  for (const id of ["awakened", "grind10", "grind50", "grind100", "cycle1", "cycle3", "saga_str", "saga_vol", "life50", "life100", "life250", "life500"]) assert.ok(got.includes(id), id);
  for (const id of ["grind250", "grind500", "cycle6", "life1000", "life2500"]) assert.ok(!got.includes(id), id);
});

test("сила: клубы, троеборье, относительные и средний прирост", () => {
  const lifts = { bench: { cur: 170, base: 147 }, squat: { cur: 200, base: 170 }, deadlift: { cur: 240, base: 195 }, ohp: { cur: 120, base: 100 } };
  // при весе 100 кг становая 240 не дотягивает до 2,5× (нужно 250)
  const r = evaluate(base({ lifts, hero: { ...base().hero, bodyweight: 100 }, totals: { ...base().totals, big3: 610, avgGain: 0.12 } }), {}, "d");
  const got = ids(r);
  for (const id of ["bench150", "bench160", "bench170", "squat180", "squat200", "dl200", "dl220", "dl240", "ohp105", "ohp120", "total550", "total600", "squat2bw", "gain5", "gain10"]) assert.ok(got.includes(id), id);
  assert.ok(!got.includes("ohpbw"), "120 < 1,25×100");
  for (const id of ["squat220", "total650", "dl25bw", "gain20"]) assert.ok(!got.includes(id), id);
  // относительная сила считается от веса тела
  const r2 = evaluate(base({ lifts, hero: { ...base().hero, bodyweight: 80 } }), {}, "d");
  assert.ok(ids(r2).includes("dl25bw"), "240 ≥ 2.5×80");
});

test("дисциплина: серии недель и побед", () => {
  const r = evaluate(base({ totals: { ...base().totals, maxWeek: 3, weekStreak: 8, goldStreak: 5 } }), {}, "d");
  const got = ids(r);
  for (const id of ["week3", "streak4", "streak8", "gold3", "gold5"]) assert.ok(got.includes(id), id);
  for (const id of ["streak12", "gold10"]) assert.ok(!got.includes(id), id);
});

test("герой: уровни, класс, характеристики", () => {
  const stats = { СИЛА: 80, МОЩЬ: 91, ВЫНОСЛ: 80, ОБЪЁМ: 85, ДИСЦИПЛ: 99, СТОЙКОСТЬ: 88 };
  const r = evaluate(base({ hero: { level: 20, xp: 0, stats, cls: { novice: false, hybrid: true }, bodyweight: 93 } }), {}, "d");
  const got = ids(r);
  for (const id of ["lvl5", "lvl10", "lvl20", "class1", "hybrid", "stat75", "stat90", "all60", "all80"]) assert.ok(got.includes(id), id);
  assert.ok(!got.includes("lvl30"));
  const r2 = evaluate(base({ hero: { ...base().hero, stats: { ...stats, ОБЪЁМ: 59 } } }), {}, "d");
  assert.ok(!ids(r2).includes("all60") && !ids(r2).includes("all80"));
});

test("ресурсы и баффы: пороги по дням", () => {
  const r = evaluate(base({
    nutrition: { daysLogged: 30, proteinDays: 7, waterDays: 1, kcalDays: 7, fiberDays: 1, fullDays: 1, distinctFoods: 30 },
    buffs: { takenTotal: 100, fullDays: 7, activeCount: 3, customCount: 1, checkedEver: true },
    meta: { exports: 1, imports: 1 },
  }), {}, "d");
  const got = ids(r);
  for (const id of ["meal1", "protein1", "protein7", "water1", "kcal7", "full1", "fiber1", "foods30", "days30", "buff1", "buffday", "buff7", "custom", "sips100", "export1", "import1"]) assert.ok(got.includes(id), id);
  for (const id of ["protein30", "full7", "buff30"]) assert.ok(!got.includes(id), id);
});

test("судьба: выпадает только после квеста и по вероятности", () => {
  const lucky = sessionCtx({}, { rng: () => 0 });          // rng=0 < любой p
  const got = ids(evaluate(lucky, {}, "d"));
  for (const id of ["fate_grace", "fate_rune", "fate_moon", "fate_titan", "fate_dragon"]) assert.ok(got.includes(id), id);
  const unlucky = sessionCtx({}, { rng: () => 0.5 });
  assert.ok(!ids(evaluate(unlucky, {}, "d")).some((id) => id.startsWith("fate_")));
  const notSession = base({ event: { type: "buffs" }, rng: () => 0 });
  assert.ok(!ids(evaluate(notSession, {}, "d")).some((id) => id.startsWith("fate_")));
});

test("сломанное правило не роняет оценку остальных", () => {
  const ctx = base({ totals: null, hero: null, lifts: null, nutrition: null, buffs: null, meta: null });
  assert.doesNotThrow(() => evaluate(ctx, {}, "d"));
});

test("миграция старых статусов: повторы схлопываются в счётчик, уникальные — один раз", () => {
  const legacy = [
    { id: "pr", date: "2026-08-01" }, { id: "pr", date: "2026-08-10" }, { id: "pr", date: "2026-07-20" },
    { id: "awakened", date: "2026-07-01" }, { id: "grindveteran", date: "2026-08-01" }, { id: "grindveteran", date: "2026-09-01" },
    { id: "grace", date: "2026-08-02" }, { id: "berserk", date: "2026-08-03" }, { id: "unknown-id", date: "2026-08-04" },
  ];
  const m = migrateLegacyStatuses(legacy);
  assert.deepEqual(m.pr, { count: 3, first: "2026-07-20", last: "2026-08-10" });
  assert.equal(m.awakened.count, 1);
  assert.equal(m.grind10.count, 1, "уникальное не считается дважды");
  assert.equal(m.fate_grace.count, 2, "старые случайные статусы → Благодать Древа со счётчиком");
  assert.ok(!("unknown-id" in m));
  assert.deepEqual(migrateLegacyStatuses(undefined), {});
});

test("сводка по рангам", () => {
  const s = summary({ awakened: { count: 1 }, perfect: { count: 4 }, grind100: { count: 1 } });
  assert.equal(s.total, 3);
  assert.equal(s.of, 100);
  assert.equal(s.byTier.bronze, 1);
  assert.equal(s.byTier.gold, 1);
  assert.equal(s.byTier.diamond, 1);
});
