// Цикл IV — Волна (v4). 3 квеста/нед · 4 недели.
//
// Периодизация: дневная волна (DUP). Три фулбоди-шаблона A/B/C, каждый выходит раз в неделю,
// но с разным акцентом. Внутри недели акценты всегда 2 + 1:
//   нечётная неделя → 2 СИЛОВЫХ + 1 объёмная
//   чётная неделя   → 2 ОБЪЁМНЫХ + 1 силовая
// За две недели каждое движение получает и тяжёлую, и объёмную работу.
//
// Частота: каждая мышечная группа нагружается 2–3 раза в неделю (проверяется тестами) —
// при равном недельном объёме это удобнее распределяет сеты и держит их качество.
// Недели 3–4 повторяют волну с прогрессией по весу.
//
// Веса в квесте НЕ зашиты: считаются под атлета из его замеров 1ПМ и коэффициентов пула
// (data/exercises.js → workingWeight). Пул также позволяет заменить или добавить упражнение.
import { EX_BY_ID } from "./exercises.js";

/* ---------- схемы подходов: роль упражнения × тип сессии ---------- */
// rir — запас повторов (0 = до отказа). Для базы держим 1–2: близость к отказу
// почти не добавляет гипертрофии, но сильно бьёт по восстановлению.
export const SCHEME = {
  strength: {
    main:  { sets: 4, reps: [3, 5],   rir: 1, tag: "RPE 8–9" },
    heavy: { sets: 4, reps: [5, 6],   rir: 2, tag: "RPE 8" },
    acc:   { sets: 3, reps: [6, 8],   rir: 2, tag: "RIR 2" },
    iso:   { sets: 3, reps: [10, 12], rir: 1, tag: "RIR 1" },
  },
  volume: {
    main:  { sets: 4, reps: [8, 10],  rir: 2, tag: "RIR 1–2" },
    heavy: { sets: 4, reps: [10, 12], rir: 2, tag: "RIR 1–2" },
    acc:   { sets: 3, reps: [12, 15], rir: 1, tag: "RIR 1" },
    iso:   { sets: 3, reps: [15, 20], rir: 1, tag: "RIR 0–1" },
  },
};
export const ROLE_NAMES = { main: "движение дня", heavy: "вторая база", acc: "вспомогательное", iso: "изоляция" };
export const TYPE_NAMES = { strength: "силовая", volume: "объёмная" };

/* ---------- три фулбоди-шаблона ---------- */
// Каждый закрывает: приседание, тазовое доминирование, жим, тягу, изоляцию и кор.
export const TEMPLATES = {
  A: {
    key: "A", name: "Присед + горизонтальный жим",
    why: "Тяжёлое приседание и жим лёжа в начале, дальше тяга и тазовое доминирование. Средняя дельта и икры — изоляцией, их жимы не закрывают.",
    slots: [
      { ex: "squat",         role: "main" },
      { ex: "bench",         role: "heavy" },
      { ex: "row",           role: "acc" },
      { ex: "rdl",           role: "acc" },
      { ex: "lat-raise",     role: "iso" },
      { ex: "calf-standing", role: "iso" },
      { ex: "abs",           role: "iso" },
    ],
  },
  B: {
    key: "B", name: "Становая + вертикальный жим",
    why: "Становая как главный hinge, швунг как вертикальный жим. Подтягивания дают вторую линию тяги, наклонные сгибания грузят бицепс в растяжении.",
    slots: [
      { ex: "deadlift",   role: "main" },
      { ex: "push-press", role: "heavy" },
      { ex: "pullup",     role: "acc" },
      { ex: "legpress",   role: "acc" },
      { ex: "incline-db", role: "acc" },
      { ex: "incline-curl", role: "iso" },
      { ex: "calf-seated", role: "iso" },
      { ex: "hanging-leg", role: "iso" },
    ],
  },
  C: {
    key: "C", name: "Наклонный жим + тяга",
    why: "Верх груди (наклон 30–45°) и горизонтальная тяга. Разгибания сидя — под прямую мышцу бедра, из-за головы — под длинную головку трицепса (Maeo 2023).",
    slots: [
      { ex: "incline-bb", role: "main" },
      { ex: "cable-row",  role: "heavy" },
      { ex: "hack",       role: "acc" },
      { ex: "legcurl-s",  role: "acc" },
      { ex: "legext",     role: "iso" },
      { ex: "face-pull",  role: "iso" },
      { ex: "french-db",  role: "iso" },
      { ex: "cable-crunch", role: "iso" },
    ],
  },
};

/* ---------- 4 недели волны ---------- */
const W = (id, tpl, type, boss, icon, prog = 0) => ({ id, tpl, type, boss, icon, prog });
export const PROGRAM = {
  cycleName: "Цикл IV — Волна",
  note: "Недели 1 и 3 — две силовых и одна объёмная, недели 2 и 4 — наоборот. Каждая группа мышц работает 2–3 раза в неделю. Прогрессия двойная: сначала добираешь повторы в вилке, потом вес. Разгрузка не обязательна — делай её по состоянию раз в 6–10 недель, срезая объём на 40–50% при той же интенсивности.",
  weeks: [
    {
      n: 1, emphasis: "strength", saga: "Сага о Пробуждении",
      workouts: [
        W("w1a", "A", "strength", "Столпы Земли", "pillars"),
        W("w1b", "B", "volume",   "Песнь Выдержки", "hourglass"),
        W("w1c", "C", "strength", "Восхождение по Склону", "mountain"),
      ],
    },
    {
      n: 2, emphasis: "volume", saga: "Сага о Полноте",
      workouts: [
        W("w2a", "A", "volume",   "Корни Титана", "tree"),
        W("w2b", "B", "strength", "Гнев Хребта", "spine"),
        W("w2c", "C", "volume",   "Пламя Полноты", "sun"),
      ],
    },
    {
      n: 3, emphasis: "strength", saga: "Сага о Закалке",
      workouts: [
        W("w3a", "A", "strength", "Пробуждение Стали", "anvil", 0.025),
        W("w3b", "B", "volume",   "Расправить Крылья", "wings", 0.025),
        W("w3c", "C", "strength", "Клинок Закалённый", "dagger", 0.025),
      ],
    },
    {
      n: 4, emphasis: "volume", saga: "Сага о Вершине",
      workouts: [
        W("w4a", "A", "volume",   "Бастион Ног", "tower", 0.025),
        W("w4b", "B", "strength", "Второе Пламя", "flame", 0.05),
        W("w4c", "C", "volume",   "Вершина Цикла", "peak", 0.025),
      ],
    },
  ],
};

/* ---------- сборка квеста: шаблон + правки атлета → список упражнений ---------- */
// plan (необязательный) — правки пользователя для конкретного квеста:
//   { swap: { исходныйId: новыйId }, add: [id, ...], hide: [id, ...] }
// Чистая функция: веса здесь не считаются (их добавляет приложение по замерам атлета).
export function buildExercises(workout, plan = {}) {
  const tpl = TEMPLATES[workout.tpl];
  if (!tpl) return [];
  const scheme = SCHEME[workout.type] || SCHEME.strength;
  const swap = plan.swap || {};
  const hide = new Set(plan.hide || []);
  const slots = tpl.slots
    .filter((s) => !hide.has(s.ex))
    .map((s) => ({ ...s, ex: swap[s.ex] || s.ex, from: swap[s.ex] ? s.ex : null }));
  (plan.add || []).forEach((id) => { if (!hide.has(id)) slots.push({ ex: id, role: "iso", added: true }); });

  const out = [];
  const seen = new Set();
  slots.forEach((slot) => {
    const ex = EX_BY_ID[slot.ex];
    if (!ex || seen.has(ex.id)) return;   // неизвестное или дублирующее движение пропускаем
    seen.add(ex.id);
    const sc = scheme[slot.role] || scheme.iso;
    out.push({
      id: ex.id, name: ex.name, short: ex.short || ex.name,
      role: slot.role, main: slot.role === "main",
      lift: ex.lift, tier: ex.tier, equip: ex.equip, group: ex.group, pattern: ex.pattern,
      sets: sc.sets, reps: sc.reps, rir: sc.rir,
      scheme: `${sc.sets} × ${sc.reps[0]}${sc.reps[1] !== sc.reps[0] ? "–" + sc.reps[1] : ""} · ${sc.tag}`,
      prog: workout.prog || 0,
      swappedFrom: slot.from || null, added: !!slot.added,
    });
  });
  return out;
}

/** Недельный объём по мышечным группам: сколько сессий и рабочих подходов получает группа. */
export function weeklyCoverage(week, plans = {}) {
  const cover = {};
  const touch = (g, sets, wid) => {
    if (!g) return;
    const c = (cover[g] ||= { sets: 0, sessions: new Set() });
    c.sets += sets; c.sessions.add(wid);
  };
  week.workouts.forEach((w) => {
    buildExercises(w, plans[w.id]).forEach((ex) => {
      const src = EX_BY_ID[ex.id];
      if (!src) return;
      touch(src.group, ex.sets, w.id);
      (src.also || []).forEach((g) => touch(g, ex.sets / 2, w.id)); // вторичные считаем за половину
    });
  });
  return Object.fromEntries(Object.entries(cover).map(([g, c]) => [g, { sets: Math.round(c.sets), days: c.sessions.size }]));
}

// Базовые расчётные максимумы (старт персонажа)
export const BASELINES = { bench: 147, squat: 170, deadlift: 195, ohp: 100 };
export const LIFT_NAMES = { bench: "Жим лёжа", squat: "Присед", deadlift: "Становая", ohp: "Швунг" };

/* ---------- архив прошлых циклов ----------
   Нужен, чтобы старые сессии в «Хрониках» открывались и их движения по-прежнему
   учитывались в аналитике потолка/пола (id движений совпадают с пулом). */
const ax = (id, name, extra = {}) => ({ id, name, sets: 3, reps: [6, 10], ...extra });
export const ARCHIVED_WORKOUTS = [
  // Цикл III (Сила/Объём)
  { id: "t1", boss: "Пробуждение Стали", icon: "anvil", title: "Верх тяжёлый А", exercises: [ax("bench", "Жим штанги лёжа", { main: true, lift: "bench", sets: 5 }), ax("row", "Тяга штанги в наклоне", { sets: 4 }), ax("push-press", "Швунг / армейский жим стоя", { lift: "ohp" }), ax("pullup", "Подтягивания с весом"), ax("dips", "Брусья / жим узким"), ax("curl-ez", "Сгибания EZ-гриф"), ax("abs", "Пресс в тренажёре")] },
  { id: "t2", boss: "Столпы Земли", icon: "pillars", title: "Низ тяжёлый — присед", exercises: [ax("squat", "Приседания", { main: true, lift: "squat", sets: 5 }), ax("rdl", "Мёртвая тяга"), ax("legpress", "Жим ногами"), ax("legcurl-s", "Сгибания ног сидя"), ax("calves", "Икры", { sets: 4 }), ax("abs", "Пресс в тренажёре")] },
  { id: "t3", boss: "Восхождение по Склону", icon: "mountain", title: "Верх тяжёлый Б", exercises: [ax("incline-bb", "Жим штанги в наклоне", { main: true, sets: 5 }), ax("db-row", "Тяга гантели в наклоне", { sets: 4 }), ax("lat", "Верхняя тяга"), ax("db-ohp", "Жим гантели сидя"), ax("upright", "Тяга к подбородку"), ax("french-bb", "Французский жим лёжа"), ax("abs", "Пресс в тренажёре")] },
  { id: "t4", boss: "Песнь Выдержки", icon: "hourglass", title: "Низ объёмный А", exercises: [ax("squat-vol", "Присед многоповторный", { main: true, lift: "squat", sets: 4 }), ax("legext", "Разгибания ног сидя"), ax("legcurl-s", "Сгибания ног сидя"), ax("hyper", "Гиперэкстензия"), ax("calves", "Икры", { sets: 4 }), ax("abs", "Пресс в тренажёре")] },
  { id: "t5", boss: "Пламя Полноты", icon: "sun", title: "Верх объёмный А", exercises: [ax("incline-db", "Жим гантелей в наклоне", { main: true, sets: 4 }), ax("cross-mid", "Кроссовер на грудь"), ax("lat-raise", "Махи стоя", { sets: 4 }), ax("cross-delt", "Разводка плечи"), ax("lat", "Верхняя тяга", { sets: 4 }), ax("cable-row", "Тяга к поясу"), ax("rear-delt", "Задняя дельта"), ax("french-db", "Французский жим стоя"), ax("abs", "Пресс в тренажёре")] },
  { id: "t6", boss: "Корни Титана", icon: "tree", title: "Низ объёмный Б", exercises: [ax("rdl", "Мёртвая тяга", { main: true, sets: 4 }), ax("hack", "Присед в гак-машине"), ax("legpress", "Жим ногами"), ax("legcurl-l", "Сгибания ног лёжа"), ax("calves", "Икры", { sets: 4 }), ax("abs", "Пресс в тренажёре")] },
  { id: "t7", boss: "Гнев Хребта", icon: "spine", title: "Низ тяжёлый — становая", exercises: [ax("deadlift", "Становая тяга", { main: true, lift: "deadlift", sets: 5 }), ax("squat", "Приседания (вспом.)", { lift: "squat" }), ax("legext", "Разгибания ног сидя"), ax("legcurl-l", "Сгибания ног лёжа"), ax("calves", "Икры", { sets: 4 }), ax("abs", "Пресс в тренажёре")] },
  { id: "t8", boss: "Клинок Закалённый", icon: "dagger", title: "Верх тяжёлый · прогрессия", exercises: [ax("bench", "Жим штанги лёжа", { main: true, lift: "bench", sets: 5 }), ax("row", "Тяга штанги в наклоне", { sets: 4 }), ax("push-press", "Швунг", { lift: "ohp" }), ax("pullup", "Подтягивания с весом"), ax("dips", "Брусья / жим узким"), ax("curl-bb", "Сгибания прямой гриф"), ax("abs", "Пресс в тренажёре")] },
  { id: "t9", boss: "Бастион Ног", icon: "tower", title: "Низ тяжёлый · прогрессия", exercises: [ax("squat", "Приседания", { main: true, lift: "squat", sets: 5 }), ax("rdl", "Мёртвая тяга"), ax("legpress", "Жим ногами"), ax("legcurl-s", "Сгибания ног сидя"), ax("calves", "Икры", { sets: 4 }), ax("abs", "Пресс в тренажёре")] },
  { id: "t10", boss: "Расправить Крылья", icon: "wings", title: "Верх объёмный — спина", exercises: [ax("db-row", "Тяга гантели в наклоне", { main: true, sets: 4 }), ax("lat", "Верхняя тяга", { sets: 4 }), ax("cable-row", "Тяга к поясу"), ax("cross-mid", "Кроссовер снизу"), ax("flat-db", "Жим гантелей"), ax("hammer", "Молотки"), ax("cable-curl", "Сгибания в кроссовере"), ax("pushdown", "Разгибания рук"), ax("abs", "Пресс в тренажёре")] },
  { id: "t11", boss: "Второе Пламя", icon: "flame", title: "Верх объёмный · прогрессия", exercises: [ax("incline-db", "Жим гантелей в наклоне", { main: true, sets: 4 }), ax("cross-mid", "Кроссовер на грудь"), ax("lat-raise", "Махи стоя", { sets: 4 }), ax("db-ohp", "Жим гантели сидя"), ax("lat", "Верхняя тяга", { sets: 4 }), ax("cable-row", "Тяга к поясу"), ax("rear-delt", "Задняя дельта"), ax("french-bb", "Французский жим лёжа"), ax("pushdown", "Разгибания рук"), ax("abs", "Пресс в тренажёре")] },
  { id: "t12", boss: "Вершина Цикла", icon: "peak", title: "Низ объёмный Б · прогрессия", exercises: [ax("rdl", "Мёртвая тяга", { main: true, sets: 4 }), ax("hack", "Присед в гак-машине"), ax("legpress", "Жим ногами"), ax("legcurl-l", "Сгибания ног лёжа"), ax("calves", "Икры", { sets: 4 }), ax("hammer", "Молотки / EZ-гриф"), ax("abs", "Пресс в тренажёре")] },
  // Циклы I–II
  { id: "w1t1", boss: "Пробуждение Стали", icon: "anvil", exercises: [ax("bench", "Жим штанги лёжа", { main: true, lift: "bench" }), ax("row", "Тяга штанги в наклоне"), ax("push-press", "Швунг / армейский жим стоя", { lift: "ohp" }), ax("pullup", "Подтягивания с весом"), ax("dips", "Брусья / жим узким"), ax("curl-ez", "Сгибания EZ-гриф"), ax("abs", "Пресс в тренажёре")] },
  { id: "w1t2", boss: "Столпы Земли", icon: "pillars", exercises: [ax("squat", "Приседания", { main: true, lift: "squat" }), ax("rdl", "Мёртвая тяга"), ax("legpress", "Жим ногами"), ax("legcurl-s", "Сгибания ног сидя"), ax("calves", "Икры"), ax("abs", "Пресс в тренажёре")] },
  { id: "w1t3", boss: "Восхождение по Склону", icon: "mountain", exercises: [ax("incline-bb", "Жим штанги в наклоне", { main: true }), ax("db-row", "Тяга гантели в наклоне"), ax("lat", "Верхняя тяга"), ax("db-ohp", "Жим гантели сидя"), ax("upright", "Тяга к подбородку"), ax("french-bb", "Французский жим лёжа"), ax("abs", "Пресс в тренажёре")] },
  { id: "w2t1", boss: "Гнев Хребта", icon: "spine", exercises: [ax("deadlift", "Становая тяга", { main: true, lift: "deadlift" }), ax("squat", "Приседания (вспом.)", { lift: "squat" }), ax("legext", "Разгибания ног сидя"), ax("legcurl-l", "Сгибания ног лёжа"), ax("calves", "Икры"), ax("abs", "Пресс в тренажёре")] },
  { id: "w2t2", boss: "Клинок Закалённый", icon: "dagger", exercises: [ax("bench", "Жим штанги лёжа", { main: true, lift: "bench" }), ax("row", "Тяга штанги в наклоне"), ax("push-press", "Швунг / армейский жим стоя", { lift: "ohp" }), ax("pullup", "Подтягивания с весом"), ax("dips", "Брусья / жим узким"), ax("curl-bb", "Сгибания прямой гриф"), ax("abs", "Пресс в тренажёре")] },
  { id: "w2t3", boss: "Бастион Ног", icon: "tower", exercises: [ax("squat", "Приседания", { main: true, lift: "squat" }), ax("rdl", "Мёртвая тяга"), ax("legpress", "Жим ногами"), ax("legcurl-s", "Сгибания ног сидя"), ax("calves", "Икры"), ax("abs", "Пресс в тренажёре")] },
  { id: "w3t1", boss: "Пламя Полноты", icon: "sun", exercises: [ax("incline-db", "Жим гантелей в наклоне", { main: true }), ax("cross-mid", "Кроссовер на грудь"), ax("lat-raise", "Махи стоя"), ax("cross-delt", "Разводка плечи"), ax("lat", "Верхняя тяга"), ax("cable-row", "Тяга к поясу"), ax("rear-delt", "Задняя дельта"), ax("french-db", "Французский жим стоя"), ax("pushdown", "Разгибания рук"), ax("abs", "Пресс в тренажёре")] },
  { id: "w3t2", boss: "Песнь Выдержки", icon: "hourglass", exercises: [ax("squat-vol", "Присед многоповторный", { main: true, lift: "squat" }), ax("hack", "Присед в гак-машине"), ax("legext", "Разгибания ног сидя"), ax("legcurl-s", "Сгибания ног сидя"), ax("hyper", "Гиперэкстензия"), ax("calves", "Икры"), ax("abs", "Пресс в тренажёре")] },
  { id: "w3t3", boss: "Расправить Крылья", icon: "wings", exercises: [ax("db-row", "Тяга гантели в наклоне", { main: true }), ax("lat", "Верхняя тяга"), ax("bench-row", "Тяга к поясу на лавке"), ax("cross-low", "Кроссовер снизу"), ax("flat-db", "Жим гантелей"), ax("hammer", "Молотки"), ax("cable-curl", "Сгибания в кроссовере"), ax("rev-curl", "Обратный хват"), ax("pushdown", "Разгибания рук"), ax("abs", "Пресс в тренажёре")] },
  { id: "w4t1", boss: "Корни Титана", icon: "tree", exercises: [ax("rdl", "Мёртвая тяга", { main: true }), ax("legpress", "Жим ногами"), ax("legcurl-l", "Сгибания ног лёжа"), ax("legext", "Разгибания ног сидя"), ax("hyper", "Гиперэкстензия"), ax("calves", "Икры"), ax("abs", "Пресс в тренажёре")] },
  { id: "w4t2", boss: "Второе Пламя", icon: "flame", exercises: [ax("incline-db", "Жим гантелей в наклоне", { main: true }), ax("cross-mid", "Кроссовер на грудь"), ax("lat-raise", "Махи стоя"), ax("db-ohp", "Жим гантели сидя"), ax("lat", "Верхняя тяга"), ax("cable-row", "Тяга к поясу"), ax("rear-delt", "Задняя дельта"), ax("french-bb", "Французский жим лёжа"), ax("pushdown", "Разгибания рук"), ax("abs", "Пресс в тренажёре")] },
  { id: "w4t3", boss: "Вершина Цикла", icon: "peak", exercises: [ax("squat-vol", "Присед многоповторный", { main: true, lift: "squat" }), ax("hack", "Присед в гак-машине"), ax("legext", "Разгибания ног сидя"), ax("legcurl-s", "Сгибания ног сидя"), ax("hyper", "Гиперэкстензия"), ax("calves", "Икры"), ax("abs", "Пресс в тренажёре")] },
];
