// Прогрессия рабочих весов: node --test tests/progression.test.mjs
// Главное, что здесь защищается: вес в подходах берётся из журнала, а не из воздуха,
// двигается ровно на шаг снаряда и объясним одной фразой. Раньше на этом месте были
// «потолок» и «пол» — два числа, из которых не следовало, что ставить сегодня.
import { test } from "node:test";
import assert from "node:assert/strict";
import { e1rm, weightFor, judge, workMax, bestSet, progressionOf, stateOf, moveLabel, PROG } from "../data/progression.js";

const d = (n) => `2026-0${Math.floor(n / 28) + 1}-${String((n % 28) + 1).padStart(2, "0")}`;
const plan4x46 = { sets: 4, reps: [4, 6], rir: 1 };
const sess = (date, sets, plan = plan4x46) => ({ date, sets, plan });
const same = (n, w, r) => Array.from({ length: n }, () => ({ w, r }));

/* ---------- формулы ---------- */

test("расчётный 1ПМ и обратный ход согласованы", () => {
  for (const [w, r] of [[100, 1], [100, 5], [60, 8], [140, 10]]) {
    const one = e1rm(w, r);
    assert.ok(Math.abs(weightFor(one, r) - w) < 1e-9, `${w}×${r}: обратный ход не сошёлся`);
  }
  assert.ok(Math.abs(e1rm(100, 1) - 100) < 2, "на один повтор вес и есть максимум");
  assert.ok(e1rm(100, 5) > 100 && e1rm(100, 5) < 120);
  assert.equal(e1rm(100, 20), e1rm(100, 10), "выше 10 повторов формулы врут — капаем");
  assert.equal(e1rm(0, 5), 0);
  assert.equal(e1rm(100, 0), 0);
  assert.equal(weightFor(0, 5), 0);
});

/* ---------- разбор сессии ---------- */

test("закрыл все подходы по верхней границе — это прибавка", () => {
  const j = judge(same(4, 100, 6), plan4x46);
  assert.equal(j.verdict, "up");
  assert.equal(j.top, 100);
  assert.equal(j.topReps, 6);
});

test("попал в коридор, но не дотянул до верха — вес держим", () => {
  assert.equal(judge(same(4, 100, 5), plan4x46).verdict, "hold");
  assert.equal(judge([{ w: 100, r: 6 }, { w: 100, r: 6 }, { w: 100, r: 4 }, { w: 100, r: 4 }], plan4x46).verdict,
    "hold", "верхнюю границу должны взять все подходы, а не первый");
});

test("не добрал нижнюю границу повторов — откат", () => {
  assert.equal(judge(same(4, 110, 3), plan4x46).verdict, "down");
  assert.equal(judge([{ w: 110, r: 3 }], plan4x46).verdict, "down");
});

test("не добрал по числу подходов — вес держим, а не поднимаем", () => {
  const j = judge(same(2, 100, 6), plan4x46);
  assert.equal(j.verdict, "hold", "две шестёрки вместо четырёх — ещё не повод прибавлять");
  assert.equal(j.work, 2);
  assert.equal(j.planned, 4);
});

test("разминка не считается рабочим подходом и не мешает прибавке", () => {
  const sets = [{ w: 60, r: 8 }, { w: 75, r: 5 }, ...same(4, 100, 6)];
  const j = judge(sets, plan4x46);
  assert.equal(j.verdict, "up", "лёгкие подходы ниже 80% топа отсекаются");
  assert.equal(j.work, 4);
});

test("рекордный сингл в конце квеста не роняет вилку", () => {
  // так и тренируются: отработал план, потом попробовал разовый максимум
  const j = judge([...same(4, 100, 6), { w: 125, r: 1 }], plan4x46);
  assert.equal(j.verdict, "up", "попытка на раз — это не проваленный рабочий подход");
  assert.equal(j.top, 100, "рабочим верхом остаётся вес, который сделан по плану");
  assert.equal(j.record, 125, "но в личный максимум попытка идёт");
});

test("пустой и кривой журнал разбору не мешают", () => {
  for (const bad of [null, [], [{ w: 0, r: 5 }], [{ w: 100, r: 0 }], [null]]) assert.equal(judge(bad, plan4x46), null);
});

/* ---------- рабочий максимум ---------- */

const corridorTop = (history, o = {}) => progressionOf(history, { reps: [4, 6], rir: 1, equip: "bb", ...o }).hi;

test("удачный квест поднимает вилку ровно на шаг снаряда", () => {
  const one = corridorTop([sess(d(1), same(4, 100, 6))]);
  const two = corridorTop([sess(d(1), same(4, 100, 6)), sess(d(4), same(4, 100, 6))]);
  assert.equal(two - one, 2.5, "штанга шагает по 2,5 кг, а не процентами");
});

test("вес растёт из квеста в квест и из цикла в цикл сам", () => {
  const hist = [];
  let w = 100;
  for (let i = 0; i < 8; i++) { hist.push(sess(d(i * 3), same(4, w, 6))); w += 2.5; }  // каждый раз закрыл план
  const p = progressionOf(hist, { reps: [4, 6], rir: 1, equip: "bb" });
  assert.equal(p.sessions, 8);
  assert.equal(p.move, "up");
  assert.equal(p.hi, 120, "восемь удачных квестов — восемь шагов от 100 кг");
  assert.ok(p.lo < p.hi, "низ вилки легче верха: там больше повторов");
});

test("застрял на весе — вилка стоит, а не ползёт", () => {
  const hist = [1, 4, 7, 10].map((n) => sess(d(n), same(4, 100, 5)));
  const p = progressionOf(hist, { reps: [4, 6], rir: 1, equip: "bb" });
  assert.equal(p.move, "hold");
  assert.equal(p.deltaKg, 0);
  assert.equal(stateOf(p).key, "stall", "три квеста без прибавки — это застой, и о нём надо сказать");
});

test("недобор опускает вилку на шаг, но не роняет в пропасть", () => {
  const up = [sess(d(1), same(4, 100, 6)), sess(d(4), same(4, 102.5, 6))];
  const good = corridorTop(up);
  const bad = corridorTop([...up, sess(d(7), same(4, 105, 2))]);
  assert.equal(good - bad, 2.5, "один провал — один шаг вниз");
  // серия провалов не должна обнулить движение
  const crash = corridorTop([...up, ...Array.from({ length: 8 }, (_, i) => sess(d(10 + i * 3), same(4, 60, 2)))]);
  assert.ok(crash >= good * PROG.FLOOR * 0.95, `вилка провалилась слишком глубоко: ${crash} из ${good}`);
  assert.ok(crash > 0);
});

test("рабочий максимум — не рекорд: удачный день не задирает рабочую неделю", () => {
  const hist = [sess(d(1), same(4, 100, 6)), sess(d(4), [...same(4, 102.5, 6), { w: 140, r: 1 }])];
  const p = progressionOf(hist, { reps: [4, 6], rir: 1, equip: "bb" });
  const rec = bestSet(hist);
  assert.equal(rec.w, 140, "личный максимум помнит попытку");
  assert.ok(p.oneRM >= 140);
  assert.ok(p.work1RM < rec.one, "а рабочий максимум остаётся на земле");
  assert.ok(p.hi <= 110, `вилка не должна прыгать к рекорду: ${p.hi}`);
});

/* ---------- снаряды со своей арифметикой ---------- */

test("гантели считаются на руку: шаг 2 кг на гантель, вилка тоже на руку", () => {
  const o = { reps: [8, 10], rir: 2, equip: "db", perHand: true };
  const one = progressionOf([sess(d(1), same(3, 30, 10), { sets: 3, reps: [8, 10], rir: 2 })], o);
  const two = progressionOf([sess(d(1), same(3, 30, 10), { sets: 3, reps: [8, 10], rir: 2 }),
                             sess(d(4), same(3, 30, 10), { sets: 3, reps: [8, 10], rir: 2 })], o);
  assert.equal(two.hi - one.hi, 2, "прибавка — 2 кг на гантель, а не на пару");
  assert.ok(one.hi >= 28 && one.hi <= 36, `вилка должна остаться в районе рабочих 30 кг: ${one.hi}`);
});

test("подтягивания с поясом: вилка — довесок, а не общий вес системы", () => {
  const o = { reps: [6, 8], rir: 2, equip: "bwp", bw: true, bodyweight: 90 };
  const p = progressionOf([sess(d(1), same(4, 20, 8), { sets: 4, reps: [6, 8], rir: 2 })], o);
  assert.ok(p.hi >= 20 && p.hi < 50, `в поясе висит довесок, а не 110 кг: ${p.hi}`);
  const p2 = progressionOf([sess(d(1), same(4, 20, 8), { sets: 4, reps: [6, 8], rir: 2 }),
                            sess(d(4), same(4, 20, 8), { sets: 4, reps: [6, 8], rir: 2 })], o);
  assert.equal(p2.hi - p.hi, 2.5);
  assert.ok(p.oneRMBar < p.oneRM, "личный максимум показывается довеском, а считается по системе");
});

/* ---------- пока истории нет ---------- */

test("без журнала вес берётся от базовых лифтов и честно помечен оценкой", () => {
  const p = progressionOf([], { reps: [4, 6], rir: 1, equip: "bb", seed: 140 });
  assert.equal(p.source, "estimate");
  assert.ok(p.hi > 110 && p.hi < 140, `оценка рабочего веса от 1ПМ 140: ${p.hi}`);
  assert.equal(moveLabel(p).text, "оценка от базовых лифтов");
  assert.equal(stateOf(p).key, "new");
});

test("плановая надбавка недели работает только до первых подходов", () => {
  const base = progressionOf([], { reps: [4, 6], rir: 1, equip: "bb", seed: 140 });
  const bumped = progressionOf([], { reps: [4, 6], rir: 1, equip: "bb", seed: 140, prog: 0.05 });
  assert.ok(bumped.hi > base.hi, "пока данных нет, неделю двигает план");
  const withHist = [sess(d(1), same(4, 100, 5))];
  const a = progressionOf(withHist, { reps: [4, 6], rir: 1, equip: "bb", seed: 140 });
  const b = progressionOf(withHist, { reps: [4, 6], rir: 1, equip: "bb", seed: 140, prog: 0.05 });
  assert.equal(a.hi, b.hi, "как только есть подходы, вес двигают они, а не процент из шаблона");
});

test("ни журнала, ни оценки — вилки нет, и это видно", () => {
  const p = progressionOf([], { reps: [4, 6], rir: 1, equip: "bb" });
  assert.equal(p.source, "none");
  assert.equal(p.hi, 0);
  assert.equal(p.lo, 0);
  assert.equal(moveLabel(p), null);
  assert.equal(stateOf(p).key, "none");
  assert.equal(stateOf(null).key, "none");
});

/* ---------- вилка и подписи ---------- */

test("вилка раскрывается из одного числа: верх — тяжёлый край, низ — лёгкий", () => {
  const hist = [sess(d(1), same(4, 100, 6))];
  const heavy = progressionOf(hist, { reps: [4, 6], rir: 1, equip: "bb" });
  const light = progressionOf(hist, { reps: [12, 15], rir: 1, equip: "bb" });
  assert.equal(heavy.work1RM, light.work1RM, "рабочий максимум у движения один на все схемы");
  assert.ok(light.hi < heavy.lo, "объёмная схема легче силовой по всей вилке");
  assert.ok(heavy.lo <= heavy.hi && light.lo <= light.hi);
  for (const p of [heavy, light]) {
    assert.equal(p.hi % p.step, 0, "вес округляется по шагу снаряда: в зале нет 101,4 кг");
    assert.equal(p.lo % p.step, 0);
  }
});

test("подпись движения вилки объясняет, что произошло", () => {
  const up = progressionOf([sess(d(1), same(4, 100, 6)), sess(d(4), same(4, 100, 6))], { reps: [4, 6], rir: 1, equip: "bb" });
  assert.equal(moveLabel(up).icon, "▲");
  assert.equal(moveLabel(up).text, "+2,5 кг к прошлому разу");
  const hold = progressionOf([sess(d(1), same(4, 100, 6)), sess(d(4), same(4, 102.5, 5))], { reps: [4, 6], rir: 1, equip: "bb" });
  assert.equal(moveLabel(hold).icon, "=");
  assert.match(moveLabel(hold).text, /держим вес: прошлый раз 102,5 × 5/);
});

test("состояние движения читается словами и цветом", () => {
  const grow = progressionOf([sess(d(1), same(4, 100, 6)), sess(d(4), same(4, 102.5, 6))], { reps: [4, 6], rir: 1, equip: "bb" });
  assert.equal(stateOf(grow).key, "grow");
  assert.equal(stateOf(grow).cls, "verdict-gold");
  const drop = progressionOf([sess(d(1), same(4, 100, 6)), sess(d(4), same(4, 100, 2))], { reps: [4, 6], rir: 1, equip: "bb" });
  assert.equal(stateOf(drop).key, "drop");
  assert.equal(stateOf(drop).cls, "verdict-fail");
});

test("тренд считается только когда есть что считать", () => {
  const one = progressionOf([sess(d(1), same(4, 100, 6))], { reps: [4, 6], rir: 1, equip: "bb" });
  assert.equal(one.trend, null, "по одному замеру тренда нет");
  const hist = [];
  let w = 100;
  for (let i = 0; i < 6; i++) { hist.push(sess(d(i * 5), same(4, w, 6))); w += 2.5; }
  const many = progressionOf(hist, { reps: [4, 6], rir: 1, equip: "bb" });
  assert.ok(many.trend > 0, "растущая история даёт положительный тренд");
  assert.ok(many.trend < 60, `тренд не должен улетать в космос: ${many.trend}`);
});

test("история движения не портится пропущенными квестами", () => {
  const hist = [sess(d(1), same(4, 100, 6)), sess(d(20), same(4, 102.5, 6)), sess(d(50), same(4, 105, 6))];
  const p = progressionOf(hist, { reps: [4, 6], rir: 1, equip: "bb" });
  assert.equal(p.sessions, 3);
  assert.equal(p.move, "up");
  assert.ok(p.hi >= 107.5, "перерыв между квестами не обнуляет прогресс");
});

test("прибавка с объёмной недели не теряется на силовой", () => {
  const strength = { sets: 4, reps: [4, 6], rir: 1 };
  const volume = { sets: 4, reps: [8, 10], rir: 2 };
  const base = [sess(d(1), same(4, 100, 6), strength)];
  const after = progressionOf(base, { reps: [8, 10], rir: 2, equip: "bb" });
  assert.ok(after.hi > 0 && after.hi < 100, `объёмной неделе положен вес полегче: ${after.hi}`);
  // объёмный квест закрыт по верхней границе — на следующей силовой это должно быть видно
  const done = [...base, sess(d(4), same(4, after.hi, 10), volume)];
  const back = progressionOf(done, { reps: [4, 6], rir: 1, equip: "bb" });
  assert.equal(back.move, "up");
  assert.ok(back.hi > 100, `силовая вилка должна подрасти после объёмной недели: ${back.hi}`);
});

test("лёгкий квест не двигает вилку ни вверх, ни вниз", () => {
  const hist = [sess(d(1), same(4, 100, 6)), sess(d(4), same(4, 102.5, 6))];
  const strong = progressionOf(hist, { reps: [4, 6], rir: 1, equip: "bb" });
  const light = progressionOf([...hist, sess(d(7), same(4, 70, 3))], { reps: [4, 6], rir: 1, equip: "bb" });
  assert.equal(light.move, "light", "70 кг вместо назначенных 105 — это не провал, а лёгкий день");
  assert.equal(light.hi, strong.hi, "вилка осталась на месте");
});

test("добивающая схема не получает вес десятиповторной", () => {
  // раньше формула капалась на 10 повторах, и подход на 20 раз назначался как на 10
  const hist = [sess(d(1), same(3, 60, 12), { sets: 3, reps: [10, 12], rir: 1 })];
  const mid = progressionOf(hist, { reps: [10, 12], rir: 1, equip: "bb" });
  const finisher = progressionOf(hist, { reps: [15, 20], rir: 0, equip: "bb" });
  assert.equal(mid.hi, 60, "своя схема — свой вес");
  assert.ok(finisher.hi < mid.hi * 0.9, `на 20 повторов вес должен заметно упасть: ${finisher.hi} против ${mid.hi}`);
  assert.ok(finisher.hi > mid.hi * 0.6, `и не обвалиться в пустоту: ${finisher.hi}`);
});

test("вилка одинаково разворачивается вперёд и назад по схемам", () => {
  const strength = { sets: 4, reps: [4, 6], rir: 1 };
  const hist = [sess(d(1), same(4, 100, 6), strength)];
  const back = progressionOf(hist, { reps: [4, 6], rir: 1, equip: "bb" });
  assert.equal(back.hi, 100, "та же схема возвращает тот же вес — без дрейфа от пересчётов");
});

test("подход со своим весом записывается: нулевой довесок — это не пустая строка", () => {
  // планка, подъём ног в висе, подтягивания без пояса: вес в журнале ноль по делу
  const plan = { sets: 3, reps: [10, 12], rir: 1 };
  const hist = [sess(d(1), [{ w: 0, r: 12 }, { w: 0, r: 12 }, { w: 0, r: 12 }], plan)];
  const o = { reps: [10, 12], rir: 1, equip: "bwp", bw: true, bodyweight: 90 };
  assert.equal(judge(hist[0].sets, plan, true).verdict, "up", "три подхода по верхней границе — это прибавка");
  assert.equal(judge(hist[0].sets, plan, false), null, "для штанги ноль в весе по-прежнему «не заполнено»");
  const p = progressionOf(hist, o);
  assert.equal(p.source, "work");
  assert.equal(p.sessions, 1);
  assert.equal(p.hi, 0, "первый заход без пояса — и дальше пока без пояса");
  const next = progressionOf([...hist, sess(d(4), [{ w: 0, r: 12 }, { w: 0, r: 12 }, { w: 0, r: 12 }], plan)], o);
  assert.equal(next.hi, 2.5, "два чистых квеста подряд — пора вешать пояс");
  assert.ok(p.oneRM > 90, "личный максимум считается по системе: тело плюс довесок");
});
