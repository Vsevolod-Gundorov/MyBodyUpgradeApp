// Месячный цикл: 3 тренировки/нед · Недели 1–2 силовые · 3–4 объёмные
// main: движение дня (единственное на пределе)
export const PROGRAM = {
  cycleName: "Цикл I — Кузница",
  weeks: [
    {
      n: 1, type: "силовая", pattern: "Верх · Низ · Верх",
      workouts: [
        {
          id: "w1t1", title: "Верх тяжёлый А", boss: "Испытание Стали",
          exercises: [
            { id: "bench", name: "Жим штанги лёжа", scheme: "Лесенка / 5×5", sets: 5, reps: [5, 5], w: [100, 140], main: true, lift: "bench" },
            { id: "row", name: "Тяга штанги в наклоне", scheme: "4 × 6–8", sets: 4, reps: [6, 8], w: [100, 120] },
            { id: "push-press", name: "Швунг / армейский жим стоя", scheme: "3 × 5–8", sets: 3, reps: [5, 8], w: [60, 100], lift: "ohp" },
            { id: "pullup", name: "Подтягивания с весом", scheme: "3 × 6–8", sets: 3, reps: [6, 8], w: [20, 20], wNote: "свой + 20" },
            { id: "dips", name: "Брусья с поясом / жим узким", scheme: "3 × 6–8", sets: 3, reps: [6, 8], w: [40, 90], wNote: "+40–60 / 80–90" },
            { id: "curl-ez", name: "Сгибания стоя EZ-гриф", scheme: "3 × 6–8", sets: 3, reps: [6, 8], w: [50, 65] },
            { id: "abs", name: "Пресс в тренажёре", scheme: "3 × 12–15", sets: 3, reps: [12, 15], w: [50, 55] },
          ],
        },
        {
          id: "w1t2", title: "Низ тяжёлый — присед", boss: "Испытание Опоры",
          exercises: [
            { id: "squat", name: "Приседания свободный вес", scheme: "Лесенка / 5×5", sets: 5, reps: [5, 5], w: [100, 150], main: true, lift: "squat" },
            { id: "rdl", name: "Мёртвая тяга", scheme: "3 × 6–8 · RPE 7", sets: 3, reps: [6, 8], w: [100, 120] },
            { id: "legpress", name: "Жим ногами", scheme: "3 × 8–10", sets: 3, reps: [8, 10], w: [150, 200] },
            { id: "legcurl-s", name: "Сгибания ног сидя", scheme: "3 × 10–12", sets: 3, reps: [10, 12], w: [60, 70] },
            { id: "calves", name: "Икры (любое)", scheme: "4 × 10–15", sets: 4, reps: [10, 15], w: [120, 160] },
            { id: "abs", name: "Пресс в тренажёре", scheme: "3 × 12–15", sets: 3, reps: [12, 15], w: [50, 55] },
          ],
        },
        {
          id: "w1t3", title: "Верх тяжёлый Б", boss: "Испытание Наклона",
          exercises: [
            { id: "incline-bb", name: "Жим штанги в наклоне", scheme: "5 × 5–8", sets: 5, reps: [5, 8], w: [80, 100], main: true },
            { id: "db-row", name: "Тяга гантели в наклоне", scheme: "4 × 6–8", sets: 4, reps: [6, 8], w: [42, 42] },
            { id: "lat", name: "Верхняя тяга в тренажёре", scheme: "3 × 8–10", sets: 3, reps: [8, 10], w: [70, 100] },
            { id: "db-ohp", name: "Армейский жим гантели сидя", scheme: "3 × 8–10", sets: 3, reps: [8, 10], w: [38, 42] },
            { id: "upright", name: "Тяга к подбородку", scheme: "3 × 8–10", sets: 3, reps: [8, 10], w: [50, 70] },
            { id: "french-bb", name: "Французский жим лёжа", scheme: "3 × 8–10", sets: 3, reps: [8, 10], w: [40, 50] },
            { id: "abs", name: "Пресс в тренажёре", scheme: "3 × 12–15", sets: 3, reps: [12, 15], w: [50, 55] },
          ],
        },
      ],
    },
    {
      n: 2, type: "силовая", pattern: "Низ · Верх · Низ",
      workouts: [
        {
          id: "w2t1", title: "Низ тяжёлый — становая", boss: "Испытание Хребта",
          exercises: [
            { id: "deadlift", name: "Становая тяга", scheme: "Лесенка до топ-сета 3–5", sets: 5, reps: [3, 5], w: [130, 180], main: true, lift: "deadlift" },
            { id: "squat", name: "Приседания (вспомогат.)", scheme: "3 × 6–8 · RPE 7", sets: 3, reps: [6, 8], w: [100, 120], lift: "squat" },
            { id: "legext", name: "Разгибания ног сидя", scheme: "3 × 10–12", sets: 3, reps: [10, 12], w: [90, 120] },
            { id: "legcurl-l", name: "Сгибания ног лёжа", scheme: "3 × 10–12", sets: 3, reps: [10, 12], w: [50, 65] },
            { id: "calves", name: "Икры (любое)", scheme: "4 × 10–15", sets: 4, reps: [10, 15], w: [120, 160] },
            { id: "abs", name: "Пресс в тренажёре", scheme: "3 × 12–15", sets: 3, reps: [12, 15], w: [50, 55] },
          ],
        },
        {
          id: "w2t2", title: "Верх тяжёлый А · прогрессия", boss: "Испытание Стали II",
          exercises: [
            { id: "bench", name: "Жим штанги лёжа", scheme: "Лесенка / 5×5 · +2,5", sets: 5, reps: [5, 5], w: [100, 142.5], main: true, lift: "bench" },
            { id: "row", name: "Тяга штанги в наклоне", scheme: "4 × 6–8 · +2,5", sets: 4, reps: [6, 8], w: [100, 122.5] },
            { id: "push-press", name: "Швунг / армейский жим стоя", scheme: "3 × 5–8", sets: 3, reps: [5, 8], w: [60, 100], lift: "ohp" },
            { id: "pullup", name: "Подтягивания с весом", scheme: "3 × 6–8", sets: 3, reps: [6, 8], w: [20, 20], wNote: "свой + 20" },
            { id: "dips", name: "Брусья с поясом / жим узким", scheme: "3 × 6–8", sets: 3, reps: [6, 8], w: [40, 90], wNote: "+40–60 / 80–90" },
            { id: "curl-bb", name: "Сгибания стоя прямой гриф", scheme: "3 × 6–8", sets: 3, reps: [6, 8], w: [50, 65] },
            { id: "abs", name: "Пресс в тренажёре", scheme: "3 × 12–15", sets: 3, reps: [12, 15], w: [50, 55] },
          ],
        },
        {
          id: "w2t3", title: "Низ тяжёлый — присед · прогрессия", boss: "Испытание Опоры II",
          exercises: [
            { id: "squat", name: "Приседания свободный вес", scheme: "Лесенка / 5×5 · +5", sets: 5, reps: [5, 5], w: [100, 155], main: true, lift: "squat" },
            { id: "rdl", name: "Мёртвая тяга", scheme: "3 × 6–8 · RPE 7", sets: 3, reps: [6, 8], w: [100, 120] },
            { id: "legpress", name: "Жим ногами", scheme: "3 × 8–10", sets: 3, reps: [8, 10], w: [150, 200] },
            { id: "legcurl-s", name: "Сгибания ног сидя", scheme: "3 × 10–12", sets: 3, reps: [10, 12], w: [60, 70] },
            { id: "calves", name: "Икры (любое)", scheme: "4 × 10–15", sets: 4, reps: [10, 15], w: [120, 160] },
            { id: "abs", name: "Пресс в тренажёре", scheme: "3 × 12–15", sets: 3, reps: [12, 15], w: [50, 55] },
          ],
        },
      ],
    },
    {
      n: 3, type: "объёмная", pattern: "Верх · Низ · Верх",
      workouts: [
        {
          id: "w3t1", title: "Верх объёмный А — грудь + плечи", boss: "Испытание Полноты",
          exercises: [
            { id: "incline-db", name: "Жим гантелей в наклоне", scheme: "4 × 8–12", sets: 4, reps: [8, 12], w: [34, 42], main: true },
            { id: "cross-mid", name: "Кроссовер сведение на грудь", scheme: "3 × 12–15", sets: 3, reps: [12, 15], w: [15, 20] },
            { id: "lat-raise", name: "Махи стоя", scheme: "4 × 10–15", sets: 4, reps: [10, 15], w: [20, 24] },
            { id: "cross-delt", name: "Разводка на плечи в кроссовере", scheme: "3 × 12–15", sets: 3, reps: [12, 15], w: [5, 7.5] },
            { id: "lat", name: "Верхняя тяга в тренажёре", scheme: "4 × 10–12", sets: 4, reps: [10, 12], w: [70, 100] },
            { id: "cable-row", name: "Тяга к поясу в тренажёре", scheme: "3 × 10–12", sets: 3, reps: [10, 12], w: [80, 115] },
            { id: "rear-delt", name: "Задняя дельта сидя", scheme: "3 × 12–15", sets: 3, reps: [12, 15], w: [16, 22] },
            { id: "french-db", name: "Французский жим стоя с гантелей", scheme: "3 × 10–12", sets: 3, reps: [10, 12], w: [38, 42] },
            { id: "pushdown", name: "Кроссовер разгибания рук", scheme: "3 × 12–15", sets: 3, reps: [12, 15], w: [35, 45] },
            { id: "abs", name: "Пресс в тренажёре", scheme: "3 × 12–15", sets: 3, reps: [12, 15], w: [50, 55] },
          ],
        },
        {
          id: "w3t2", title: "Низ объёмный А — многоповторка", boss: "Испытание Выдержки",
          exercises: [
            { id: "squat-vol", name: "Присед многоповторный", scheme: "4–5 × 12–15", sets: 5, reps: [12, 15], w: [100, 100], main: true, lift: "squat" },
            { id: "hack", name: "Присед в гак-машине", scheme: "3 × 10–12", sets: 3, reps: [10, 12], w: [80, 80] },
            { id: "legext", name: "Разгибания ног сидя", scheme: "3 × 12–15", sets: 3, reps: [12, 15], w: [90, 120] },
            { id: "legcurl-s", name: "Сгибания ног сидя", scheme: "3 × 12–15", sets: 3, reps: [12, 15], w: [60, 70] },
            { id: "hyper", name: "Гиперэкстензия", scheme: "3 × 10–12", sets: 3, reps: [10, 12], w: [40, 40] },
            { id: "calves", name: "Икры (любое)", scheme: "4 × 12–20", sets: 4, reps: [12, 20], w: [120, 160] },
            { id: "abs", name: "Пресс в тренажёре", scheme: "3 × 12–15", sets: 3, reps: [12, 15], w: [50, 55] },
          ],
        },
        {
          id: "w3t3", title: "Верх объёмный Б — спина + руки", boss: "Испытание Крыльев",
          exercises: [
            { id: "db-row", name: "Тяга гантели в наклоне", scheme: "4 × 8–12", sets: 4, reps: [8, 12], w: [42, 42], main: true },
            { id: "lat", name: "Верхняя тяга в тренажёре", scheme: "4 × 10–12", sets: 4, reps: [10, 12], w: [70, 100] },
            { id: "bench-row", name: "Тяга штанги к поясу на лавке", scheme: "3 × 10–12", sets: 3, reps: [10, 12], w: [40, 50] },
            { id: "cross-low", name: "Кроссовер подъёмы снизу", scheme: "3 × 12–15", sets: 3, reps: [12, 15], w: [15, 22.5] },
            { id: "flat-db", name: "Жим гантелей прямая скамья", scheme: "3 × 10–12", sets: 3, reps: [10, 12], w: [34, 42] },
            { id: "hammer", name: "Молотки с гантелями", scheme: "3 × 10–12", sets: 3, reps: [10, 12], w: [18, 22] },
            { id: "cable-curl", name: "Сгибания в кроссовере (углы)", scheme: "3 × 12–15", sets: 3, reps: [12, 15], w: [13, 20] },
            { id: "rev-curl", name: "Сгибания обратным хватом", scheme: "2–3 × 10–12", sets: 3, reps: [10, 12], w: [20, 24] },
            { id: "pushdown", name: "Кроссовер разгибания рук", scheme: "3 × 12–15", sets: 3, reps: [12, 15], w: [35, 45] },
            { id: "abs", name: "Пресс в тренажёре", scheme: "3 × 12–15", sets: 3, reps: [12, 15], w: [50, 55] },
          ],
        },
      ],
    },
    {
      n: 4, type: "объёмная", pattern: "Низ · Верх · Низ",
      workouts: [
        {
          id: "w4t1", title: "Низ объёмный Б — задняя цепь", boss: "Испытание Корней",
          exercises: [
            { id: "rdl", name: "Мёртвая тяга", scheme: "3–4 × 8–10", sets: 4, reps: [8, 10], w: [100, 120], main: true },
            { id: "legpress", name: "Жим ногами", scheme: "4 × 10–12", sets: 4, reps: [10, 12], w: [150, 200] },
            { id: "legcurl-l", name: "Сгибания ног лёжа", scheme: "3 × 12–15", sets: 3, reps: [12, 15], w: [50, 65] },
            { id: "legext", name: "Разгибания ног сидя", scheme: "3 × 12–15", sets: 3, reps: [12, 15], w: [90, 120] },
            { id: "hyper", name: "Гиперэкстензия", scheme: "3 × 10–12", sets: 3, reps: [10, 12], w: [40, 40] },
            { id: "calves", name: "Икры (любое)", scheme: "4 × 12–20", sets: 4, reps: [12, 20], w: [120, 160] },
            { id: "abs", name: "Пресс в тренажёре", scheme: "3 × 12–15", sets: 3, reps: [12, 15], w: [50, 55] },
          ],
        },
        {
          id: "w4t2", title: "Верх объёмный А · прогрессия", boss: "Испытание Полноты II",
          exercises: [
            { id: "incline-db", name: "Жим гантелей в наклоне", scheme: "4 × 8–12 · +повторы", sets: 4, reps: [8, 12], w: [34, 42], main: true },
            { id: "cross-mid", name: "Кроссовер сведение на грудь", scheme: "3 × 12–15", sets: 3, reps: [12, 15], w: [15, 20] },
            { id: "lat-raise", name: "Махи стоя", scheme: "4 × 10–15", sets: 4, reps: [10, 15], w: [20, 24] },
            { id: "db-ohp", name: "Армейский жим гантели сидя", scheme: "3 × 10–12", sets: 3, reps: [10, 12], w: [38, 42] },
            { id: "lat", name: "Верхняя тяга в тренажёре", scheme: "4 × 10–12", sets: 4, reps: [10, 12], w: [70, 100] },
            { id: "cable-row", name: "Тяга к поясу в тренажёре", scheme: "3 × 10–12", sets: 3, reps: [10, 12], w: [80, 115] },
            { id: "rear-delt", name: "Задняя дельта сидя", scheme: "3 × 12–15", sets: 3, reps: [12, 15], w: [16, 22] },
            { id: "french-bb", name: "Французский жим лёжа", scheme: "3 × 10–12", sets: 3, reps: [10, 12], w: [40, 50] },
            { id: "pushdown", name: "Кроссовер разгибания рук", scheme: "3 × 12–15", sets: 3, reps: [12, 15], w: [35, 45] },
            { id: "abs", name: "Пресс в тренажёре", scheme: "3 × 12–15", sets: 3, reps: [12, 15], w: [50, 55] },
          ],
        },
        {
          id: "w4t3", title: "Низ объёмный А · прогрессия", boss: "Испытание Выдержки II",
          exercises: [
            { id: "squat-vol", name: "Присед многоповторный", scheme: "4–5 × 12–15 · +2,5–5", sets: 5, reps: [12, 15], w: [100, 105], main: true, lift: "squat" },
            { id: "hack", name: "Присед в гак-машине", scheme: "3 × 10–12", sets: 3, reps: [10, 12], w: [80, 80] },
            { id: "legext", name: "Разгибания ног сидя", scheme: "3 × 12–15", sets: 3, reps: [12, 15], w: [90, 120] },
            { id: "legcurl-s", name: "Сгибания ног сидя", scheme: "3 × 12–15", sets: 3, reps: [12, 15], w: [60, 70] },
            { id: "hyper", name: "Гиперэкстензия", scheme: "3 × 10–12", sets: 3, reps: [10, 12], w: [40, 40] },
            { id: "calves", name: "Икры (любое)", scheme: "4 × 12–20", sets: 4, reps: [12, 20], w: [120, 160] },
            { id: "abs", name: "Пресс в тренажёре", scheme: "3 × 12–15", sets: 3, reps: [12, 15], w: [50, 55] },
          ],
        },
      ],
    },
  ],
};

// Базовые расчётные максимумы (старт персонажа)
export const BASELINES = { bench: 147, squat: 170, deadlift: 195, ohp: 100 };
export const LIFT_NAMES = { bench: "Жим лёжа", squat: "Присед", deadlift: "Становая", ohp: "Швунг" };
