// Тесты бизнес-логики программы и пула движений: node --test tests/program.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { PROGRAM, TEMPLATES, SCHEME, METHODS, BASELINES, ARCHIVED_WORKOUTS, buildExercises, weeklyCoverage, sessionLoad, weekProgress, weekOfId, muscleTrend } from "../data/program.js";
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

test("сплит: специализированные дни и полное покрытие за неделю", () => {
  for (const wk of PROGRAM.weeks) {
    const pats = new Set();
    for (const w of wk.workouts) {
      const list = buildExercises(w);
      assert.equal(list.filter((e) => e.main).length, 1, `${w.id}: должно быть ровно одно движение дня`);
      list.forEach((e) => pats.add(EX_BY_ID[e.id].pattern));
    }
    // за неделю закрыты все ключевые паттерны
    for (const p of ["squat", "hinge", "pressH", "pressV", "pullH", "pullV", "iso", "core"]) {
      assert.ok(pats.has(p), `неделя ${wk.n}: не закрыт паттерн ${p}`);
    }
  }
});

test("каждая группа активно работает ровно в двух днях недели, по 2+ упражнения за неделю", () => {
  for (const wk of PROGRAM.weeks) {
    const cov = weeklyCoverage(wk);
    const exCount = {};
    wk.workouts.forEach((w) => {
      buildExercises(w).forEach((e) => {
        const src = EX_BY_ID[e.id];
        exCount[src.group] = (exCount[src.group] || 0) + 1;
        if (src.tier <= 2) (src.also || []).forEach((g) => { exCount[g] = (exCount[g] || 0) + 0.5; });
      });
    });
    for (const g of CORE_GROUPS) {
      assert.ok(cov[g] && cov[g].days >= 2, `неделя ${wk.n}: ${MUSCLES[g]} активно только в ${cov[g] ? cov[g].days : 0} дн.`);
      assert.ok(exCount[g] >= 2, `неделя ${wk.n}: ${MUSCLES[g]} всего ${exCount[g]} упражнение за неделю`);
    }
    // в специализированный день группа получает не одно движение, а несколько
    const upper = wk.workouts.find((w) => w.tpl === "U");
    const uCount = {};
    buildExercises(upper).forEach((e) => { const g = EX_BY_ID[e.id].group; uCount[g] = (uCount[g] || 0) + 1; });
    assert.ok(uCount.chest >= 2, `неделя ${wk.n}: в день верха грудь получает ${uCount.chest} упражнение`);
    assert.ok(uCount.back >= 2, `неделя ${wk.n}: в день верха спина получает ${uCount.back} упражнение`);
  }
});

test("волны A и B дают разные вспомогательные движения при том же движении дня", () => {
  const waveA = PROGRAM.weeks.find((w) => w.wave === "A");
  const waveB = PROGRAM.weeks.find((w) => w.wave === "B");
  assert.ok(waveA && waveB, "в цикле должны быть обе волны");
  for (const tpl of Object.keys(TEMPLATES)) {
    const a = buildExercises(waveA.workouts.find((w) => w.tpl === tpl));
    const b = buildExercises(waveB.workouts.find((w) => w.tpl === tpl));
    const idsA = a.map((e) => e.id), idsB = b.map((e) => e.id);
    const diff = idsA.filter((id) => !idsB.includes(id)).length;
    assert.ok(diff >= 3, `шаблон ${tpl}: волны отличаются всего на ${diff} движения — мало разнообразия`);
    assert.equal(a.filter((e) => e.main).length, 1);
    assert.equal(b.filter((e) => e.main).length, 1);
  }
  // движение дня в дне ног сохраняется между волнами — прогрессия не рвётся
  // (кроме квестов с точечной правкой состава, например дня становой)
  const legDays = PROGRAM.weeks.map((wk) => wk.workouts.find((w) => w.tpl === "L")).filter((w) => !w.sub);
  const mains = new Set(legDays.map((w) => buildExercises(w)[0].id));
  assert.equal(mains.size, 1, `движение дня ног скачет между квестами: ${[...mains].join(", ")}`);
});

test("приёмы интенсивности: описаны, дозированы и не вешаются на тяжёлую базу", () => {
  for (const [k, m] of Object.entries(METHODS)) {
    assert.ok(m.name && m.origin, `${k}: нет названия или источника`);
    assert.ok(m.desc.length > 40 && m.how.length > 20, `${k}: слишком короткое описание`);
  }
  for (const wk of PROGRAM.weeks) {
    for (const w of wk.workouts) {
      const list = buildExercises(w);
      const withMethod = list.filter((e) => e.method);
      assert.ok(withMethod.length <= 2, `${w.id}: ${withMethod.length} приёмов за сессию — для натурала многовато`);
      withMethod.forEach((e) => {
        assert.ok(METHODS[e.method], `${w.id}: неизвестный приём ${e.method}`);
        if (e.method !== "pyramid") {
          assert.ok(e.tier === 3, `${w.id}: приём ${e.method} висит на базовом движении ${e.id}`);
        }
      });
    }
  }
});

test("суперсеты: парные, только между разными группами, пара распадается при удалении", () => {
  for (const wk of PROGRAM.weeks) {
    for (const w of wk.workouts) {
      const list = buildExercises(w);
      const groups = {};
      list.forEach((e) => { if (e.ss) (groups[e.ss] ||= []).push(e); });
      for (const [n, pair] of Object.entries(groups)) {
        assert.equal(pair.length, 2, `${w.id}: суперсет ${n} не из двух движений`);
        assert.notEqual(EX_BY_ID[pair[0].id].group, EX_BY_ID[pair[1].id].group, `${w.id}: суперсет ${n} на одну группу`);
        assert.ok(pair[0].ssWith && pair[1].ssWith, `${w.id}: у суперсета нет партнёра в подписи`);
      }
    }
  }
  // если одно движение пары убрать, второе перестаёт быть суперсетом
  const w = PROGRAM.weeks[0].workouts[0];
  const full = buildExercises(w);
  const pair = full.find((e) => e.ss);
  const partnerId = full.find((e) => e !== pair && e.ss === pair.ss).id;
  const broken = buildExercises(w, { hide: [pair.id] });
  const partner = broken.find((e) => e.id === partnerId);
  assert.ok(partner, "партнёр должен остаться в квесте");
  assert.equal(partner.ss, null, "одинокое движение не должно оставаться суперсетом");
  assert.ok(!partner.ssWith);
});

test("схемы: силовые тяжелее и короче объёмных, база не доводится до отказа", () => {
  for (const role of ["main", "heavy", "acc", "iso", "finisher"]) {
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
  assert.equal(list[0].id, "bench");
  assert.equal(list[0].main, true);
  assert.equal(list[0].sets, SCHEME.strength.main.sets);
  assert.deepEqual(list[0].reps, SCHEME.strength.main.reps);
  assert.match(list[0].scheme, /RPE/);
  // тот же шаблон в объёмную неделю даёт другие схемы
  const volW = PROGRAM.weeks[1].workouts[0];
  const volList = buildExercises(volW);
  assert.equal(volList[0].id, "bench");
  assert.deepEqual(volList[0].reps, SCHEME.volume.main.reps);
});

test("правки атлета: замена, добавление, скрытие и защита от дублей", () => {
  const w = PROGRAM.weeks[0].workouts[0];
  const base = buildExercises(w);

  const swapped = buildExercises(w, { swap: { bench: "machine-press" } });
  assert.equal(swapped[0].id, "machine-press");
  assert.equal(swapped[0].role, "main", "замена наследует роль слота");
  assert.equal(swapped[0].main, true);
  assert.equal(swapped[0].swappedFrom, "bench");
  assert.equal(swapped.length, base.length);

  const added = buildExercises(w, { add: ["pec-deck"] });
  assert.equal(added.length, base.length + 1);
  assert.equal(added[added.length - 1].id, "pec-deck");
  assert.equal(added[added.length - 1].added, true);

  const hidden = buildExercises(w, { hide: ["face-pull"] });
  assert.equal(hidden.length, base.length - 1);
  assert.ok(!hidden.some((e) => e.id === "face-pull"));

  // добавление того, что уже есть, не создаёт дубль
  const dup = buildExercises(w, { add: ["bench"] });
  assert.equal(dup.filter((e) => e.id === "bench").length, 1);
  assert.equal(dup.length, base.length);

  // неизвестный id игнорируется, а не ломает квест
  assert.equal(buildExercises(w, { add: ["нет-такого"] }).length, base.length);
  assert.equal(buildExercises(w, { swap: { bench: "нет-такого" } }).length, base.length - 1);

  // правки не мутируют шаблон
  assert.deepEqual(buildExercises(w).map((e) => e.id), base.map((e) => e.id));
});

test("покрытие пересчитывается с учётом правок атлета", () => {
  const wk = PROGRAM.weeks[0];
  const before = weeklyCoverage(wk);
  const after = weeklyCoverage(wk, { [wk.workouts[1].id]: { hide: ["calf-standing"] } });
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
  for (const id of ["t1", "t12", "w1t1", "w4t3", "w1a", "w4c"]) assert.ok(ids.has(id), `нет архивного квеста ${id}`);
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
      if (slot.alt) assert.ok(EX_BY_ID[slot.alt], `${w.id}: альтернативы ${slot.alt} нет в пуле`);
    }
  }
});

test("доказательный минимум покрытия: оба паттерна на заднюю поверхность, обе икроножные, overhead-трицепс", () => {
  const ids = new Set(PROGRAM.weeks.flatMap((wk) => wk.workouts).flatMap((w) => buildExercises(w).map((e) => e.id)));
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

test("системная нагрузка: не больше одной максимальной базы за сессию", () => {
  for (const wk of PROGRAM.weeks) {
    for (const w of wk.workouts) {
      const list = buildExercises(w);
      const sl = sessionLoad(list);
      const bases = list.filter((e) => (EX_BY_ID[e.id].cns || 0) >= 3).map((e) => e.short);
      assert.ok(sl.maxBase <= 1, `${w.id} (${w.boss}): две максимальные базы в одном квесте — ${bases.join(" + ")}`);
      assert.equal(sl.overload, false, `${w.id}: квест помечен как перегруженный`);
    }
  }
});

test("системная нагрузка: приседание и становая никогда не встречаются в одном квесте", () => {
  for (const wk of PROGRAM.weeks) {
    for (const w of wk.workouts) {
      const ids = new Set(buildExercises(w).map((e) => e.id));
      assert.ok(!(ids.has("squat") && ids.has("deadlift")), `${w.id}: присед и становая в один день`);
      assert.ok(!(ids.has("deadlift") && ids.has("front-squat")), `${w.id}: становая и фронтальный присед в один день`);
      // после становой не грузим поясницу отдельно
      if (ids.has("deadlift")) {
        for (const back of ["back-ext-45", "hyper", "good-morning"]) {
          assert.ok(!ids.has(back), `${w.id}: работа на поясницу (${back}) в день становой`);
        }
      }
    }
  }
});

test("системная нагрузка квеста держится в границах натурала", () => {
  for (const wk of PROGRAM.weeks) {
    for (const w of wk.workouts) {
      const list = buildExercises(w);
      const sl = sessionLoad(list);
      assert.ok(sl.load <= 12, `${w.id} (${w.boss}): нагрузка ${sl.load} — слишком тяжёлый квест`);
      assert.ok(sl.load >= 5, `${w.id}: нагрузка ${sl.load} — квест подозрительно лёгкий`);
      assert.ok(sl.compound <= 5, `${w.id}: ${sl.compound} многосуставных за сессию`);
      // тяжёлые многосуставные (cns ≥ 2) не идут в многоповторку
      list.forEach((e) => {
        const cns = EX_BY_ID[e.id].cns || 0;
        if (cns >= 3) assert.ok(e.reps[1] <= 10, `${w.id}: ${e.short} на ${e.reps[1]} повторов — максимальная база так не делается`);
        if (cns >= 2) assert.ok(e.reps[1] <= 15, `${w.id}: ${e.short} на ${e.reps[1]} повторов`);
      });
    }
  }
});

test("становая есть в цикле ровно один раз и только в силовом квесте", () => {
  const days = [];
  for (const wk of PROGRAM.weeks) {
    for (const w of wk.workouts) {
      if (buildExercises(w).some((e) => e.id === "deadlift")) days.push({ w, wk });
    }
  }
  assert.equal(days.length, 1, `становая встречается ${days.length} раз за цикл`);
  assert.equal(days[0].w.type, "strength", "становая должна стоять в силовом квесте, а не в объёмном");
  const list = buildExercises(days[0].w);
  assert.equal(list[0].id, "deadlift", "в свой день становая — движение дня");
  assert.ok(list[0].reps[1] <= 6, "становая идёт в силовом диапазоне повторов");
});

test("точечная правка квеста (sub): заменяет и снимает слоты, не трогая шаблон", () => {
  const wk = PROGRAM.weeks.find((x) => x.workouts.some((w) => w.sub));
  const w = wk.workouts.find((x) => x.sub);
  const list = buildExercises(w);
  const ids = list.map((e) => e.id);
  for (const [from, to] of Object.entries(w.sub)) {
    assert.ok(!ids.includes(from), `${w.id}: ${from} должен быть заменён или снят`);
    if (to) assert.ok(ids.includes(to), `${w.id}: ${to} не попал в квест`);
  }
  assert.equal(list.length, TEMPLATES[w.tpl].slots.length - Object.values(w.sub).filter((v) => v === null).length);
  // шаблон не изменился: другой квест того же шаблона собирается по умолчанию
  const plain = PROGRAM.weeks.flatMap((x) => x.workouts).find((x) => x.tpl === w.tpl && !x.sub);
  assert.ok(!buildExercises(plain).some((e) => e.id === "deadlift"));
});

test("правки атлета тоже проверяются на перегруз", () => {
  const legDay = PROGRAM.weeks[0].workouts.find((w) => w.tpl === "L");
  const ok = sessionLoad(buildExercises(legDay));
  assert.equal(ok.overload, false);
  // если атлет сам поставит становую рядом с приседом — движок это видит
  const bad = sessionLoad(buildExercises(legDay, { swap: { rdl: "deadlift" } }));
  assert.equal(bad.maxBase, 2);
  assert.equal(bad.overload, true, "две максимальные базы должны помечаться как перегруз");
  assert.equal(bad.level, "high");
});

/* ---------- синхронизация журнала между устройствами одного пользователя ---------- */
import { decideSync } from "../js/telegram.js";

test("синхронизация: направление выбирается по ревизиям", () => {
  // первое устройство: облака ещё нет
  assert.equal(decideSync({ rev: 5, syncedRev: 0 }, null), "push");
  assert.equal(decideSync({ rev: 0, syncedRev: 0 }, null), "none", "пустой журнал нечего заливать");
  // новое устройство того же пользователя: локально пусто, в облаке журнал
  assert.equal(decideSync({ rev: 0, syncedRev: 0 }, { rev: 12 }), "pull");
  // писали с другого телефона, здесь с тех пор ничего не меняли
  assert.equal(decideSync({ rev: 5, syncedRev: 5 }, { rev: 8 }), "pull");
  // здесь тренировались, облако отстало
  assert.equal(decideSync({ rev: 9, syncedRev: 5 }, { rev: 5 }), "push");
  // ревизии совпали — синхронизировать нечего
  assert.equal(decideSync({ rev: 7, syncedRev: 7 }, { rev: 7 }), "none");
  // и здесь тренировались, и с другого телефона — спрашиваем пользователя
  assert.equal(decideSync({ rev: 7, syncedRev: 5 }, { rev: 8 }), "conflict");
});

test("синхронизация: устойчива к пустым и битым метаданным", () => {
  assert.equal(decideSync(null, null), "none");
  assert.equal(decideSync({}, {}), "none");
  assert.equal(decideSync({ rev: 3 }, {}), "push");
  assert.equal(decideSync({}, { rev: 3 }), "pull");
  // ревизия из облака меньше, чем уже синхронизированная — облако отстало, льём своё
  assert.equal(decideSync({ rev: 10, syncedRev: 10 }, { rev: 4 }), "push");
});

/* ---------- свёрнутые недели: что показывает полоска-итог ---------- */

test("итог недели считает пройденные квесты, а не заходы", () => {
  const wk = PROGRAM.weeks[0];
  const ids = wk.workouts.map((w) => w.id);
  const s = (id) => ({ id: id + Math.random(), workoutId: id });
  assert.deepEqual(weekProgress(wk, []), { done: 0, total: 3, complete: false });
  assert.deepEqual(weekProgress(wk, [s(ids[0]), s(ids[0]), s(ids[0])]),
    { done: 1, total: 3, complete: false }, "три захода в один квест — это один пройденный");
  assert.deepEqual(weekProgress(wk, ids.map(s)), { done: 3, total: 3, complete: true });
});

test("квесты чужих недель и мусор в журнале не попадают в итог", () => {
  const wk = PROGRAM.weeks[0];
  const other = PROGRAM.weeks[2].workouts[0].id;
  const rows = [{ workoutId: other }, { workoutId: "t7" }, null, {}, { workoutId: wk.workouts[1].id }];
  assert.deepEqual(weekProgress(wk, rows), { done: 1, total: 3, complete: false });
  assert.deepEqual(weekProgress(null, [{ workoutId: "w1u" }]), { done: 0, total: 0, complete: false });
  assert.deepEqual(weekProgress(wk, "не массив"), { done: 0, total: 3, complete: false });
});

test("неделя квеста находится — по ней раскрывается нужный блок", () => {
  for (const wk of PROGRAM.weeks) {
    for (const w of wk.workouts) assert.equal(weekOfId(w.id), wk.n, `${w.id} должен лежать в неделе ${wk.n}`);
  }
  assert.equal(weekOfId("t7"), null, "архивный квест ни в одной неделе текущего цикла не лежит");
});

/* ---------- объём мышцы по неделям цикла ---------- */

test("тренд мышцы даёт запись на каждую неделю цикла", () => {
  const t = muscleTrend("chest");
  assert.equal(t.length, PROGRAM.weeks.length);
  assert.deepEqual(t.map((x) => x.n), PROGRAM.weeks.map((w) => w.n));
  for (const x of t) {
    assert.ok(Number.isFinite(x.sets) && x.sets >= 0, "сеты должны быть числом");
    assert.ok(Number.isInteger(x.days) && x.days >= 0, "дни должны быть целым числом");
  }
});

test("тренд совпадает с недельным покрытием той же недели", () => {
  for (const g of ["chest", "back", "hams", "lowback"]) {
    const t = muscleTrend(g);
    PROGRAM.weeks.forEach((wk, i) => {
      const cov = weeklyCoverage(wk, {})[g] || { sets: 0, days: 0 };
      assert.equal(t[i].sets, cov.sets || 0, `${g}, неделя ${wk.n}: сеты разошлись`);
      assert.equal(t[i].days, cov.days || 0, `${g}, неделя ${wk.n}: дни разошлись`);
    });
  }
});

test("тренд показывает реальный разброс, а не ровную линию", () => {
  // если бы объём был одинаков во всех неделях, полоска не несла бы смысла
  const varying = MUSCLE_ORDER.filter((g) => new Set(muscleTrend(g).map((x) => x.sets)).size > 1);
  assert.ok(varying.length >= 5, `по неделям гуляет всего ${varying.length} групп`);
  // разгибатели спины проседают в третьей неделе — это и должно быть видно
  const low = muscleTrend("lowback");
  assert.ok(low[2].sets < low[0].sets, "в неделе 3 разгибателям достаётся меньше");
});

test("мышцы вне плана дают нули, а не дырки", () => {
  const t = muscleTrend("нет-такой-мышцы");
  assert.equal(t.length, PROGRAM.weeks.length);
  assert.ok(t.every((x) => x.sets === 0 && x.days === 0));
});
