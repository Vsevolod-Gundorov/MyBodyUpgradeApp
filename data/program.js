// Цикл V — Арена (v5). 3 квеста/нед · 4 недели.
//
// Сплит: ВЕРХ / НИЗ / ФУЛБОДИ-ДОБОР. Каждая мышечная группа получает ДВА активных дня в неделю
// (2–3 упражнения за день), косвенной работы больше. Это адаптация профессиональных
// бодибилдерских сплитов под натурального атлета: специализация дня как у про, но объём
// на группу держится в восстанавливаемых рамках, а частота поднята с 1 до 2 раз в неделю.
//
// Акценты недели всегда 2 + 1:
//   нечётная неделя → Верх и Низ силовые, Фулбоди объёмный
//   чётная неделя   → Верх и Низ объёмные, Фулбоди силовой
// Так каждая группа каждую неделю получает и тяжёлый, и объёмный стимул.
//
// Разнообразие: недели 1–2 идут на волне A, недели 3–4 — на волне B, где вспомогательные
// движения заменяются на родственные варианты (жим штанги ↔ наклонный, тяга ↔ подтягивания,
// сгибания сидя ↔ лёжа). Движение дня и схема прогрессии при этом сохраняются.
//
// Веса в квесте НЕ зашиты: считаются под атлета из его замеров 1ПМ и коэффициентов пула
// (data/exercises.js → workingWeight). Пул также позволяет заменить или добавить упражнение.
import { EX_BY_ID } from "./exercises.js";

/* ---------- схемы подходов: роль упражнения × тип сессии ---------- */
// rir — запас повторов (0 = до отказа). База идёт с запасом: близость к отказу почти
// не добавляет гипертрофии, но сильно бьёт по восстановлению. Изоляция — ближе к отказу.
export const SCHEME = {
  strength: {
    main:     { sets: 4, reps: [4, 6],   rir: 1, tag: "RPE 8–9" },
    heavy:    { sets: 4, reps: [6, 8],   rir: 2, tag: "RPE 8" },
    acc:      { sets: 3, reps: [8, 10],  rir: 2, tag: "RIR 2" },
    iso:      { sets: 3, reps: [10, 12], rir: 1, tag: "RIR 1" },
    finisher: { sets: 3, reps: [15, 20], rir: 0, tag: "до отказа" },
  },
  volume: {
    main:     { sets: 4, reps: [8, 10],  rir: 2, tag: "RIR 1–2" },
    heavy:    { sets: 4, reps: [10, 12], rir: 2, tag: "RIR 1–2" },
    acc:      { sets: 3, reps: [12, 15], rir: 1, tag: "RIR 1" },
    iso:      { sets: 3, reps: [15, 20], rir: 1, tag: "RIR 0–1" },
    finisher: { sets: 3, reps: [20, 30], rir: 0, tag: "до отказа" },
  },
};
export const ROLE_NAMES = { main: "движение дня", heavy: "вторая база", acc: "вспомогательное", iso: "изоляция", finisher: "добивающее" };
export const TYPE_NAMES = { strength: "силовая", volume: "объёмная" };

/* ---------- приёмы интенсивности из практики про-атлетов ----------
   У химического атлета восстановление другое, поэтому «как у них» в лоб натуралу не годится:
   приёмы оставлены, но применяются точечно — 1–2 за сессию, только на изоляции и тренажёрах,
   и почти всегда на объёмных днях. Тяжёлая база идёт без них, с запасом повторов. */
export const METHODS = {
  pyramid: {
    name: "Пирамида", origin: "Ронни Колеман",
    desc: "Разминочные подходы с ростом веса и падением повторов, затем рабочие. Даёт выйти на тяжёлый вес без потери техники и без лишней усталости.",
    how: "Например: 20 повторов с пустым грифом → 10 с 50% → 5 с 70% → 3 с 85%, дальше рабочие подходы.",
  },
  superset: {
    name: "Суперсет антагонистов", origin: "Кевин Леврон",
    desc: "Два упражнения на противоположные группы подряд без отдыха. Сессия становится короче и плотнее, а сила в обоих движениях почти не падает — мышцы-антагонисты не мешают друг другу.",
    how: "Подход первого упражнения → сразу подход второго → отдых 90–120 с → следующая пара.",
  },
  dropset: {
    name: "Дроп-сет", origin: "Ли Прист",
    desc: "На последнем рабочем подходе сбросить 20–30% веса и добить до отказа. Дешёвый способ добавить объёма в конце, когда ещё есть силы, но нет времени.",
    how: "Только на последнем подходе и только на изоляции или тренажёре: отказ → минус 25% → отказ.",
  },
  restpause: {
    name: "Отдых-пауза", origin: "Кевин Леврон",
    desc: "После отказа короткая пауза и ещё несколько повторов с тем же весом. Позволяет выжать больше качественной работы из одного подхода.",
    how: "Отказ → 15–20 с отдыха → 2–4 повтора → ещё 15 с → 1–2 повтора.",
  },
  partials: {
    name: "Частичные в растяжении", origin: "Ли Прист",
    desc: "После отказа в полной амплитуде добить короткими повторами в растянутой части. Именно растянутая позиция даёт основной стимул роста.",
    how: "Отказ → 5–8 частичных повторов в нижней (растянутой) трети амплитуды.",
  },
  highrep: {
    name: "Высокоповторный добой", origin: "Ли Прист",
    desc: "Один длинный подход на 20–30 повторов в конце дня ног или на икры. Гипертрофия в многоповторке не хуже, если доходить близко к отказу.",
    how: "Вес около 40–50% от обычного рабочего, один-два подхода, терпеть жжение до конца.",
  },
  preexhaust: {
    name: "Предварительное утомление", origin: "Классика Золотой эры",
    desc: "Изоляция перед базой, чтобы целевая мышца отказала раньше вспомогательных. Полезно, когда в жиме раньше груди сдаётся трицепс.",
    how: "Изоляция 1–2 подхода до жжения → сразу базовое движение с меньшим весом.",
  },
};

/* ---------- три шаблона сплита ----------
   slot: ex — движение волны A, alt — волны B (разнообразие без потери прогрессии),
   role — схема подходов, method — приём интенсивности, methodOn — на каком типе сессии он включается,
   ss — номер суперсета (слоты с одинаковым номером выполняются в связке). */
export const TEMPLATES = {
  U: {
    key: "U", name: "Верх тела", short: "Верх",
    why: "День верха по-бодибилдерски: грудь и спина чередуются как антагонисты (приём Леврона), затем дельты и руки. Каждая группа получает по два движения — разные углы и линии тяги.",
    slots: [
      { ex: "bench",      alt: "incline-bb",       role: "main",  method: "pyramid", methodOn: "strength" },
      { ex: "row",        alt: "pullup",           role: "heavy" },
      { ex: "incline-db", alt: "flat-db",          role: "acc",   ss: 1 },
      { ex: "lat",        alt: "cable-row",        role: "acc",   ss: 1 },
      { ex: "lat-raise",  alt: "cable-lat-raise",  role: "iso",   method: "dropset" },
      { ex: "face-pull",  alt: "rear-delt",        role: "iso" },
      { ex: "curl-ez",    alt: "incline-curl",     role: "iso",   ss: 2 },
      { ex: "french-db",  alt: "pushdown",         role: "iso",   ss: 2, method: "partials" },
    ],
  },
  L: {
    key: "L", name: "Низ тела", short: "Низ",
    why: "День ног: одна максимальная база в начале по заветам Колемана, дальше квадрицепс и задняя цепь по отдельности на тренажёрах, закрывает всё высокоповторный добой в стиле Ли Приста. Двух максимальных баз в один день у натурала быть не должно — это цена восстановления, а не стимул.",
    slots: [
      { ex: "squat",         alt: "squat",         role: "main",  method: "pyramid", methodOn: "strength" },
      { ex: "rdl",           alt: "hip-thrust",    role: "heavy" },
      { ex: "legpress",      alt: "hack",          role: "acc" },
      { ex: "legcurl-s",     alt: "legcurl-l",     role: "acc" },
      { ex: "legext",        alt: "legext",        role: "iso",   method: "highrep" },
      { ex: "hip-thrust",    alt: "back-ext-45",   role: "iso" },
      { ex: "calf-standing", alt: "calf-seated",   role: "finisher", method: "partials" },
      { ex: "cable-crunch",  alt: "hanging-leg",   role: "iso" },
    ],
  },
  F: {
    key: "F", name: "Фулбоди-добор", short: "Добор",
    why: "Второй активный день для всех групп: другие движения, другие углы. Максимальных баз здесь нет намеренно — этот день добирает объём, а не съедает восстановление перед следующей неделей.",
    slots: [
      { ex: "flat-db",      alt: "dips",           role: "main" },
      { ex: "pullup",       alt: "lat",            role: "heavy" },
      { ex: "hack",         alt: "bulgarian",      role: "acc" },
      { ex: "db-ohp",       alt: "ohp",            role: "acc" },
      { ex: "legcurl-l",    alt: "legcurl-s",      role: "acc" },
      { ex: "hammer",       alt: "cable-curl",     role: "iso",   ss: 1 },
      { ex: "pushdown",     alt: "french-bb",      role: "iso",   ss: 1, method: "dropset" },
      { ex: "calf-seated",  alt: "calf-standing",  role: "finisher", method: "highrep" },
      { ex: "abs",          alt: "cable-crunch",   role: "iso" },
    ],
  },
};

/* ---------- 4 недели ---------- */
// sub — точечная правка состава конкретного квеста: замена движения в слоте или снятие слота (null).
// Так в цикле появляется ровно один тяжёлый день становой, и в нём нет второй максимальной базы.
const W = (id, tpl, type, boss, icon, wave, prog = 0, sub = null) => ({ id, tpl, type, boss, icon, wave, prog, sub });
export const PROGRAM = {
  cycleName: "Цикл V — Арена",
  note: "Сплит Верх / Низ / Фулбоди-добор: каждая группа мышц получает два активных дня в неделю, по 2–3 упражнения за день. Недели 1 и 3 — Верх и Низ силовые, Фулбоди объёмный; недели 2 и 4 — наоборот, так что каждая группа каждую неделю видит и тяжёлую, и объёмную работу. Недели 3–4 идут на второй волне движений: вспомогательные заменяются вариантами, движение дня и прогрессия сохраняются.",
  weeks: [
    {
      n: 1, emphasis: "strength", wave: "A", saga: "Сага о Пробуждении",
      workouts: [
        W("w1u", "U", "strength", "Клинок Титанов", "sword", "A"),
        W("w1l", "L", "strength", "Столпы Земли", "pillars", "A"),
        W("w1f", "F", "volume",   "Песнь Выдержки", "hourglass", "A"),
      ],
    },
    {
      n: 2, emphasis: "volume", wave: "A", saga: "Сага о Полноте",
      workouts: [
        W("w2u", "U", "volume",   "Пламя Полноты", "sun", "A"),
        W("w2l", "L", "volume",   "Корни Титана", "tree", "A"),
        W("w2f", "F", "strength", "Гнев Хребта", "spine", "A"),
      ],
    },
    {
      n: 3, emphasis: "strength", wave: "B", saga: "Сага о Закалке",
      workouts: [
        W("w3u", "U", "strength", "Молот Зари", "anvil", "B", 0.025),
        // день становой: максимальная база одна, приседания и работа на поясницу в этот день убраны
        W("w3l", "L", "strength", "Зов Земли", "weight", "B", 0.025,
          { squat: "deadlift", "hip-thrust": "legpress", "back-ext-45": null }),
        W("w3f", "F", "volume",   "Расправить Крылья", "wings", "B", 0.025),
      ],
    },
    {
      n: 4, emphasis: "volume", wave: "B", saga: "Сага о Вершине",
      workouts: [
        W("w4u", "U", "volume",   "Второе Пламя", "flame", "B", 0.025),
        W("w4l", "L", "volume",   "Ход Исполина", "mountain", "B", 0.025),
        W("w4f", "F", "strength", "Вершина Цикла", "peak", "B", 0.05),
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
  const wave = workout.wave || "A";
  const sub = workout.sub || {};
  // движение волны: на волне B вспомогательные меняются на родственные варианты,
  // затем применяется точечная правка квеста (sub), затем правки атлета (swap/hide)
  const pick = (slot) => {
    const base = (wave === "B" && slot.alt) ? slot.alt : slot.ex;
    return Object.prototype.hasOwnProperty.call(sub, base) ? sub[base] : base;
  };
  const slots = tpl.slots
    .map((s) => ({ slot: s, base: pick(s) }))
    .filter(({ base }) => base && !hide.has(base))
    .map(({ slot, base }) => ({ ...slot, ex: swap[base] || base, from: swap[base] ? base : null }));
  (plan.add || []).forEach((id) => { if (!hide.has(id)) slots.push({ ex: id, role: "iso", added: true }); });

  const out = [];
  const seen = new Set();
  slots.forEach((slot) => {
    const ex = EX_BY_ID[slot.ex];
    if (!ex || seen.has(ex.id)) return;   // неизвестное или дублирующее движение пропускаем
    seen.add(ex.id);
    const sc = scheme[slot.role] || scheme.iso;
    // приём интенсивности включается только на своём типе сессии (по умолчанию — объёмная)
    // и только на изоляции: на базе он стоит натуралу дороже, чем даёт. Пирамида — исключение,
    // это способ выйти на тяжёлый вес, а не добавить усталости.
    const on = slot.methodOn || "volume";
    const fits = slot.method === "pyramid" ? ex.tier <= 2 : ex.tier === 3;
    const method = slot.method && fits && (on === "both" || on === workout.type) ? slot.method : null;
    out.push({
      id: ex.id, name: ex.name, short: ex.short || ex.name,
      role: slot.role, main: slot.role === "main",
      lift: ex.lift, tier: ex.tier, equip: ex.equip, group: ex.group, pattern: ex.pattern,
      sets: sc.sets, reps: sc.reps, rir: sc.rir,
      scheme: `${sc.sets} × ${sc.reps[0]}${sc.reps[1] !== sc.reps[0] ? "–" + sc.reps[1] : ""} · ${sc.tag}`,
      method, ss: slot.ss || null,
      prog: workout.prog || 0,
      swappedFrom: slot.from || null, added: !!slot.added,
    });
  });
  // суперсет засчитывается только если в квесте осталась вся пара
  const ssCount = {};
  out.forEach((e) => { if (e.ss) ssCount[e.ss] = (ssCount[e.ss] || 0) + 1; });
  out.forEach((e) => {
    if (!e.ss) return;
    if (ssCount[e.ss] < 2) { e.ss = null; return; }
    const partner = out.find((x) => x !== e && x.ss === e.ss);
    e.ssWith = partner ? partner.short : null;
  });
  return out;
}

/** Системная цена квеста: сумма cns движений и число максимальных баз.
 *  Правило для натурала: одна база с cns 3 за сессию; две — это уже вопрос восстановления. */
export function sessionLoad(list) {
  let load = 0, maxBase = 0, compound = 0;
  (list || []).forEach((e) => {
    const src = EX_BY_ID[e.id];
    if (!src) return;
    const cns = src.cns == null ? (src.tier === 3 ? 0.5 : 1) : src.cns;
    load += cns * (e.sets / 3);            // цена растёт с числом подходов
    if (cns >= 3) maxBase++;
    if (src.tier <= 2) compound++;
  });
  load = Math.round(load * 10) / 10;
  const level = maxBase > 1 || load >= 11 ? "high" : (load >= 7 ? "mid" : "low");
  return { load, maxBase, compound, level, overload: maxBase > 1 };
}

/** Недельный объём по мышечным группам: сколько сессий и рабочих подходов получает группа. */
export function weeklyCoverage(week, plans = {}) {
  const cover = {};
  const touch = (g, sets, wid, active) => {
    if (!g) return;
    const c = (cover[g] ||= { sets: 0, days: new Set(), anyDays: new Set() });
    c.sets += sets; c.anyDays.add(wid);
    if (active) c.days.add(wid);
  };
  week.workouts.forEach((w) => {
    buildExercises(w, plans[w.id]).forEach((ex) => {
      const src = EX_BY_ID[ex.id];
      if (!src) return;
      touch(src.group, ex.sets, w.id, true);
      // вторичная группа в многосуставном движении — это тоже активная работа
      // (ягодицы в приседе, трицепс в жиме); в изоляции она в зачёт не идёт
      (src.also || []).forEach((g) => touch(g, ex.sets / 2, w.id, src.tier <= 2));
    });
  });
  return Object.fromEntries(Object.entries(cover).map(([g, c]) =>
    [g, { sets: Math.round(c.sets), days: c.days.size, anyDays: c.anyDays.size }]));
}

// Базовые расчётные максимумы (старт персонажа)
export const BASELINES = { bench: 147, squat: 170, deadlift: 195, ohp: 100 };
export const LIFT_NAMES = { bench: "Жим лёжа", squat: "Присед", deadlift: "Становая", ohp: "Швунг" };

/* ---------- архив прошлых циклов ----------
   Нужен, чтобы старые сессии в «Хрониках» открывались и их движения по-прежнему
   учитывались в аналитике потолка/пола (id движений совпадают с пулом). */
const ax = (id, name, extra = {}) => ({ id, name, sets: 3, reps: [6, 10], ...extra });
export const ARCHIVED_WORKOUTS = [
  // Цикл IV (Волна) — фулбоди A/B/C
  { id: "w1a", boss: "Столпы Земли", icon: "pillars", title: "Цикл IV · Присед + горизонтальный жим", exercises: [ax("squat", "Приседания со штангой", { sets: 4, reps: [3,5], main: true, lift: "squat" }), ax("bench", "Жим штанги лёжа", { sets: 4, reps: [5,6], lift: "bench" }), ax("row", "Тяга штанги в наклоне", { sets: 3, reps: [6,8] }), ax("rdl", "Мёртвая тяга (RDL)", { sets: 3, reps: [6,8] }), ax("lat-raise", "Махи гантелями стоя", { sets: 3, reps: [10,12] }), ax("calf-standing", "Подъёмы на носки стоя", { sets: 3, reps: [10,12] }), ax("abs", "Пресс в тренажёре", { sets: 3, reps: [10,12] })] },
  { id: "w1b", boss: "Песнь Выдержки", icon: "hourglass", title: "Цикл IV · Становая + вертикальный жим", exercises: [ax("deadlift", "Становая тяга", { sets: 4, reps: [8,10], main: true, lift: "deadlift" }), ax("push-press", "Швунг жимовой", { sets: 4, reps: [10,12], lift: "ohp" }), ax("pullup", "Подтягивания с весом", { sets: 3, reps: [12,15] }), ax("legpress", "Жим ногами", { sets: 3, reps: [12,15] }), ax("incline-db", "Жим гантелей в наклоне", { sets: 3, reps: [12,15] }), ax("incline-curl", "Сгибания на наклонной скамье", { sets: 3, reps: [15,20] }), ax("calf-seated", "Подъёмы на носки сидя", { sets: 3, reps: [15,20] }), ax("hanging-leg", "Подъём ног в висе", { sets: 3, reps: [15,20] })] },
  { id: "w1c", boss: "Восхождение по Склону", icon: "mountain", title: "Цикл IV · Наклонный жим + тяга", exercises: [ax("incline-bb", "Жим штанги в наклоне", { sets: 4, reps: [3,5], main: true }), ax("cable-row", "Тяга к поясу в блоке", { sets: 4, reps: [5,6] }), ax("hack", "Присед в гак-машине", { sets: 3, reps: [6,8] }), ax("legcurl-s", "Сгибания ног сидя", { sets: 3, reps: [6,8] }), ax("legext", "Разгибания ног сидя", { sets: 3, reps: [10,12] }), ax("face-pull", "Face pull в блоке", { sets: 3, reps: [10,12] }), ax("french-db", "Разгибание из-за головы", { sets: 3, reps: [10,12] }), ax("cable-crunch", "Скручивания в блоке", { sets: 3, reps: [10,12] })] },
  { id: "w2a", boss: "Корни Титана", icon: "tree", title: "Цикл IV · Присед + горизонтальный жим", exercises: [ax("squat", "Приседания со штангой", { sets: 4, reps: [8,10], main: true, lift: "squat" }), ax("bench", "Жим штанги лёжа", { sets: 4, reps: [10,12], lift: "bench" }), ax("row", "Тяга штанги в наклоне", { sets: 3, reps: [12,15] }), ax("rdl", "Мёртвая тяга (RDL)", { sets: 3, reps: [12,15] }), ax("lat-raise", "Махи гантелями стоя", { sets: 3, reps: [15,20] }), ax("calf-standing", "Подъёмы на носки стоя", { sets: 3, reps: [15,20] }), ax("abs", "Пресс в тренажёре", { sets: 3, reps: [15,20] })] },
  { id: "w2b", boss: "Гнев Хребта", icon: "spine", title: "Цикл IV · Становая + вертикальный жим", exercises: [ax("deadlift", "Становая тяга", { sets: 4, reps: [3,5], main: true, lift: "deadlift" }), ax("push-press", "Швунг жимовой", { sets: 4, reps: [5,6], lift: "ohp" }), ax("pullup", "Подтягивания с весом", { sets: 3, reps: [6,8] }), ax("legpress", "Жим ногами", { sets: 3, reps: [6,8] }), ax("incline-db", "Жим гантелей в наклоне", { sets: 3, reps: [6,8] }), ax("incline-curl", "Сгибания на наклонной скамье", { sets: 3, reps: [10,12] }), ax("calf-seated", "Подъёмы на носки сидя", { sets: 3, reps: [10,12] }), ax("hanging-leg", "Подъём ног в висе", { sets: 3, reps: [10,12] })] },
  { id: "w2c", boss: "Пламя Полноты", icon: "sun", title: "Цикл IV · Наклонный жим + тяга", exercises: [ax("incline-bb", "Жим штанги в наклоне", { sets: 4, reps: [8,10], main: true }), ax("cable-row", "Тяга к поясу в блоке", { sets: 4, reps: [10,12] }), ax("hack", "Присед в гак-машине", { sets: 3, reps: [12,15] }), ax("legcurl-s", "Сгибания ног сидя", { sets: 3, reps: [12,15] }), ax("legext", "Разгибания ног сидя", { sets: 3, reps: [15,20] }), ax("face-pull", "Face pull в блоке", { sets: 3, reps: [15,20] }), ax("french-db", "Разгибание из-за головы", { sets: 3, reps: [15,20] }), ax("cable-crunch", "Скручивания в блоке", { sets: 3, reps: [15,20] })] },
  { id: "w3a", boss: "Пробуждение Стали", icon: "anvil", title: "Цикл IV · Присед + горизонтальный жим", exercises: [ax("squat", "Приседания со штангой", { sets: 4, reps: [3,5], main: true, lift: "squat" }), ax("bench", "Жим штанги лёжа", { sets: 4, reps: [5,6], lift: "bench" }), ax("row", "Тяга штанги в наклоне", { sets: 3, reps: [6,8] }), ax("rdl", "Мёртвая тяга (RDL)", { sets: 3, reps: [6,8] }), ax("lat-raise", "Махи гантелями стоя", { sets: 3, reps: [10,12] }), ax("calf-standing", "Подъёмы на носки стоя", { sets: 3, reps: [10,12] }), ax("abs", "Пресс в тренажёре", { sets: 3, reps: [10,12] })] },
  { id: "w3b", boss: "Расправить Крылья", icon: "wings", title: "Цикл IV · Становая + вертикальный жим", exercises: [ax("deadlift", "Становая тяга", { sets: 4, reps: [8,10], main: true, lift: "deadlift" }), ax("push-press", "Швунг жимовой", { sets: 4, reps: [10,12], lift: "ohp" }), ax("pullup", "Подтягивания с весом", { sets: 3, reps: [12,15] }), ax("legpress", "Жим ногами", { sets: 3, reps: [12,15] }), ax("incline-db", "Жим гантелей в наклоне", { sets: 3, reps: [12,15] }), ax("incline-curl", "Сгибания на наклонной скамье", { sets: 3, reps: [15,20] }), ax("calf-seated", "Подъёмы на носки сидя", { sets: 3, reps: [15,20] }), ax("hanging-leg", "Подъём ног в висе", { sets: 3, reps: [15,20] })] },
  { id: "w3c", boss: "Клинок Закалённый", icon: "dagger", title: "Цикл IV · Наклонный жим + тяга", exercises: [ax("incline-bb", "Жим штанги в наклоне", { sets: 4, reps: [3,5], main: true }), ax("cable-row", "Тяга к поясу в блоке", { sets: 4, reps: [5,6] }), ax("hack", "Присед в гак-машине", { sets: 3, reps: [6,8] }), ax("legcurl-s", "Сгибания ног сидя", { sets: 3, reps: [6,8] }), ax("legext", "Разгибания ног сидя", { sets: 3, reps: [10,12] }), ax("face-pull", "Face pull в блоке", { sets: 3, reps: [10,12] }), ax("french-db", "Разгибание из-за головы", { sets: 3, reps: [10,12] }), ax("cable-crunch", "Скручивания в блоке", { sets: 3, reps: [10,12] })] },
  { id: "w4a", boss: "Бастион Ног", icon: "tower", title: "Цикл IV · Присед + горизонтальный жим", exercises: [ax("squat", "Приседания со штангой", { sets: 4, reps: [8,10], main: true, lift: "squat" }), ax("bench", "Жим штанги лёжа", { sets: 4, reps: [10,12], lift: "bench" }), ax("row", "Тяга штанги в наклоне", { sets: 3, reps: [12,15] }), ax("rdl", "Мёртвая тяга (RDL)", { sets: 3, reps: [12,15] }), ax("lat-raise", "Махи гантелями стоя", { sets: 3, reps: [15,20] }), ax("calf-standing", "Подъёмы на носки стоя", { sets: 3, reps: [15,20] }), ax("abs", "Пресс в тренажёре", { sets: 3, reps: [15,20] })] },
  { id: "w4b", boss: "Второе Пламя", icon: "flame", title: "Цикл IV · Становая + вертикальный жим", exercises: [ax("deadlift", "Становая тяга", { sets: 4, reps: [3,5], main: true, lift: "deadlift" }), ax("push-press", "Швунг жимовой", { sets: 4, reps: [5,6], lift: "ohp" }), ax("pullup", "Подтягивания с весом", { sets: 3, reps: [6,8] }), ax("legpress", "Жим ногами", { sets: 3, reps: [6,8] }), ax("incline-db", "Жим гантелей в наклоне", { sets: 3, reps: [6,8] }), ax("incline-curl", "Сгибания на наклонной скамье", { sets: 3, reps: [10,12] }), ax("calf-seated", "Подъёмы на носки сидя", { sets: 3, reps: [10,12] }), ax("hanging-leg", "Подъём ног в висе", { sets: 3, reps: [10,12] })] },
  { id: "w4c", boss: "Вершина Цикла", icon: "peak", title: "Цикл IV · Наклонный жим + тяга", exercises: [ax("incline-bb", "Жим штанги в наклоне", { sets: 4, reps: [8,10], main: true }), ax("cable-row", "Тяга к поясу в блоке", { sets: 4, reps: [10,12] }), ax("hack", "Присед в гак-машине", { sets: 3, reps: [12,15] }), ax("legcurl-s", "Сгибания ног сидя", { sets: 3, reps: [12,15] }), ax("legext", "Разгибания ног сидя", { sets: 3, reps: [15,20] }), ax("face-pull", "Face pull в блоке", { sets: 3, reps: [15,20] }), ax("french-db", "Разгибание из-за головы", { sets: 3, reps: [15,20] }), ax("cable-crunch", "Скручивания в блоке", { sets: 3, reps: [15,20] })] },
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

/**
 * Сколько квестов недели уже пройдено. Считаются разные квесты, а не заходы:
 * дважды закрытый квест — это один пройденный, а не два.
 */
export function weekProgress(week, sessions = []) {
  const ids = new Set(((week && week.workouts) || []).map((w) => w.id));
  const done = new Set();
  for (const s of Array.isArray(sessions) ? sessions : []) {
    if (s && ids.has(s.workoutId)) done.add(s.workoutId);
  }
  return { done: done.size, total: ids.size, complete: ids.size > 0 && done.size === ids.size };
}

/** Неделя, в которой лежит квест. Нужна, чтобы раскрыть на экране именно её. */
export function weekOfId(wid, weeks = PROGRAM.weeks) {
  const wk = (weeks || []).find((w) => (w.workouts || []).some((x) => x.id === wid));
  return wk ? wk.n : null;
}
