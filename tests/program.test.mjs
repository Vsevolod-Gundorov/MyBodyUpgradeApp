// Тесты бизнес-логики программы и пула движений: node --test tests/program.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { PROGRAM, TEMPLATES, SCHEME, BASELINES, ARCHIVED_WORKOUTS, buildExercises, weeklyCoverage } from "../data/program.js";
import { EXERCISES, EX_BY_ID, exById, MUSCLES, MUSCLE_ORDER, PATTERNS, EQUIP, workingWeight, pctOf1RM, similarTo } from "../data/exercises.js";

// группы, которые обязаны прорабатываться не реже 2 раз в неделю
const CORE_GROUPS = ["chest", "back", "delts", "biceps", "triceps", "quads", "hams", "glutes", "calves", "abs"];
const allWorkouts = () => PROGRAM.weeks.flatMap((w) => w.workouts);

test("пул: уникальные id и имена, валидные поля, коэффициенты заданы", () => {
  assert.ok(EXERCISES.length >= 50, "пул должен быть содержательным");
  assert.equal(new Set(EXERCISES.map((e) => e.id)).size, EXERCISES.length);
  assert.equal(new Set(EXERCISES.map((e) => e.name)).size, EXERCISES.length);
  for (const e of EXERCISES) {
    assert.ok(MUSCLES[e.group], `группа ${e.group} у ${e.id}`);
    assert.ok(PATTERNS[e.pattern], `паттерн ${e.pattern} у ${e.id}`);
    assert.ok(EQUIP[e.equip], `снаряд ${e.equip} у ${e.id}`);
    assert.ok([1, 2, 3].includes(e.tier), `tier у ${e.id}`);
    assert.ok(e.desc && e.desc.length > 30, `описание у ${e.id}`);
    assert.ok((e.cues || []).length >= 2, `техника у ${e.id}`);
    (e.also || []).forEach((g) => assert.ok(MUSCLES[g], `вторичная группа ${g} у ${e.id}`));
    if (e.k) assert.ok(BASELINES[e.ref] !== undefined, `ref ${e.ref} у ${e.id} должен быть базовым лифтом`);
  }
  // каждая группа из «Арсенала» реально чем-то представлена
  for (const g of MUSCLE_ORDER) assert.ok(EXERCISES.some((e) => e.group === g), `нет движений на ${MUSCLES[g]}`);
});

test("пул покрывает все двигательные паттерны", () => {
  for (const p of Object.keys(PATTERNS)) assert.ok(EXERCISES.some((e) => e.pattern === p), `нет движений паттерна ${p}`);
});

test("периодизация: в каждой неделе либо 2 силовых, либо 2 объёмных", () => {
  assert.equal(PROGRAM.weeks.length, 4);
  for (const wk of PROGRAM.weeks) {
    assert.equal(wk.workouts.length, 3, `неделя ${wk.n}: 3 квеста`);
    const st = wk.workouts.filter((w) => w.type === "strength").length;
    const vol = wk.workouts.filter((w) => w.type === "volume").length;
    assert.equal(st + vol, 3, `неделя ${wk.n}: только известные типы`);
    assert.ok((st === 2 && vol === 1) || (vol === 2 && st === 1), `неделя ${wk.n}: ${st} силовых / ${vol} объёмных — нужно 2+1`);
    assert.equal(wk.emphasis, st === 2 ? "strength" : "volume", `акцент недели ${wk.n}`);
  }
  // акценты чередуются
  const em = PROGRAM.weeks.map((w) => w.emphasis);
  assert.deepEqual(em, ["strength", "volume", "strength", "volume"]);
});

test("каждая мышечная группа прорабатывается минимум 2 раза в неделю", () => {
  for (const wk of PROGRAM.weeks) {
    const cov = weeklyCoverage(wk);
    for (const g of CORE_GROUPS) {
      assert.ok(cov[g], `неделя ${wk.n}: ${MUSCLES[g]} не нагружается вовсе`);
      assert.ok(cov[g].days >= 2, `неделя ${wk.n}: ${MUSCLES[g]} только ${cov[g].days} раз(а)`);
    }
  }
});

test("недельный объём на группу в разумных границах (не меньше 6 и не больше 25 сетов)", () => {
  for (const wk of PROGRAM.weeks) {
    const cov = weeklyCoverage(wk);
    for (const g of CORE_GROUPS) {
      assert.ok(cov[g].sets >= 6, `неделя ${wk.n}: ${MUSCLES[g]} всего ${cov[g].sets} сетов`);
      assert.ok(cov[g].sets <= 25, `неделя ${wk.n}: ${MUSCLES[g]} аж ${cov[g].sets} сетов — выше разумного потолка`);
    }
  }
});

test("объём за одну сессию не превышает потолок: ~10 сетов на группу и 30 суммарно", () => {
  for (const w of allWorkouts()) {
    const list = buildExercises(w);
    const total = list.reduce((a, e) => a + e.sets, 0);
    assert.ok(total <= 30, `${w.id}: ${total} сетов за квест — слишком много`);
    const perGroup = {};
    list.forEach((e) => { const src = EX_BY_ID[e.id]; perGroup[src.group] = (perGroup[src.group] || 0) + e.sets; });
    for (const [g, sets] of Object.entries(perGroup)) {
      assert.ok(sets <= 10, `${w.id}: ${MUSCLES[g]} получает ${sets} сетов за сессию`);
    }
  }
});

test("каждый квест закрывает жим, тягу и работу ног", () => {
  for (const w of allWorkouts()) {
    const pats = new Set(buildExercises(w).map((e) => EX_BY_ID[e.id].pattern));
    assert.ok(pats.has("pressH") || pats.has("pressV"), `${w.id}: нет жима`);
    assert.ok(pats.has("pullH") || pats.has("pullV"), `${w.id}: нет тяги`);
    assert.ok(pats.has("squat") || pats.has("lunge"), `${w.id}: нет работы на квадрицепс`);
    assert.ok(pats.has("hinge") || buildExercises(w).some((e) => EX_BY_ID[e.id].group === "hams"), `${w.id}: нет задней цепи`);
    assert.ok(buildExercises(w).filter((e) => e.main).length === 1, `${w.id}: должно быть ровно одно движение дня`);
  }
});

test("схемы: силовые тяжелее и короче объёмных, база не доводится до отказа", () => {
  for (const role of ["main", "heavy", "acc", "iso"]) {
    const st = SCHEME.strength[role], vol = SCHEME.volume[role];
    assert.ok(st.reps[1] <= vol.reps[0], `${role}: силовые повторы должны быть ниже объёмных`);
    assert.ok(st.sets >= 3 && vol.sets >= 3);
  }
  assert.ok(SCHEME.strength.main.rir >= 1, "движение дня в силовой не до отказа");
  assert.ok(SCHEME.strength.main.sets <= 5, "больше 4–5 рабочих сетов на силу за сессию не нужно");
  assert.ok(SCHEME.volume.iso.reps[1] >= 15, "изоляция в объёмной — многоповторка");
});

test("сборка квеста: состав, роли и схемы", () => {
  const w = PROGRAM.weeks[0].workouts[0];
  const list = buildExercises(w);
  assert.equal(list.length, TEMPLATES[w.tpl].slots.length);
  assert.equal(list[0].id, "squat");
  assert.equal(list[0].main, true);
  assert.equal(list[0].sets, SCHEME.strength.main.sets);
  assert.deepEqual(list[0].reps, SCHEME.strength.main.reps);
  assert.match(list[0].scheme, /RPE/);
  // тот же шаблон в объёмную неделю даёт другие схемы
  const volW = PROGRAM.weeks[1].workouts[0];
  const volList = buildExercises(volW);
  assert.equal(volList[0].id, "squat");
  assert.deepEqual(volList[0].reps, SCHEME.volume.main.reps);
});

test("правки атлета: замена, добавление, скрытие и защита от дублей", () => {
  const w = PROGRAM.weeks[0].workouts[0];
  const base = buildExercises(w);

  const swapped = buildExercises(w, { swap: { squat: "front-squat" } });
  assert.equal(swapped[0].id, "front-squat");
  assert.equal(swapped[0].role, "main", "замена наследует роль слота");
  assert.equal(swapped[0].main, true);
  assert.equal(swapped[0].swappedFrom, "squat");
  assert.equal(swapped.length, base.length);

  const added = buildExercises(w, { add: ["pec-deck"] });
  assert.equal(added.length, base.length + 1);
  assert.equal(added[added.length - 1].id, "pec-deck");
  assert.equal(added[added.length - 1].added, true);

  const hidden = buildExercises(w, { hide: ["abs"] });
  assert.equal(hidden.length, base.length - 1);
  assert.ok(!hidden.some((e) => e.id === "abs"));

  // добавление того, что уже есть, не создаёт дубль
  const dup = buildExercises(w, { add: ["squat"] });
  assert.equal(dup.filter((e) => e.id === "squat").length, 1);
  assert.equal(dup.length, base.length);

  // неизвестный id игнорируется, а не ломает квест
  assert.equal(buildExercises(w, { add: ["нет-такого"] }).length, base.length);
  assert.equal(buildExercises(w, { swap: { squat: "нет-такого" } }).length, base.length - 1);

  // правки не мутируют шаблон
  assert.deepEqual(buildExercises(w).map((e) => e.id), base.map((e) => e.id));
});

test("покрытие пересчитывается с учётом правок атлета", () => {
  const wk = PROGRAM.weeks[0];
  const before = weeklyCoverage(wk);
  const after = weeklyCoverage(wk, { [wk.workouts[0].id]: { hide: ["calf-standing"] } });
  assert.ok(after.calves.days < before.calves.days || after.calves.sets < before.calves.sets,
    "снятие упражнения должно уменьшать покрытие группы");
});

test("процент от 1ПМ: падает с повторами и с запасом RIR", () => {
  assert.ok(pctOf1RM(1, 0) > pctOf1RM(5, 0));
  assert.ok(pctOf1RM(5, 0) > pctOf1RM(12, 0));
  assert.ok(pctOf1RM(8, 0) > pctOf1RM(8, 2), "запас повторов снижает вес");
  assert.ok(Math.abs(pctOf1RM(1, 0) - 0.968) < 0.01);
  assert.ok(pctOf1RM(10, 1) > 0.6 && pctOf1RM(10, 1) < 0.8);
});

test("рабочий вес: оценка от базы, приоритет собственных замеров, шаг округления", () => {
  const opts = { baselines: BASELINES, bodyweight: 93, reps: [5, 6], rir: 2 };
  const bench = workingWeight(exById("bench"), { ...opts, e1rm: {} });
  assert.equal(bench.source, "estimate");
  assert.ok(bench.lo > 100 && bench.hi < 147, `жим ${bench.lo}–${bench.hi} должен быть рабочим, а не максимальным`);
  assert.ok(bench.lo <= bench.hi);
  assert.equal(bench.lo % 2.5, 0, "штанга округляется до 2,5 кг");

  // собственный замер сильнее оценки
  const strong = workingWeight(exById("bench"), { ...opts, e1rm: { bench: 200 } });
  assert.equal(strong.source, "own");
  assert.ok(strong.hi > bench.hi);

  // гантельное движение считается на руку и округляется до 2 кг
  const db = workingWeight(exById("incline-db"), { ...opts, e1rm: {}, reps: [8, 12] });
  assert.equal(db.perHand, true);
  assert.equal(db.lo % 2, 0);
  assert.ok(db.hi < bench.hi, "вес одной гантели меньше штанги");

  // свой вес: возвращается довесок, а не полная нагрузка
  const pull = workingWeight(exById("pullup"), { ...opts, e1rm: {}, reps: [6, 8] });
  assert.equal(pull.bw, true);
  assert.ok(pull.hi < 60, `довесок ${pull.hi} должен быть небольшим относительно своего веса`);
  const heavyGuy = workingWeight(exById("pullup"), { ...opts, e1rm: {}, bodyweight: 130, reps: [6, 8] });
  assert.ok(heavyGuy.hi < pull.hi, "чем тяжелее атлет, тем меньше довесок");

  // без данных о силе — без выдуманных цифр
  const none = workingWeight(exById("plank"), { ...opts, e1rm: {}, baselines: {} });
  assert.equal(none.source, "none");
  assert.equal(none.hi, 0);
  assert.equal(workingWeight(null, opts), null);
});

test("рабочий вес растёт вместе с замерами атлета по каждому движению", () => {
  const before = workingWeight(exById("legpress"), { e1rm: {}, baselines: BASELINES, bodyweight: 93, reps: [8, 10], rir: 1 });
  const after = workingWeight(exById("legpress"), { e1rm: { legpress: 400 }, baselines: BASELINES, bodyweight: 93, reps: [8, 10], rir: 1 });
  assert.equal(before.source, "estimate");
  assert.equal(after.source, "own");
  assert.ok(after.lo > before.lo);
});

test("подбор замен: тот же паттерн или та же группа, без самого себя", () => {
  const alt = similarTo("bench");
  assert.ok(alt.length >= 3);
  assert.ok(!alt.some((e) => e.id === "bench"));
  assert.ok(alt.some((e) => e.id === "incline-bb" || e.id === "flat-db" || e.id === "machine-press"));
  const legs = similarTo("squat");
  assert.ok(legs.every((e) => e.pattern === "squat" || e.group === "quads" || (e.also || []).includes("quads")));
  assert.deepEqual(similarTo("нет-такого"), []);
});

test("архив прошлых циклов сохранён: старые сессии не осиротеют", () => {
  const ids = new Set(ARCHIVED_WORKOUTS.map((w) => w.id));
  for (const id of ["t1", "t12", "w1t1", "w4t3"]) assert.ok(ids.has(id), `нет архивного квеста ${id}`);
  for (const w of ARCHIVED_WORKOUTS) {
    assert.ok(w.exercises.length > 0, `${w.id} без упражнений`);
    assert.ok(w.boss, `${w.id} без имени`);
    w.exercises.forEach((e) => assert.ok(e.id && e.name, `${w.id}: упражнение без id/имени`));
  }
  // id текущего цикла не пересекаются с архивом
  allWorkouts().forEach((w) => assert.ok(!ids.has(w.id), `id ${w.id} конфликтует с архивом`));
});

test("движения квестов существуют в пуле и имеют стабильные id", () => {
  for (const w of allWorkouts()) {
    for (const slot of TEMPLATES[w.tpl].slots) {
      assert.ok(EX_BY_ID[slot.ex], `${w.id}: движения ${slot.ex} нет в пуле`);
    }
  }
});

test("доказательный минимум покрытия: оба паттерна на заднюю поверхность, обе икроножные, overhead-трицепс", () => {
  const week = PROGRAM.weeks[0];
  const ids = new Set(week.workouts.flatMap((w) => buildExercises(w).map((e) => e.id)));
  // бицепс бедра: тазовое доминирование + сгибание голени (разные головки)
  assert.ok([...ids].some((id) => EX_BY_ID[id].pattern === "hinge" && (EX_BY_ID[id].group === "hams" || (EX_BY_ID[id].also || []).includes("hams"))));
  assert.ok(ids.has("legcurl-s"), "сгибания сидя грузят хамстринги лучше, чем лёжа (Maeo 2021)");
  // икры: стоя (икроножная) и сидя (камбаловидная)
  assert.ok(ids.has("calf-standing") && ids.has("calf-seated"));
  // трицепс из-за головы — длинная головка (Maeo 2023)
  assert.ok(ids.has("french-db"));
  // прямая мышца бедра от приседа почти не растёт — нужны разгибания
  assert.ok(ids.has("legext"));
  // средняя дельта: жимы её не закрывают
  assert.ok(ids.has("lat-raise") || ids.has("cable-lat-raise"));
});
