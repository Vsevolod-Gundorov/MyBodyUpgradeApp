// Цикл III — Сила/Объём (v3). 3 квеста/нед · Недели 1,3 силовые · 2,4 объёмные.
// Чередование Верх/Низ без сбоев. Прогрессия: неделя 3 = прогрессия 1, неделя 4 = 2.
// main: движение дня (единственное на пределе). lift: базовый лифт для аналитики.
export const PROGRAM = {
  cycleName: "Цикл III — Сила/Объём",
  weeks: [
    {
      n: 1, type: "силовая", pattern: "Верх · Низ · Верх", saga: "Сага о Пробуждении",
      workouts: [
        {
          id: "t1", title: "Верх тяжёлый А", boss: "Пробуждение Стали", icon: "anvil",
          exercises: [
            { id: "bench", name: "Жим штанги лёжа", scheme: "Лесенка / 5×5 · RPE 8–9", sets: 5, reps: [5, 5], w: [100, 140], main: true, lift: "bench" },
            { id: "row", name: "Тяга штанги в наклоне", scheme: "4 × 6–8 · RPE 7–8", sets: 4, reps: [6, 8], w: [100, 120] },
            { id: "push-press", name: "Швунг / армейский жим стоя", scheme: "3 × 5–8 · 2-й жим дня", sets: 3, reps: [5, 8], w: [60, 90], lift: "ohp" },
            { id: "pullup", name: "Подтягивания с весом", scheme: "3 × 6–8 · RIR 2–3", sets: 3, reps: [6, 8], w: [10, 20], wNote: "довесок к своему" },
            { id: "dips", name: "Брусья с поясом / жим узким", scheme: "3 × 6–8 · 3-й жим дня", sets: 3, reps: [6, 8], w: [30, 50], wNote: "+30–50 к поясу · или жим узким 70–85" },
            { id: "curl-ez", name: "Сгибания стоя EZ-гриф", scheme: "3 × 6–8 · RIR 2", sets: 3, reps: [6, 8], w: [50, 65] },
            { id: "abs", name: "Пресс в тренажёре", scheme: "3 × 12–15 · RIR 1–2", sets: 3, reps: [12, 15], w: [50, 55] },
          ],
        },
        {
          id: "t2", title: "Низ тяжёлый — присед", boss: "Столпы Земли", icon: "pillars",
          exercises: [
            { id: "squat", name: "Приседания свободный вес", scheme: "Лесенка / 5×5 · RPE 8–9", sets: 5, reps: [5, 5], w: [100, 150], main: true, lift: "squat" },
            { id: "rdl", name: "Мёртвая тяга", scheme: "3 × 6–8 · RPE 7", sets: 3, reps: [6, 8], w: [90, 110] },
            { id: "legpress", name: "Жим ногами", scheme: "3 × 8–10 · RIR 2–3", sets: 3, reps: [8, 10], w: [150, 200] },
            { id: "legcurl-s", name: "Сгибания ног сидя", scheme: "3 × 10–12 · RIR 2", sets: 3, reps: [10, 12], w: [60, 70] },
            { id: "calves", name: "Икры (любое)", scheme: "4 × 10–15 · RIR 1–2", sets: 4, reps: [10, 15], w: [120, 160] },
            { id: "abs", name: "Пресс в тренажёре", scheme: "3 × 12–15 · RIR 1–2", sets: 3, reps: [12, 15], w: [50, 55] },
          ],
        },
        {
          id: "t3", title: "Верх тяжёлый Б", boss: "Восхождение по Склону", icon: "mountain",
          exercises: [
            { id: "incline-bb", name: "Жим штанги в наклоне", scheme: "5 × 5–8 · RPE 8", sets: 5, reps: [5, 8], w: [80, 100], main: true },
            { id: "db-row", name: "Тяга гантели в наклоне", scheme: "4 × 6–8 · RPE 7–8", sets: 4, reps: [6, 8], w: [42, 42] },
            { id: "lat", name: "Верхняя тяга в тренажёре", scheme: "3 × 8–10 · RIR 2–3", sets: 3, reps: [8, 10], w: [70, 100] },
            { id: "db-ohp", name: "Армейский жим гантели сидя", scheme: "3 × 8–10 · 2-й жим дня −15%", sets: 3, reps: [8, 10], w: [30, 36] },
            { id: "upright", name: "Тяга к подбородку", scheme: "3 × 8–10 · RIR 2–3", sets: 3, reps: [8, 10], w: [50, 70] },
            { id: "french-bb", name: "Французский жим лёжа", scheme: "3 × 8–10 · RIR 2", sets: 3, reps: [8, 10], w: [40, 50] },
            { id: "abs", name: "Пресс в тренажёре", scheme: "3 × 12–15 · RIR 1–2", sets: 3, reps: [12, 15], w: [50, 55] },
          ],
        },
      ],
    },
    {
      n: 2, type: "объёмная", pattern: "Низ · Верх · Низ", saga: "Сага о Полноте",
      workouts: [
        {
          id: "t4", title: "Низ объёмный А — многоповторка", boss: "Песнь Выдержки", icon: "hourglass",
          exercises: [
            { id: "squat-vol", name: "Присед многоповторный", scheme: "3–4 × 12–15 · RIR 1–2 · кап 4", sets: 4, reps: [12, 15], w: [90, 100], main: true, lift: "squat" },
            { id: "legext", name: "Разгибания ног сидя", scheme: "3 × 12–15 · RIR 1", sets: 3, reps: [12, 15], w: [90, 120] },
            { id: "legcurl-s", name: "Сгибания ног сидя", scheme: "3 × 12–15 · RIR 1", sets: 3, reps: [12, 15], w: [60, 70] },
            { id: "hyper", name: "Гиперэкстензия", scheme: "3 × 10–12 · RIR 2", sets: 3, reps: [10, 12], w: [40, 40] },
            { id: "calves", name: "Икры (любое)", scheme: "4 × 12–20 · RIR 1", sets: 4, reps: [12, 20], w: [120, 160] },
            { id: "abs", name: "Пресс в тренажёре", scheme: "3 × 12–15 · RIR 1–2", sets: 3, reps: [12, 15], w: [50, 55] },
          ],
        },
        {
          id: "t5", title: "Верх объёмный А — грудь + плечи", boss: "Пламя Полноты", icon: "sun",
          exercises: [
            { id: "incline-db", name: "Жим гантелей в наклоне", scheme: "4 × 8–12 · RIR 1–2 · тяжёлый жим дня", sets: 4, reps: [8, 12], w: [34, 42], main: true },
            { id: "cross-mid", name: "Кроссовер сведение на грудь", scheme: "3 × 12–15 · RIR 1", sets: 3, reps: [12, 15], w: [15, 20] },
            { id: "lat-raise", name: "Махи стоя", scheme: "4 × 10–15 · RIR 1", sets: 4, reps: [10, 15], w: [20, 24] },
            { id: "cross-delt", name: "Разводка плечи в кроссовере / махи сидя", scheme: "3 × 12–15 · RIR 1", sets: 3, reps: [12, 15], w: [5, 7.5], wNote: "5–7,5 кроссовер · или махи сидя 16–20" },
            { id: "lat", name: "Верхняя тяга в тренажёре", scheme: "4 × 10–12 · RIR 1–2", sets: 4, reps: [10, 12], w: [70, 100] },
            { id: "cable-row", name: "Тяга к поясу в тренажёре", scheme: "3 × 10–12 · RIR 1–2", sets: 3, reps: [10, 12], w: [80, 115] },
            { id: "rear-delt", name: "Задняя дельта сидя", scheme: "3 × 12–15 · RIR 1", sets: 3, reps: [12, 15], w: [16, 22] },
            { id: "french-db", name: "Французский жим стоя / разгибания в кроссовере", scheme: "3 × 10–15 · RIR 1", sets: 3, reps: [10, 15], w: [38, 42], wNote: "гантель 38–42 · или кроссовер 35–45" },
            { id: "abs", name: "Пресс в тренажёре", scheme: "3 × 12–15 · RIR 1–2", sets: 3, reps: [12, 15], w: [50, 55] },
          ],
        },
        {
          id: "t6", title: "Низ объёмный Б — мёртвая + гак", boss: "Корни Титана", icon: "tree",
          exercises: [
            { id: "rdl", name: "Мёртвая тяга", scheme: "3–4 × 8–10 · RIR 1–2", sets: 4, reps: [8, 10], w: [100, 120], main: true },
            { id: "hack", name: "Присед в гак-машине", scheme: "3 × 10–12 · RIR 2 · после мёртвой", sets: 3, reps: [10, 12], w: [70, 80] },
            { id: "legpress", name: "Жим ногами", scheme: "3 × 10–12 · RIR 1–2", sets: 3, reps: [10, 12], w: [150, 200] },
            { id: "legcurl-l", name: "Сгибания ног лёжа", scheme: "3 × 12–15 · RIR 1", sets: 3, reps: [12, 15], w: [50, 65] },
            { id: "calves", name: "Икры (любое)", scheme: "4 × 12–20 · RIR 1", sets: 4, reps: [12, 20], w: [120, 160] },
            { id: "curl-ez", name: "Сгибания EZ-гриф / молотки", scheme: "3 × 8–12 · RIR 1–2 · прямой бицепс дня", sets: 3, reps: [8, 12], w: [50, 60], wNote: "EZ 50–60 · или молотки 18–22" },
            { id: "abs", name: "Пресс в тренажёре", scheme: "3 × 12–15 · RIR 1–2", sets: 3, reps: [12, 15], w: [50, 55] },
          ],
        },
      ],
    },
    {
      n: 3, type: "силовая", pattern: "Верх · Низ · Верх", saga: "Сага о Закалке",
      workouts: [
        {
          id: "t7", title: "Верх тяжёлый А · прогрессия", boss: "Клинок Закалённый", icon: "dagger",
          exercises: [
            { id: "bench", name: "Жим штанги лёжа", scheme: "Лесенка / 5×5 · +2,5", sets: 5, reps: [5, 5], w: [100, 142.5], main: true, lift: "bench" },
            { id: "row", name: "Тяга штанги в наклоне", scheme: "4 × 6–8 · +2,5", sets: 4, reps: [6, 8], w: [100, 122.5] },
            { id: "push-press", name: "Швунг / армейский жим стоя", scheme: "3 × 5–8 · 2-й жим дня", sets: 3, reps: [5, 8], w: [60, 90], lift: "ohp" },
            { id: "pullup", name: "Подтягивания с весом", scheme: "3 × 6–8 · RIR 2–3", sets: 3, reps: [6, 8], w: [10, 20], wNote: "довесок к своему" },
            { id: "dips", name: "Брусья с поясом / жим узким", scheme: "3 × 6–8 · 3-й жим дня", sets: 3, reps: [6, 8], w: [30, 50], wNote: "+30–50 к поясу · или жим узким 70–85" },
            { id: "curl-bb", name: "Сгибания стоя прямой гриф", scheme: "3 × 6–8 · RIR 2", sets: 3, reps: [6, 8], w: [50, 65] },
            { id: "abs", name: "Пресс в тренажёре", scheme: "3 × 12–15 · RIR 1–2", sets: 3, reps: [12, 15], w: [50, 55] },
          ],
        },
        {
          id: "t8", title: "Низ тяжёлый — становая", boss: "Гнев Хребта", icon: "spine",
          exercises: [
            { id: "deadlift", name: "Становая тяга", scheme: "Лесенка до топ-сета 3–5 · RPE 8–9", sets: 5, reps: [3, 5], w: [130, 180], main: true, lift: "deadlift" },
            { id: "squat", name: "Приседания (вспомогат.)", scheme: "3 × 6–8 · RPE 7", sets: 3, reps: [6, 8], w: [100, 120], lift: "squat" },
            { id: "legext", name: "Разгибания ног сидя", scheme: "3 × 10–12 · RIR 2", sets: 3, reps: [10, 12], w: [90, 120] },
            { id: "legcurl-l", name: "Сгибания ног лёжа", scheme: "3 × 10–12 · RIR 2", sets: 3, reps: [10, 12], w: [50, 65] },
            { id: "calves", name: "Икры (любое)", scheme: "4 × 10–15 · RIR 1–2", sets: 4, reps: [10, 15], w: [120, 160] },
            { id: "abs", name: "Пресс в тренажёре", scheme: "3 × 12–15 · RIR 1–2", sets: 3, reps: [12, 15], w: [50, 55] },
          ],
        },
        {
          id: "t9", title: "Верх тяжёлый Б · прогрессия", boss: "Стальные Крылья", icon: "peak",
          exercises: [
            { id: "incline-bb", name: "Жим штанги в наклоне", scheme: "5 × 5–8 · +2,5", sets: 5, reps: [5, 8], w: [80, 102.5], main: true },
            { id: "db-row", name: "Тяга гантели в наклоне", scheme: "4 × 6–8 · RPE 7–8", sets: 4, reps: [6, 8], w: [42, 42] },
            { id: "lat", name: "Верхняя тяга в тренажёре", scheme: "3 × 8–10 · RIR 2–3", sets: 3, reps: [8, 10], w: [70, 100] },
            { id: "db-ohp", name: "Армейский жим гантели сидя", scheme: "3 × 8–10 · 2-й жим дня −15%", sets: 3, reps: [8, 10], w: [30, 36] },
            { id: "upright", name: "Тяга к подбородку", scheme: "3 × 8–10 · RIR 2–3", sets: 3, reps: [8, 10], w: [50, 70] },
            { id: "french-bb", name: "Французский жим лёжа", scheme: "3 × 8–10 · RIR 2", sets: 3, reps: [8, 10], w: [40, 50] },
            { id: "abs", name: "Пресс в тренажёре", scheme: "3 × 12–15 · RIR 1–2", sets: 3, reps: [12, 15], w: [50, 55] },
          ],
        },
      ],
    },
    {
      n: 4, type: "объёмная", pattern: "Низ · Верх · Низ", saga: "Сага о Мощи",
      workouts: [
        {
          id: "t10", title: "Низ объёмный А · прогрессия", boss: "Второе Пламя", icon: "flame",
          exercises: [
            { id: "squat-vol", name: "Присед многоповторный", scheme: "3–4 × 12–15 · +2,5 · кап 4", sets: 4, reps: [12, 15], w: [90, 102.5], main: true, lift: "squat" },
            { id: "legext", name: "Разгибания ног сидя", scheme: "3 × 12–15 · RIR 1", sets: 3, reps: [12, 15], w: [90, 120] },
            { id: "legcurl-s", name: "Сгибания ног сидя", scheme: "3 × 12–15 · RIR 1", sets: 3, reps: [12, 15], w: [60, 70] },
            { id: "hyper", name: "Гиперэкстензия", scheme: "3 × 10–12 · RIR 2", sets: 3, reps: [10, 12], w: [40, 40] },
            { id: "calves", name: "Икры (любое)", scheme: "4 × 12–20 · RIR 1", sets: 4, reps: [12, 20], w: [120, 160] },
            { id: "abs", name: "Пресс в тренажёре", scheme: "3 × 12–15 · RIR 1–2", sets: 3, reps: [12, 15], w: [50, 55] },
          ],
        },
        {
          id: "t11", title: "Верх объёмный Б — спина + руки", boss: "Расправить Крылья", icon: "wings",
          exercises: [
            { id: "db-row", name: "Тяга гантели в наклоне", scheme: "4 × 8–12 · RIR 1–2 · тяжёлая тяга дня", sets: 4, reps: [8, 12], w: [42, 42], main: true },
            { id: "lat", name: "Верхняя тяга в тренажёре", scheme: "4 × 10–12 · RIR 1–2", sets: 4, reps: [10, 12], w: [70, 100] },
            { id: "bench-row", name: "Тяга штанги к поясу на лавке", scheme: "3 × 10–12 · RIR 1–2", sets: 3, reps: [10, 12], w: [40, 50] },
            { id: "cross-low", name: "Кроссовер подъёмы снизу", scheme: "3 × 12–15 · RIR 1", sets: 3, reps: [12, 15], w: [15, 22.5] },
            { id: "flat-db", name: "Жим гантелей прямая скамья", scheme: "3 × 10–12 · жим в конце дня −10%", sets: 3, reps: [10, 12], w: [30, 38] },
            { id: "hammer", name: "Молотки с гантелями", scheme: "3 × 10–12 · RIR 1", sets: 3, reps: [10, 12], w: [18, 22] },
            { id: "cable-curl", name: "Сгибания в кроссовере / обратным хватом", scheme: "3 × 12–15 · RIR 1", sets: 3, reps: [12, 15], w: [13, 20], wNote: "кроссовер 13–20 · или обратный хват 20–24" },
            { id: "pushdown", name: "Кроссовер разгибания рук", scheme: "3 × 12–15 · RIR 1", sets: 3, reps: [12, 15], w: [35, 45] },
            { id: "abs", name: "Пресс в тренажёре", scheme: "3 × 12–15 · RIR 1–2", sets: 3, reps: [12, 15], w: [50, 55] },
          ],
        },
        {
          id: "t12", title: "Низ объёмный Б · прогрессия", boss: "Вершина Цикла", icon: "tower",
          exercises: [
            { id: "rdl", name: "Мёртвая тяга", scheme: "3–4 × 8–10 · +2,5", sets: 4, reps: [8, 10], w: [100, 122.5], main: true },
            { id: "hack", name: "Присед в гак-машине", scheme: "3 × 10–12 · RIR 2 · после мёртвой", sets: 3, reps: [10, 12], w: [70, 80] },
            { id: "legpress", name: "Жим ногами", scheme: "3 × 10–12 · RIR 1–2", sets: 3, reps: [10, 12], w: [150, 200] },
            { id: "legcurl-l", name: "Сгибания ног лёжа", scheme: "3 × 12–15 · RIR 1", sets: 3, reps: [12, 15], w: [50, 65] },
            { id: "calves", name: "Икры (любое)", scheme: "4 × 12–20 · RIR 1", sets: 4, reps: [12, 20], w: [120, 160] },
            { id: "hammer", name: "Молотки / EZ-гриф", scheme: "3 × 8–12 · RIR 1–2 · прямой бицепс дня", sets: 3, reps: [8, 12], w: [18, 22], wNote: "молотки 18–22 · или EZ 50–60" },
            { id: "abs", name: "Пресс в тренажёре", scheme: "3 × 12–15 · RIR 1–2", sets: 3, reps: [12, 15], w: [50, 55] },
          ],
        },
      ],
    },
  ],
};

// Архив прошлого цикла (Цикл I/II) — чтобы старые сессии в «Хрониках» открывались и
// их движения по-прежнему учитывались в аналитике потолка/пола (id движений совпадают).
const ax = (id, name, extra = {}) => ({ id, name, ...extra });
export const ARCHIVED_WORKOUTS = [
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

// Базовые расчётные максимумы (старт персонажа)
export const BASELINES = { bench: 147, squat: 170, deadlift: 195, ohp: 100 };
export const LIFT_NAMES = { bench: "Жим лёжа", squat: "Присед", deadlift: "Становая", ohp: "Швунг" };
