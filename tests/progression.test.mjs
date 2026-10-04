// Прогрессия рабочих весов: node --test tests/progression.test.mjs
// Главное, что здесь защищается: вес в подходах берётся из журнала, а не из воздуха,
// двигается ровно на шаг снаряда и объясним одной фразой. Раньше на этом месте были
// «потолок» и «пол» — два числа, из которых не следовало, что ставить сегодня.
import { test } from "node:test";
import assert from "node:assert/strict";
import { e1rm, weightFor, judge, workMax, bestSet, progressionOf, stateOf, moveLabel, isWarmup, asMax, warmupLadder, loadFactor, restFor, tonnageOf, feelOf, FEEL, DELOAD, PROG } from "../data/progression.js";

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

test("рекордный сингл в конце квеста не роняет рабочий вес", () => {
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

const corridorTop = (history, o = {}) => progressionOf(history, { reps: [4, 6], rir: 1, equip: "bb", sets: 4, ...o }).target;

test("удачный квест поднимает рабочий вес ровно на шаг снаряда", () => {
  const one = corridorTop([sess(d(1), same(4, 100, 6))]);
  const two = corridorTop([sess(d(1), same(4, 100, 6)), sess(d(4), same(4, 100, 6))]);
  assert.equal(two - one, 2.5, "штанга шагает по 2,5 кг, а не процентами");
});

test("вес растёт из квеста в квест и из цикла в цикл сам", () => {
  const hist = [];
  let w = 100;
  for (let i = 0; i < 8; i++) { hist.push(sess(d(i * 3), same(4, w, 6))); w += 2.5; }  // каждый раз закрыл план
  const p = progressionOf(hist, { reps: [4, 6], rir: 1, equip: "bb", sets: 4 });
  assert.equal(p.sessions, 8);
  assert.equal(p.move, "up");
  assert.equal(p.target, 120, "восемь удачных квестов — восемь шагов от 100 кг");
  });

test("застрял на весе — вес стоит, а не ползёт", () => {
  const hist = [1, 4, 7, 10].map((n) => sess(d(n), same(4, 100, 5)));
  const p = progressionOf(hist, { reps: [4, 6], rir: 1, equip: "bb", sets: 4 });
  assert.equal(p.move, "hold");
  assert.equal(p.deltaKg, 0);
  assert.equal(stateOf(p).key, "stall", "три квеста без прибавки — это застой, и о нём надо сказать");
});

test("недобор опускает вес на шаг, но не роняет в пропасть", () => {
  const up = [sess(d(1), same(4, 100, 6)), sess(d(4), same(4, 102.5, 6))];
  const good = corridorTop(up);
  const bad = corridorTop([...up, sess(d(7), same(4, 105, 2))]);
  assert.equal(good - bad, 2.5, "один провал — один шаг вниз");
  // серия провалов не должна обнулить движение
  const crash = corridorTop([...up, ...Array.from({ length: 8 }, (_, i) => sess(d(10 + i * 3), same(4, 60, 2)))]);
  assert.ok(crash >= good * PROG.FLOOR * 0.95, `вес провалился слишком глубоко: ${crash} из ${good}`);
  assert.ok(crash > 0);
});

test("рабочий максимум — не рекорд: удачный день не задирает рабочую неделю", () => {
  const hist = [sess(d(1), same(4, 100, 6)), sess(d(4), [...same(4, 102.5, 6), { w: 140, r: 1 }])];
  const p = progressionOf(hist, { reps: [4, 6], rir: 1, equip: "bb", sets: 4 });
  const rec = bestSet(hist);
  assert.equal(rec.w, 140, "личный максимум помнит попытку");
  assert.ok(p.oneRM >= 140);
  assert.ok(p.work1RM < rec.one, "а рабочий максимум остаётся на земле");
  assert.ok(p.target <= 110, `рабочий вес не должен прыгать к рекорду: ${p.target}`);
});

/* ---------- снаряды со своей арифметикой ---------- */

test("гантели считаются на руку: шаг 2 кг на гантель, вес тоже на руку", () => {
  const o = { reps: [8, 10], rir: 2, equip: "db", perHand: true, sets: 3 };
  const one = progressionOf([sess(d(1), same(3, 30, 10), { sets: 3, reps: [8, 10], rir: 2 })], o);
  const two = progressionOf([sess(d(1), same(3, 30, 10), { sets: 3, reps: [8, 10], rir: 2 }),
                             sess(d(4), same(3, 30, 10), { sets: 3, reps: [8, 10], rir: 2 })], o);
  assert.equal(two.target - one.target, 2, "прибавка — 2 кг на гантель, а не на пару");
  assert.ok(one.target >= 28 && one.target <= 36, `вес должен остаться в районе рабочих 30 кг: ${one.target}`);
});

test("подтягивания с поясом: вес — довесок, а не общий вес системы", () => {
  const o = { reps: [6, 8], rir: 2, equip: "bwp", bw: true, bodyweight: 90, sets: 4 };
  const p = progressionOf([sess(d(1), same(4, 20, 8), { sets: 4, reps: [6, 8], rir: 2 })], o);
  assert.ok(p.target >= 20 && p.target < 50, `в поясе висит довесок, а не 110 кг: ${p.target}`);
  const p2 = progressionOf([sess(d(1), same(4, 20, 8), { sets: 4, reps: [6, 8], rir: 2 }),
                            sess(d(4), same(4, 20, 8), { sets: 4, reps: [6, 8], rir: 2 })], o);
  assert.equal(p2.target - p.target, 2.5);
  assert.ok(p.oneRMBar < p.oneRM, "личный максимум показывается довеском, а считается по системе");
});

/* ---------- пока истории нет ---------- */

test("без журнала вес берётся от базовых лифтов и честно помечен оценкой", () => {
  const p = progressionOf([], { reps: [4, 6], rir: 1, equip: "bb", sets: 4, seed: 140 });
  assert.equal(p.source, "estimate");
  assert.ok(p.target >= 100 && p.target <= 120, `оценка рабочего веса от 1ПМ 140 на четыре подхода: ${p.target}`);
  assert.equal(moveLabel(p).text, "оценка от базовых лифтов");
  assert.equal(stateOf(p).key, "new");
});

test("плановая надбавка недели работает только до первых подходов", () => {
  const base = progressionOf([], { reps: [4, 6], rir: 1, equip: "bb", sets: 4, seed: 140 });
  const bumped = progressionOf([], { reps: [4, 6], rir: 1, equip: "bb", sets: 4, seed: 140, prog: 0.05 });
  assert.ok(bumped.target > base.target, "пока данных нет, неделю двигает план");
  const withHist = [sess(d(1), same(4, 100, 5))];
  const a = progressionOf(withHist, { reps: [4, 6], rir: 1, equip: "bb", sets: 4, seed: 140 });
  const b = progressionOf(withHist, { reps: [4, 6], rir: 1, equip: "bb", sets: 4, seed: 140, prog: 0.05 });
  assert.equal(a.target, b.target, "как только есть подходы, вес двигают они, а не процент из шаблона");
});

test("ни журнала, ни оценки — веса нет, и это видно", () => {
  const p = progressionOf([], { reps: [4, 6], rir: 1, equip: "bb", sets: 4 });
  assert.equal(p.source, "none");
  assert.equal(p.target, 0);
  assert.equal(moveLabel(p), null);
  assert.equal(stateOf(p).key, "none");
  assert.equal(stateOf(null).key, "none");
});

/* ---------- вилка и подписи ---------- */

test("рабочий вес раскрывается из одного числа под любую схему", () => {
  const hist = [sess(d(1), same(4, 100, 6))];
  const heavy = progressionOf(hist, { reps: [4, 6], rir: 1, equip: "bb", sets: 4 });
  const light = progressionOf(hist, { reps: [12, 15], rir: 1, equip: "bb" });
  assert.equal(heavy.work1RM, light.work1RM, "рабочий максимум у движения один на все схемы");
  assert.ok(light.target < heavy.target, "объёмная схема легче силовой");
  for (const p of [heavy, light]) {
    assert.equal(p.target % p.step, 0, "вес округляется по шагу снаряда: в зале нет 101,4 кг");
  }
});

test("подпись движения вилки объясняет, что произошло", () => {
  const up = progressionOf([sess(d(1), same(4, 100, 6)), sess(d(4), same(4, 100, 6))], { reps: [4, 6], rir: 1, equip: "bb", sets: 4 });
  assert.equal(moveLabel(up).icon, "▲");
  assert.equal(moveLabel(up).text, "+2,5 кг к прошлому разу");
  const hold = progressionOf([sess(d(1), same(4, 100, 6)), sess(d(4), same(4, 102.5, 5))], { reps: [4, 6], rir: 1, equip: "bb", sets: 4 });
  assert.equal(moveLabel(hold).icon, "=");
  assert.match(moveLabel(hold).text, /держим вес: прошлый раз 102,5 × 5/);
});

test("состояние движения читается словами и цветом", () => {
  const grow = progressionOf([sess(d(1), same(4, 100, 6)), sess(d(4), same(4, 102.5, 6))], { reps: [4, 6], rir: 1, equip: "bb", sets: 4 });
  assert.equal(stateOf(grow).key, "grow");
  assert.equal(stateOf(grow).cls, "verdict-gold");
  const drop = progressionOf([sess(d(1), same(4, 100, 6)), sess(d(4), same(4, 100, 2))], { reps: [4, 6], rir: 1, equip: "bb", sets: 4 });
  assert.equal(stateOf(drop).key, "drop");
  assert.equal(stateOf(drop).cls, "verdict-fail");
});

test("тренд считается только когда есть что считать", () => {
  const one = progressionOf([sess(d(1), same(4, 100, 6))], { reps: [4, 6], rir: 1, equip: "bb", sets: 4 });
  assert.equal(one.trend, null, "по одному замеру тренда нет");
  const hist = [];
  let w = 100;
  for (let i = 0; i < 6; i++) { hist.push(sess(d(i * 5), same(4, w, 6))); w += 2.5; }
  const many = progressionOf(hist, { reps: [4, 6], rir: 1, equip: "bb", sets: 4 });
  assert.ok(many.trend > 0, "растущая история даёт положительный тренд");
  assert.ok(many.trend < 60, `тренд не должен улетать в космос: ${many.trend}`);
});

test("история движения не портится пропущенными квестами", () => {
  const hist = [sess(d(1), same(4, 100, 6)), sess(d(20), same(4, 102.5, 6)), sess(d(50), same(4, 105, 6))];
  const p = progressionOf(hist, { reps: [4, 6], rir: 1, equip: "bb", sets: 4 });
  assert.equal(p.sessions, 3);
  assert.equal(p.move, "up");
  assert.ok(p.target >= 107.5, "перерыв между квестами не обнуляет прогресс");
});

test("прибавка с объёмной недели не теряется на силовой", () => {
  const strength = { sets: 4, reps: [4, 6], rir: 1 };
  const volume = { sets: 4, reps: [8, 10], rir: 2 };
  const base = [sess(d(1), same(4, 100, 6), strength)];
  const after = progressionOf(base, { reps: [8, 10], rir: 2, equip: "bb", sets: 4 });
  assert.ok(after.target > 0 && after.target < 100, `объёмной неделе положен вес полегче: ${after.target}`);
  // объёмный квест закрыт по верхней границе — на следующей силовой это должно быть видно
  const done = [...base, sess(d(4), same(4, after.target, 10), volume)];
  const back = progressionOf(done, { reps: [4, 6], rir: 1, equip: "bb", sets: 4 });
  assert.equal(back.move, "up");
  assert.ok(back.target > 100, `силовая вилка должна подрасти после объёмной недели: ${back.target}`);
});

test("лёгкий квест не двигает вес ни вверх, ни вниз", () => {
  const hist = [sess(d(1), same(4, 100, 6)), sess(d(4), same(4, 102.5, 6))];
  const strong = progressionOf(hist, { reps: [4, 6], rir: 1, equip: "bb", sets: 4 });
  const light = progressionOf([...hist, sess(d(7), same(4, 70, 3))], { reps: [4, 6], rir: 1, equip: "bb", sets: 4 });
  assert.equal(light.move, "light", "70 кг вместо назначенных 105 — это не провал, а лёгкий день");
  assert.equal(light.target, strong.target, "вес остался на месте");
});

test("добивающая схема не получает вес десятиповторной", () => {
  // раньше формула капалась на 10 повторах, и подход на 20 раз назначался как на 10
  const hist = [sess(d(1), same(3, 60, 12), { sets: 3, reps: [10, 12], rir: 1 })];
  const mid = progressionOf(hist, { reps: [10, 12], rir: 1, equip: "bb", sets: 3 });
  const finisher = progressionOf(hist, { reps: [15, 20], rir: 0, equip: "bb", sets: 3 });
  assert.equal(mid.target, 60, "своя схема — свой вес");
  assert.ok(finisher.target < mid.target * 0.9, `на 20 повторов вес должен заметно упасть: ${finisher.target} против ${mid.target}`);
  assert.ok(finisher.target > mid.target * 0.6, `и не обвалиться в пустоту: ${finisher.target}`);
});

test("вилка одинаково разворачивается вперёд и назад по схемам", () => {
  const strength = { sets: 4, reps: [4, 6], rir: 1 };
  const hist = [sess(d(1), same(4, 100, 6), strength)];
  const back = progressionOf(hist, { reps: [4, 6], rir: 1, equip: "bb", sets: 4 });
  assert.equal(back.target, 100, "та же схема возвращает тот же вес — без дрейфа от пересчётов");
});

test("подход со своим весом записывается: нулевой довесок — это не пустая строка", () => {
  // планка, подъём ног в висе, подтягивания без пояса: вес в журнале ноль по делу
  const plan = { sets: 3, reps: [10, 12], rir: 1 };
  const hist = [sess(d(1), [{ w: 0, r: 12 }, { w: 0, r: 12 }, { w: 0, r: 12 }], plan)];
  const o = { reps: [10, 12], rir: 1, equip: "bwp", bw: true, bodyweight: 90, sets: 3 };
  assert.equal(judge(hist[0].sets, plan, true).verdict, "up", "три подхода по верхней границе — это прибавка");
  assert.equal(judge(hist[0].sets, plan, false), null, "для штанги ноль в весе по-прежнему «не заполнено»");
  const p = progressionOf(hist, o);
  assert.equal(p.source, "work");
  assert.equal(p.sessions, 1);
  assert.equal(p.target, 0, "первый заход без пояса — и дальше пока без пояса");
  const next = progressionOf([...hist, sess(d(4), [{ w: 0, r: 12 }, { w: 0, r: 12 }, { w: 0, r: 12 }], plan)], o);
  assert.equal(next.target, 2.5, "два чистых квеста подряд — пора вешать пояс");
  assert.ok(p.oneRM > 90, "личный максимум считается по системе: тело плюс довесок");
});

test("у движения один рабочий вес, а не вилка: пола нет, есть база", () => {
  const p = progressionOf([sess(d(1), same(4, 100, 6))], { reps: [4, 6], rir: 1, equip: "bb", sets: 4 });
  assert.equal(typeof p.target, "number");
  assert.equal(p.lo, undefined, "нижней границы веса у движения не бывает — её убрали намеренно");
  assert.equal(p.hi, undefined, "и «верха» тоже: осталось одно число");
  assert.ok(p.target > 0);
  const none = progressionOf([], { reps: [4, 6], rir: 1, equip: "bb", sets: 4 });
  assert.equal(none.target, 0, "нет данных — нет и веса");
});

test("у рабочего веса есть пол: ниже него подход уже не рабочий", () => {
  const p = progressionOf([sess(d(1), same(4, 100, 6))], { reps: [4, 6], rir: 1, equip: "bb", sets: 4 });
  assert.ok(p.floor > 0 && p.floor < p.target, `пол должен быть ниже цели: ${p.floor} из ${p.target}`);
  assert.ok(p.floor >= p.target * 0.85, `и не в подвале: ${p.floor} из ${p.target}`);
  assert.equal(p.floor % p.step, 0, "пол тоже округляется по шагу снаряда");
  assert.equal(p.floor, 90, "90 кг при рабочих 100 — это та же граница, за которой движок откатывает вес");
  // тот же порог, по которому рабочий максимум не проваливается при серии неудач
  assert.equal(PROG.FLOOR, 0.9);
});

test("без веса пола не бывает", () => {
  assert.equal(progressionOf([], { reps: [4, 6], rir: 1, equip: "bb", sets: 4 }).floor, 0);
  const bw = progressionOf([sess(d(1), [{ w: 0, r: 12 }, { w: 0, r: 12 }, { w: 0, r: 12 }], { sets: 3, reps: [10, 12], rir: 1 })],
    { reps: [10, 12], rir: 1, equip: "bwp", bw: true, bodyweight: 90, sets: 3 });
  assert.equal(bw.target, 0, "подтягивания без пояса");
  assert.equal(bw.floor, 0, "и пола у них нет — падать некуда");
});

/* ---------- разминка ---------- */

test("двадцать килограммов при рабочих ста — это разминка, а не упавшие силовые", () => {
  assert.equal(isWarmup({ w: 20, r: 10 }, 100), true);
  assert.equal(isWarmup({ w: 60, r: 8 }, 100), true);
  assert.equal(isWarmup({ w: 80, r: 5 }, 100), true, "последняя ступень лесенки — тоже разминка");
  assert.equal(isWarmup({ w: 82.5, r: 5 }, 100), false, "выше 80% рабочего — уже рабочий подход, пусть и слабый");
  assert.equal(isWarmup({ w: 95, r: 5 }, 100), false);
  assert.equal(isWarmup({ w: 0, r: 10 }, 100), false, "свой вес разминкой не объявляем");
  assert.equal(isWarmup({ w: 60, r: 8 }, 0), false, "без рабочего веса сравнивать не с чем");
  assert.equal(isWarmup(null, 100), false);
});

test("разминочная лесенка не занимает слоты плана и не мешает прибавке", () => {
  const sets = [{ w: 20, r: 10 }, { w: 40, r: 8 }, { w: 60, r: 5 }, { w: 80, r: 3 }, ...same(4, 100, 6)];
  const j = judge(sets, plan4x46);
  assert.equal(j.verdict, "up", "план закрыт по верхней границе — лесенка тут ни при чём");
  assert.equal(j.work, 4, "рабочих подходов четыре, а не восемь");
  assert.equal(j.top, 100);
});

test("квест из одной разминки не роняет рабочий вес", () => {
  // рабочий 100, а сегодня всё ушло в 20–80: сил это не отнимает и веса не двигает
  const hist = [sess(d(1), same(4, 100, 6))];
  const before = progressionOf(hist, { reps: [4, 6], rir: 1, equip: "bb", sets: 4 });
  const after = progressionOf([...hist, sess(d(4), [{ w: 20, r: 10 }, { w: 40, r: 8 }, { w: 60, r: 6 }, { w: 80, r: 6 }])],
    { reps: [4, 6], rir: 1, equip: "bb", sets: 4 });
  assert.equal(after.move, "light", "лёгкий квест, а не откат");
  assert.equal(after.target, before.target, "рабочий вес остался на месте");
});

/* ---------- ручная правка ---------- */

test("ручная правка начинает отсчёт заново и отменяет старую историю", () => {
  const hist = [];
  let w = 100;
  for (let i = 0; i < 6; i++) { hist.push(sess(d(i * 3), same(4, w, 6))); w += 2.5; }
  const grown = progressionOf(hist, { reps: [4, 6], rir: 1, equip: "bb", sets: 4 });
  assert.ok(grown.target >= 115, `история довела вес до ${grown.target}`);
  // вернулся после болезни: рабочие стали 90 в четырёх подходах. Правка хранится
  // как максимум движения, поэтому объёмную поправку при записи снимаем, а при
  // назначении веса движок наложит её обратно
  const k = loadFactor({ sets: 4, rest: restFor(2, 6) });
  const reset = { date: d(30), one: asMax(90 / k, 6, 1) };
  const after = progressionOf(hist, { reps: [4, 6], rir: 1, equip: "bb", sets: 4, reset });
  assert.equal(after.target, 90, "вес встал туда, куда его поставили");
  assert.equal(after.source, "manual");
  assert.equal(after.sessions, 0, "старые квесты в расчёт больше не идут");
  assert.equal(moveLabel(after).text, "вес задан вручную");
  assert.equal(stateOf(after).key, "manual");
});

test("после правки вес снова ведут подходы", () => {
  const reset = { date: d(1), one: asMax(90 / loadFactor({ sets: 4, rest: restFor(2, 6) }), 6, 1) };
  const p = progressionOf([sess(d(4), same(4, 90, 6))], { reps: [4, 6], rir: 1, equip: "bb", sets: 4, reset });
  assert.equal(p.source, "work", "появились подходы — ручная метка уступает журналу");
  assert.equal(p.target, 92.5, "закрыл план на заданном весе — плюс шаг");
  assert.equal(p.move, "up");
});

test("правка не воскрешает квесты, которые были до неё", () => {
  const hist = [sess(d(1), same(4, 140, 6)), sess(d(40), same(4, 90, 6))];
  const reset = { date: d(30), one: asMax(90 / loadFactor({ sets: 4, rest: restFor(2, 6) }), 6, 1) };
  const p = progressionOf(hist, { reps: [4, 6], rir: 1, equip: "bb", sets: 4, reset });
  assert.equal(p.sessions, 1, "в расчёт пошёл только квест после правки");
  assert.equal(p.target, 92.5);
});

test("лесенка к тяжёлой базе: 40/60/80% на 5/3/1", () => {
  const l = warmupLadder(100, 2.5);
  assert.deepEqual(l, [{ w: 40, r: 5 }, { w: 60, r: 3 }, { w: 80, r: 1 }]);
  for (const s of l) assert.equal(isWarmup(s, 100), true, `${s.w} кг при рабочих 100 — разминка`);
});

test("лесенка округляется по шагу снаряда и не плодит одинаковые ступени", () => {
  for (const [w, step] of [[142.5, 2.5], [30, 2], [85, 5]]) {
    const l = warmupLadder(w, step);
    assert.ok(l.length && l.length <= 3);
    for (const s of l) assert.equal(s.w % step, 0, `${s.w} не по шагу ${step}`);
    for (let i = 1; i < l.length; i++) assert.ok(l[i].w > l[i - 1].w, "ступени только вверх");
  }
  assert.deepEqual(warmupLadder(5, 2.5), [{ w: 2.5, r: 3 }], "с лёгкого веса лесенка короче — ступеням негде встать");
  assert.deepEqual(warmupLadder(0, 2.5), [], "без рабочего веса лесенки нет");
});

test("верхняя ступень лесенки остаётся разминкой, а не становится рабочим подходом", () => {
  for (const w of [100, 102.5, 142.5, 87.5]) {
    for (const s of warmupLadder(w, 2.5)) {
      assert.equal(isWarmup(s, w), true, `${s.w} кг при рабочих ${w} должно считаться разминкой`);
    }
  }
});

/* ---------- объём и отдых ---------- */

test("отдых назначается по тяжести движения: базе минуты, изоляции секунды", () => {
  assert.ok(restFor(1, 5) >= 240, "тяжёлая база на пятёрках — от четырёх минут");
  assert.ok(restFor(2, 10) >= 120, "многосуставному на десятке — от двух минут");
  assert.ok(restFor(3, 12) <= 120 && restFor(3, 12) >= 60, "изоляции хватает минуты-полутора");
  for (const tier of [1, 2, 3]) {
    for (let r = 3; r <= 20; r++) assert.ok(restFor(tier, r) >= restFor(tier, r + 1), `${tier}: отдых должен падать с ростом повторов`);
    assert.ok(restFor(tier, 10) > restFor(3, 20));
  }
});

test("четыре подхода с коротким отдыхом — не тот же вес, что один подход", () => {
  assert.equal(loadFactor({ sets: 1, rest: 300 }), 1, "один подход с полным отдыхом — без поправки");
  assert.ok(loadFactor({ sets: 4, rest: 150 }) < 1, "каждый следующий подход что-то стоит");
  assert.ok(loadFactor({ sets: 4, rest: 60 }) < loadFactor({ sets: 4, rest: 150 }), "короткий отдых стоит дороже");
  assert.ok(loadFactor({ sets: 8, rest: 45 }) >= 0.82, "глубже 18% не опускаемся: это уже другая тренировка");
});

test("объёмной неделе достаётся вес легче силовой, а не тот же самый", () => {
  // четыре подхода по шесть на 102,5 — и дальше объёмная схема 4×8-10
  const hist = [sess(d(1), same(4, 102.5, 6))];
  const str = progressionOf(hist, { reps: [4, 6], rir: 1, equip: "bb", sets: 4, tier: 1 });
  const vol = progressionOf(hist, { reps: [8, 10], rir: 2, equip: "bb", sets: 4, tier: 1 });
  assert.equal(str.target, 102.5, "силовая схема возвращает то, что было сделано");
  assert.ok(vol.target <= str.target * 0.9, `объёмной положено заметно легче: ${vol.target} против ${str.target}`);
  assert.ok(vol.target >= str.target * 0.8, `но не вдвое: ${vol.target}`);
});

test("тот же вес в большем числе подходов говорит о большей силе", () => {
  const one = progressionOf([sess(d(1), [{ w: 100, r: 6 }], { sets: 1, reps: [4, 6], rir: 1 })],
    { reps: [4, 6], rir: 1, equip: "bb", sets: 1 });
  const four = progressionOf([sess(d(1), same(4, 100, 6))], { reps: [4, 6], rir: 1, equip: "bb", sets: 4 });
  assert.ok(four.work1RM > one.work1RM, "сто на шесть четыре раза — сильнее, чем один раз");
  assert.equal(one.target, 100, "и каждому вернётся его же вес под его же схему");
  assert.equal(four.target, 100);
});

/* ---------- самочувствие ---------- */

test("самочувствие двигает вес, подходы и отдых — и только в одну сторону каждое", () => {
  assert.equal(feelOf("norm").k, 1, "норма ничего не меняет");
  assert.equal(feelOf("norm").sets, 0);
  assert.equal(feelOf("norm").rest, 1);
  assert.ok(feelOf("tired").k < 1 && feelOf("tired").k >= 0.9, "разбитому легче, но не вдвое");
  assert.equal(feelOf("tired").sets, -1, "и на подход меньше");
  assert.ok(feelOf("tired").rest > 1, "и отдых длиннее");
  assert.ok(feelOf("fresh").k > 1 && feelOf("fresh").k <= 1.05, "свежему чуть больше, без геройства");
  assert.ok(feelOf("fresh").rest < 1, "и отдых короче");
  assert.equal(feelOf("чушь").k, 1, "неизвестное состояние — это норма, а не поломка");
});

test("на разбитом самочувствии квест даёт вес легче, а свежему — чуть тяжелее", () => {
  const hist = [sess(d(1), same(4, 102.5, 6))];
  const base = { reps: [4, 6], rir: 1, equip: "bb", sets: 4, tier: 1 };
  const norm = progressionOf(hist, base);
  const tired = progressionOf(hist, { ...base, feel: "tired" });
  const fresh = progressionOf(hist, { ...base, feel: "fresh" });
  assert.ok(tired.target < norm.target, `устал: ${tired.target} должно быть меньше ${norm.target}`);
  assert.ok(fresh.target > norm.target, `свежий: ${fresh.target} должно быть больше ${norm.target}`);
  assert.ok(tired.rest > norm.rest && fresh.rest < norm.rest, "отдых едет вслед за состоянием");
  assert.ok(tired.target >= norm.target * 0.9, "но не превращается в другую тренировку");
});

test("тяжёлый день не читается как откат силовых: поправка на самочувствие снимается обратно", () => {
  // атлет пришёл разбитым, взял свои 95 вместо 102,5 и закрыл схему
  const base = { reps: [4, 6], rir: 1, equip: "bb", sets: 4, tier: 1 };
  const норма = progressionOf([sess(d(1), same(4, 102.5, 6))], base);
  const устал = progressionOf(
    [sess(d(1), same(4, 97.5, 6), { sets: 4, reps: [4, 6], rir: 1, feel: "tired" })], base);
  // 97,5 на разбитом — это примерно те же силовые, что 102,5 на свежую голову
  assert.ok(Math.abs(устал.work1RM - норма.work1RM) / норма.work1RM < 0.04,
    `рабочий максимум разъехался: ${устал.work1RM} против ${норма.work1RM}`);
});

/* ---------- разгрузка ---------- */

test("разгрузка снимает 15% веса и не трогает рабочий максимум", () => {
  const hist = [sess(d(1), same(4, 100, 6))];
  const base = { reps: [4, 6], rir: 1, equip: "bb", sets: 4, tier: 1 };
  const full = progressionOf(hist, base);
  const dl = progressionOf(hist, { ...base, deload: true });
  assert.equal(full.target, 100);
  assert.ok(dl.target < full.target, "на разгрузке вес ниже");
  assert.ok(Math.abs(dl.target - full.target * DELOAD) <= 2.5, `−15% от ${full.target} — это ${dl.target}`);
  assert.equal(dl.work1RM, full.work1RM, "но рабочий максимум тот же: это не откат");
  assert.equal(stateOf(dl).key, "deload");
});

test("закрытая разгрузочная неделя не двигает вес ни вверх, ни вниз", () => {
  const base = { reps: [4, 6], rir: 1, equip: "bb", sets: 4, tier: 1 };
  const before = progressionOf([sess(d(1), same(4, 100, 6))], base);
  // следующим квестом идёт разгрузка: 85 кг, все повторы закрыты
  const after = progressionOf([
    sess(d(1), same(4, 100, 6)),
    sess(d(8), same(4, 85, 6), { sets: 4, reps: [4, 6], rir: 1, deload: true }),
  ], base);
  assert.equal(after.work1RM, before.work1RM, "лёгкая неделя не опустила максимум");
  assert.equal(after.target, before.target, "и вес следующего квеста остался прежним");
  assert.equal(after.move, "deload");
  assert.equal(moveLabel(after).icon, "↓");
});

test("разгрузка не считается застоем", () => {
  const base = { reps: [4, 6], rir: 1, equip: "bb", sets: 4, tier: 1 };
  const dlPlan = { sets: 4, reps: [4, 6], rir: 1, deload: true };
  const p = progressionOf([
    sess(d(1), same(4, 100, 6)),
    sess(d(8), same(4, 102.5, 6)),
    sess(d(15), same(4, 87.5, 6), dlPlan),
    sess(d(22), same(4, 87.5, 6), dlPlan),
    sess(d(29), same(4, 87.5, 6), dlPlan),
  ], base);
  assert.notEqual(stateOf(p).key, "stall", "три разгрузочных квеста подряд — это план, а не застой");
});

/* ---------- тоннаж ---------- */

test("тоннаж считает только рабочие подходы и в полном системном весе", () => {
  const t = tonnageOf([{ w: 100, r: 5 }, { w: 100, r: 5 }]);
  assert.equal(t.kg, 1000);
  assert.equal(t.sets, 2);
  assert.equal(t.reps, 10);
  // разминка в тоннаж не идёт: 40 кг при рабочих ста — это подготовка, а не работа
  const warm = tonnageOf([{ w: 40, r: 5 }, { w: 100, r: 5 }, { w: 100, r: 5 }]);
  assert.equal(warm.kg, 1000, "разминочный подход не должен раздувать тоннаж");
  assert.equal(warm.sets, 2);
  // гантели: в журнале одна, поднято две
  assert.equal(tonnageOf([{ w: 30, r: 10 }], { perHand: true }).kg, 600);
  // подтягивания: вместе с собственным весом
  assert.equal(tonnageOf([{ w: 10, r: 5 }], { bw: true, bodyweight: 90 }).kg, 500);
  assert.equal(tonnageOf([], {}).kg, 0);
  assert.equal(tonnageOf(null, {}).kg, 0);
});
