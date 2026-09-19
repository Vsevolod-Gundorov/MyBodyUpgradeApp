// Достижения и знаки отличия: 100 уникальных наград шести рангов.
// Чистые данные + чистая функция evaluate() — без DOM и без доступа к состоянию приложения.
// Контекст ctx собирает js/app.js (buildAchievementCtx). Здесь только правила.
//
// Поля достижения:
//   id      — стабильный ключ (хранится в S.achievements)
//   name    — название, desc — как получить (показывается и для закрытых)
//   tier    — bronze | silver | gold | diamond | emerald | titanium
//   cat     — раздел для списка
//   icon    — имя иконки (data/icons.js или data/icons-achievements.js)
//   repeat  — true: повторяемое, при повторном получении растёт счётчик ×N
//   test(ctx) — условие. Для repeat проверяется только при событии нужного типа (when)
//   when    — тип события, при котором повторяемое достижение может выпасть ("session")

export const TIERS = {
  bronze:   { key: "bronze",   name: "Бронза",  rank: 1 },
  silver:   { key: "silver",   name: "Серебро", rank: 2 },
  gold:     { key: "gold",     name: "Золото",  rank: 3 },
  diamond:  { key: "diamond",  name: "Алмаз",   rank: 4 },
  emerald:  { key: "emerald",  name: "Изумруд", rank: 5 },
  titanium: { key: "titanium", name: "Титан",   rank: 6 },
};
export const TIER_ORDER = ["bronze", "silver", "gold", "diamond", "emerald", "titanium"];

export const CATEGORIES = {
  path:       "Путь героя",
  quest:      "Квесты",
  tonnage:    "Тоннаж",
  strength:   "Сила",
  discipline: "Дисциплина",
  hero:       "Герой",
  nutrition:  "Ресурсы",
  buffs:      "Баффы",
  chronicle:  "Хроники",
  fate:       "Судьба",
};

const s = (ctx) => ctx.session || {};
const lift = (ctx, k) => (ctx.lifts && ctx.lifts[k] && ctx.lifts[k].cur) || 0;
const bw = (ctx) => (ctx.hero && ctx.hero.bodyweight) || 90;
const stat = (ctx, k) => (ctx.hero && ctx.hero.stats && ctx.hero.stats[k]) || 0;
const allStats = (ctx) => Object.values((ctx.hero && ctx.hero.stats) || {});
const nut = (ctx) => ctx.nutrition || {};
const buffs = (ctx) => ctx.buffs || {};
const totals = (ctx) => ctx.totals || {};
const fate = (ctx, p) => ctx.event && ctx.event.type === "session" && (ctx.rng == null ? Math.random() : ctx.rng()) < p;

const A = (id, name, tier, cat, icon, desc, test, extra = {}) => ({ id, name, tier, cat, icon, desc, test, ...extra });
const R = (id, name, tier, cat, icon, desc, test) => A(id, name, tier, cat, icon, desc, test, { repeat: true, when: "session" });

export const ACHIEVEMENTS = [
  /* ---------- Путь героя: вехи по числу квестов и кругам цикла ---------- */
  A("awakened",  "Пробуждённый",      "bronze",   "path", "helm",           "Закрыть первый квест",                       (c) => totals(c).sessions >= 1),
  A("grind10",   "Ветеран Гринда",    "silver",   "path", "sigil",          "Закрыть 10 квестов",                         (c) => totals(c).sessions >= 10),
  A("grind50",   "Полусотник",        "gold",     "path", "laurels-trophy", "Закрыть 50 квестов",                         (c) => totals(c).sessions >= 50),
  A("grind100",  "Сотник",            "diamond",  "path", "laurel-crown",   "Закрыть 100 квестов",                        (c) => totals(c).sessions >= 100),
  A("grind250",  "Легенда Кузницы",   "emerald",  "path", "imperial-crown", "Закрыть 250 квестов",                        (c) => totals(c).sessions >= 250),
  A("grind500",  "Бессмертный",       "titanium", "path", "ankh",           "Закрыть 500 квестов",                        (c) => totals(c).sessions >= 500),
  A("cycle1",    "Круг Замкнут",      "gold",     "path", "cycle",          "Пройти все квесты цикла хотя бы по разу",    (c) => totals(c).cycles >= 1),
  A("cycle3",    "Три Круга",         "diamond",  "path", "trophy-cup",     "Пройти полный цикл трижды",                  (c) => totals(c).cycles >= 3),
  A("cycle6",    "Вечное Колесо",     "emerald",  "path", "star-cycle",     "Пройти полный цикл шесть раз",               (c) => totals(c).cycles >= 6),
  A("saga_str",  "Сага Стали",        "silver",   "path", "anvil",          "Закрыть все квесты силовых недель",          (c) => totals(c).sagaStrength),
  A("saga_vol",  "Сага Полноты",      "silver",   "path", "hourglass",      "Закрыть все квесты объёмных недель",         (c) => totals(c).sagaVolume),

  /* ---------- Квесты: повторяемые, за конкретную тренировку ---------- */
  R("firstblood","Первопроходец",     "bronze",   "quest", "sword",         "Пройти квест впервые",                       (c) => s(c).firstClear),
  R("overkill",  "Сверх Нормы",       "bronze",   "quest", "muscle",        "Закрыть все подходы при счёте 80%+",         (c) => s(c).doneSets >= s(c).plannedSets && s(c).score >= 80),
  R("flawless",  "Безупречный Квест", "silver",   "quest", "shield",        "Пройти квест на 90%+",                       (c) => s(c).score >= 90),
  R("perfect",   "Абсолют",           "gold",     "quest", "star-medal",    "Пройти квест на 100%",                       (c) => s(c).score >= 100),
  R("pr",        "Новый Предел",      "silver",   "quest", "gem",           "Личный рекорд расчётного 1ПМ",               (c) => (s(c).prLifts || []).length >= 1),
  R("pr_double", "Двойной Удар",      "gold",     "quest", "crossed-swords","Два рекорда в одном квесте",                 (c) => (s(c).prLifts || []).length >= 2),
  R("pr_main",   "Движение Дня",      "silver",   "quest", "on-target",     "Рекорд в движении дня",                      (c) => s(c).prMain),
  R("sprint",    "Молниеносный",      "silver",   "quest", "lightning",     "Все подходы, 85%+ и уложиться в час",        (c) => s(c).doneSets >= s(c).plannedSets && s(c).score >= 85 && s(c).durationSec > 0 && s(c).durationSec <= 3600),
  R("dawn",      "Рассветный Клинок", "bronze",   "quest", "sunrise",       "Закрыть квест до 9 утра",                    (c) => s(c).hour != null && s(c).hour < 9),
  R("owl",       "Ночной Страж",      "bronze",   "quest", "owl",           "Закрыть квест после 22:00",                  (c) => s(c).hour != null && s(c).hour >= 22),
  R("fatigue",   "Сквозь Усталость",  "gold",     "quest", "tired-eye",     "Пройти на 85%+ в состоянии «Устал»",         (c) => s(c).feel === "tired" && s(c).score >= 85),
  R("reps300",   "Триста Спартанцев", "silver",   "quest", "spartan-helmet","300+ повторений за квест",                   (c) => s(c).totalReps >= 300),
  R("comeback",  "Возвращение",       "silver",   "quest", "return-arrow",  "Вернуться после паузы в 14+ дней",           (c) => s(c).gapDays >= 14),
  R("iron8",     "Гора Железа",       "bronze",   "quest", "weight",        "Поднять 8 т за квест",                       (c) => s(c).tonn >= 8000),
  R("iron10",    "Десять Тонн",       "silver",   "quest", "kettle",        "Поднять 10 т за квест",                      (c) => s(c).tonn >= 10000),
  R("iron12",    "Хребет Мира",       "gold",     "quest", "spine",         "Поднять 12 т за квест",                      (c) => s(c).tonn >= 12000),
  R("iron15",    "Атлант",            "diamond",  "quest", "giant",         "Поднять 15 т за квест",                      (c) => s(c).tonn >= 15000),

  /* ---------- Тоннаж за всё время ---------- */
  A("life50",    "Первые Полсотни Тонн","bronze", "tonnage", "rock",          "50 т суммарно за всё время",               (c) => totals(c).lifetimeT >= 50),
  A("life100",   "Сто Тонн",          "silver",   "tonnage", "falling-boulder","100 т суммарно",                          (c) => totals(c).lifetimeT >= 100),
  A("life250",   "Каменоломня",       "gold",     "tonnage", "brick-pile",    "250 т суммарно",                           (c) => totals(c).lifetimeT >= 250),
  A("life500",   "Полтысячи Тонн",    "diamond",  "tonnage", "stone-tower",   "500 т суммарно",                           (c) => totals(c).lifetimeT >= 500),
  A("life1000",  "Тысяча Тонн",       "emerald",  "tonnage", "volcano",       "1000 т суммарно",                          (c) => totals(c).lifetimeT >= 1000),
  A("life2500",  "Гора Сдвинута",     "titanium", "tonnage", "mountains",     "2500 т суммарно",                          (c) => totals(c).lifetimeT >= 2500),

  /* ---------- Сила: клубы по расчётному 1ПМ ---------- */
  A("bench150",  "Клуб 150 · Жим",    "bronze",   "strength", "fist",         "Расчётный 1ПМ жима лёжа ≥ 150 кг",         (c) => lift(c, "bench") >= 150),
  A("bench160",  "Клуб 160 · Жим",    "silver",   "strength", "fist",         "Жим лёжа ≥ 160 кг",                        (c) => lift(c, "bench") >= 160),
  A("bench170",  "Клуб 170 · Жим",    "gold",     "strength", "fist",         "Жим лёжа ≥ 170 кг",                        (c) => lift(c, "bench") >= 170),
  A("squat180",  "Клуб 180 · Присед", "bronze",   "strength", "leg-armor",    "Расчётный 1ПМ приседа ≥ 180 кг",           (c) => lift(c, "squat") >= 180),
  A("squat200",  "Клуб 200 · Присед", "silver",   "strength", "leg-armor",    "Присед ≥ 200 кг",                          (c) => lift(c, "squat") >= 200),
  A("squat220",  "Клуб 220 · Присед", "gold",     "strength", "leg-armor",    "Присед ≥ 220 кг",                          (c) => lift(c, "squat") >= 220),
  A("dl200",     "Клуб 200 · Становая","bronze",  "strength", "mailed-fist",  "Расчётный 1ПМ становой ≥ 200 кг",          (c) => lift(c, "deadlift") >= 200),
  A("dl220",     "Клуб 220 · Становая","silver",  "strength", "mailed-fist",  "Становая ≥ 220 кг",                        (c) => lift(c, "deadlift") >= 220),
  A("dl240",     "Клуб 240 · Становая","gold",    "strength", "mailed-fist",  "Становая ≥ 240 кг",                        (c) => lift(c, "deadlift") >= 240),
  A("ohp105",    "Клуб 105 · Швунг",  "bronze",   "strength", "strong-man",   "Расчётный 1ПМ швунга ≥ 105 кг",            (c) => lift(c, "ohp") >= 105),
  A("ohp120",    "Клуб 120 · Швунг",  "gold",     "strength", "strong-man",   "Швунг ≥ 120 кг",                           (c) => lift(c, "ohp") >= 120),
  A("total550",  "Троеборец 550",     "silver",   "strength", "podium-winner","Жим + присед + становая ≥ 550 кг",         (c) => totals(c).big3 >= 550),
  A("total600",  "Троеборец 600",     "gold",     "strength", "podium-winner","Сумма троеборья ≥ 600 кг",                 (c) => totals(c).big3 >= 600),
  A("total650",  "Троеборец 650",     "diamond",  "strength", "trophy",       "Сумма троеборья ≥ 650 кг",                 (c) => totals(c).big3 >= 650),
  A("total700",  "Троеборец 700",     "emerald",  "strength", "trophy",       "Сумма троеборья ≥ 700 кг",                 (c) => totals(c).big3 >= 700),
  A("total800",  "Троеборец 800",     "titanium", "strength", "trophy",       "Сумма троеборья ≥ 800 кг",                 (c) => totals(c).big3 >= 800),
  A("squat2bw",  "Два Себя",          "gold",     "strength", "weight-scale", "Присед ≥ 2 × вес тела",                    (c) => lift(c, "squat") >= 2 * bw(c)),
  A("dl25bw",    "Два с Половиной Себя","diamond","strength", "weight-scale", "Становая ≥ 2,5 × вес тела",                (c) => lift(c, "deadlift") >= 2.5 * bw(c)),
  A("ohpbw",     "Себя над Головой",  "emerald",  "strength", "biceps",       "Швунг ≥ 1,25 × вес тела",                  (c) => lift(c, "ohp") >= 1.25 * bw(c)),
  A("gain5",     "Плюс Пять",         "silver",   "strength", "armor-upgrade","Средний прирост 1ПМ к базе ≥ 5%",          (c) => totals(c).avgGain >= 0.05),
  A("gain10",    "Плюс Десять",       "gold",     "strength", "armor-upgrade","Средний прирост 1ПМ к базе ≥ 10%",         (c) => totals(c).avgGain >= 0.10),
  A("gain20",    "Плюс Двадцать",     "diamond",  "strength", "armor-upgrade","Средний прирост 1ПМ к базе ≥ 20%",         (c) => totals(c).avgGain >= 0.20),
  A("gain35",    "Перекованный",      "titanium", "strength", "armor-upgrade","Средний прирост 1ПМ к базе ≥ 35%",         (c) => totals(c).avgGain >= 0.35),

  /* ---------- Дисциплина: недели без пропусков и серии побед ---------- */
  A("week3",     "Неделя Долга",      "bronze",   "discipline", "calendar",       "3 квеста за одну неделю",                (c) => totals(c).maxWeek >= 3),
  A("streak4",   "Месяц Железа",      "silver",   "discipline", "crossed-chains", "4 недели подряд по 3 квеста",            (c) => totals(c).weekStreak >= 4),
  A("streak8",   "Два Месяца в Строю","gold",     "discipline", "wavy-chains",    "8 недель подряд по 3 квеста",            (c) => totals(c).weekStreak >= 8),
  A("streak12",  "Сезон Стали",       "diamond",  "discipline", "andromeda-chain","12 недель подряд по 3 квеста",           (c) => totals(c).weekStreak >= 12),
  A("streak26",  "Полгода Без Пропусков","emerald","discipline","calendar-half",  "26 недель подряд по 3 квеста",           (c) => totals(c).weekStreak >= 26),
  A("streak52",  "Год Гринда",        "titanium", "discipline", "over-infinity",  "52 недели подряд по 3 квеста",           (c) => totals(c).weekStreak >= 52),
  A("gold3",     "Тройное Золото",    "bronze",   "discipline", "medallist",      "3 квеста подряд на 85%+",                (c) => totals(c).goldStreak >= 3),
  A("gold5",     "Пять Побед Подряд", "silver",   "discipline", "ribbon-medal",   "5 квестов подряд на 85%+",               (c) => totals(c).goldStreak >= 5),
  A("gold10",    "Десять Побед Подряд","gold",    "discipline", "medal",          "10 квестов подряд на 85%+",              (c) => totals(c).goldStreak >= 10),

  /* ---------- Герой: уровни, класс, характеристики ---------- */
  A("lvl5",      "Пятый Круг",        "bronze",   "hero", "stairs",       "Достичь 5 уровня",                             (c) => (c.hero && c.hero.level) >= 5),
  A("lvl10",     "Десятый Круг",      "silver",   "hero", "stairs-3d",    "Достичь 10 уровня",                            (c) => (c.hero && c.hero.level) >= 10),
  A("lvl20",     "Двадцатый Круг",    "gold",     "hero", "stairs-goal",  "Достичь 20 уровня",                            (c) => (c.hero && c.hero.level) >= 20),
  A("lvl30",     "Тридцатый Круг",    "diamond",  "hero", "podium",       "Достичь 30 уровня",                            (c) => (c.hero && c.hero.level) >= 30),
  A("class1",    "Обретший Класс",    "bronze",   "hero", "knight-banner","Выйти из новобранцев и получить класс",        (c) => c.hero && c.hero.cls && !c.hero.cls.novice),
  A("hybrid",    "Двуликий",          "gold",     "hero", "duality-mask", "Получить гибридный класс",                     (c) => c.hero && c.hero.cls && c.hero.cls.hybrid),
  A("stat75",    "Мастер Грани",      "silver",   "hero", "beveled-star", "Любая характеристика ≥ 75",                    (c) => allStats(c).some((v) => v >= 75)),
  A("stat90",    "Совершенство Грани","gold",     "hero", "barbed-star",  "Любая характеристика ≥ 90",                    (c) => allStats(c).some((v) => v >= 90)),
  A("all60",     "Гармония",          "diamond",  "hero", "lotus",        "Все характеристики ≥ 60",                      (c) => allStats(c).length >= 6 && allStats(c).every((v) => v >= 60)),
  A("all80",     "Равновесие Титана", "titanium", "hero", "meditation",   "Все характеристики ≥ 80",                      (c) => allStats(c).length >= 6 && allStats(c).every((v) => v >= 80)),

  /* ---------- Ресурсы: питание и вода ---------- */
  A("meal1",     "Первая Трапеза",    "bronze",   "nutrition", "meal",         "Записать первый день питания",             (c) => nut(c).daysLogged >= 1),
  A("protein1",  "Плоть Крепнет",     "bronze",   "nutrition", "steak",        "Закрыть норму белка за день",              (c) => nut(c).proteinDays >= 1),
  A("protein7",  "Неделя Белка",      "silver",   "nutrition", "steak",        "7 дней с нормой белка",                    (c) => nut(c).proteinDays >= 7),
  A("protein30", "Месяц Белка",       "gold",     "nutrition", "steak",        "30 дней с нормой белка",                   (c) => nut(c).proteinDays >= 30),
  A("water1",    "Родник",            "bronze",   "nutrition", "fountain",     "Выпить дневную норму воды",                (c) => nut(c).waterDays >= 1),
  A("kcal7",     "Точный Рацион",     "silver",   "nutrition", "kitchen-scale","7 дней в цели по калориям (±7%)",          (c) => nut(c).kcalDays >= 7),
  A("full1",     "Полный Котёл",      "gold",     "nutrition", "cauldron",     "Белок, калории и вода в цели за один день",(c) => nut(c).fullDays >= 1),
  A("full7",     "Семь Полных Котлов","diamond",  "nutrition", "cauldron",     "7 дней с белком, калориями и водой в цели",(c) => nut(c).fullDays >= 7),
  A("fiber1",    "Корни Здоровья",    "bronze",   "nutrition", "broccoli",     "30 г клетчатки за день",                   (c) => nut(c).fiberDays >= 1),
  A("foods30",   "Гурман Кузницы",    "silver",   "nutrition", "cutlery",      "30 разных продуктов в журнале",            (c) => nut(c).distinctFoods >= 30),
  A("days30",    "Летописец Стола",   "gold",     "nutrition", "notebook",     "30 дней с записями питания",               (c) => nut(c).daysLogged >= 30),

  /* ---------- Баффы: арсенал добавок ---------- */
  A("buff1",     "Первый Глоток",     "bronze",   "buffs", "potion",    "Отметить первый приём баффа",                    (c) => buffs(c).takenTotal >= 1),
  A("buffday",   "Полный Арсенал",    "bronze",   "buffs", "checklist", "Принять все баффы дня по расписанию",            (c) => buffs(c).fullDays >= 1),
  A("buff7",     "Неделя Алхимии",    "silver",   "buffs", "flask",     "7 дней полного приёма",                          (c) => buffs(c).fullDays >= 7),
  A("buff30",    "Месяц Алхимии",     "gold",     "buffs", "vial",      "30 дней полного приёма",                         (c) => buffs(c).fullDays >= 30),
  A("custom",    "Свой Рецепт",       "bronze",   "buffs", "herbs",     "Добавить собственный бафф",                      (c) => buffs(c).customCount >= 1),
  A("sips100",   "Сто Глотков",       "silver",   "buffs", "chalice",   "100 отмеченных приёмов",                         (c) => buffs(c).takenTotal >= 100),

  /* ---------- Хроники: сохранение прогресса ---------- */
  A("export1",   "Хранитель Хроник",  "bronze",   "chronicle", "save",    "Сделать экспорт журнала в JSON",               (c) => (c.meta && c.meta.exports) >= 1),
  A("import1",   "Возрождённые Хроники","silver", "chronicle", "archive", "Восстановить журнал из файла",                 (c) => (c.meta && c.meta.imports) >= 1),

  /* ---------- Судьба: редкие случайные дары после квеста ---------- */
  R("fate_grace", "Благодать Древа",     "bronze",  "fate", "sun",         "Редкий дар судьбы после квеста (≈6%)",        (c) => fate(c, 0.06)),
  R("fate_rune",  "Дар Рун",             "silver",  "fate", "rune-stone",  "Редкий дар судьбы после квеста (≈3%)",        (c) => fate(c, 0.03)),
  R("fate_moon",  "Лунное Благословение","gold",    "fate", "moon",        "Редкий дар судьбы после квеста (≈1,5%)",      (c) => fate(c, 0.015)),
  R("fate_titan", "Кровь Титанов",       "diamond", "fate", "thor-hammer", "Редкий дар судьбы после квеста (≈0,7%)",      (c) => fate(c, 0.007)),
  R("fate_dragon","Взгляд Дракона",      "emerald", "fate", "dragon-head", "Легендарный дар судьбы (≈0,3%)",              (c) => fate(c, 0.003)),
];

export const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

/**
 * Оценить достижения.
 * @param ctx      контекст (см. buildAchievementCtx в app.js); ctx.event.type — что произошло
 * @param earned   { id: { count, first, last } } — уже полученные (не мутируется)
 * @param date     ISO-дата получения
 * @returns { earned: новый объект, unlocked: [{ ach, count, isNew }] }
 */
export function evaluate(ctx, earned = {}, date = "") {
  const next = Object.assign({}, earned);
  const unlocked = [];
  const evType = ctx.event && ctx.event.type;
  for (const a of ACHIEVEMENTS) {
    const have = next[a.id];
    if (a.repeat) {
      if (a.when !== evType) continue;           // повторяемые — только по своему событию
    } else if (have) continue;                   // уникальные — один раз
    let ok = false;
    try { ok = !!a.test(ctx); } catch (e) { ok = false; }
    if (!ok) continue;
    const count = (have ? have.count : 0) + 1;
    next[a.id] = { count, first: have ? have.first : date, last: date };
    unlocked.push({ ach: a, count, isNew: !have });
  }
  return { earned: next, unlocked };
}

/** Перенос старых «статусов» (S.statuses) в новый формат — старые id → новые, повторы в счётчик. */
const LEGACY_MAP = {
  pr: "pr", flawless: "flawless", overkill: "overkill", ironmountain: "iron8", firstblood: "firstblood",
  awakened: "awakened", grindveteran: "grind10", relentless: "week3",
  grace: "fate_grace", runegift: "fate_rune", moonblessed: "fate_moon", titanblood: "fate_titan",
  emberlord: "fate_grace", tealtide: "fate_grace", grindsoul: "fate_grace", loothunter: "fate_rune",
  berserk: "fate_grace", ironwill: "fate_grace", phantom: "fate_grace", sage: "fate_rune",
};
export function migrateLegacyStatuses(statuses) {
  const out = {};
  for (const st of statuses || []) {
    const id = LEGACY_MAP[st.id];
    if (!id || !ACH_BY_ID[id]) continue;
    const a = ACH_BY_ID[id];
    const cur = out[id];
    const d = st.date || "";
    if (!cur) out[id] = { count: 1, first: d, last: d };
    else if (a.repeat) { cur.count += 1; if (d && (!cur.first || d < cur.first)) cur.first = d; if (d > cur.last) cur.last = d; }
  }
  return out;
}

/** Сводка: сколько получено по рангам и всего. */
export function summary(earned) {
  const byTier = Object.fromEntries(TIER_ORDER.map((t) => [t, 0]));
  let total = 0;
  for (const a of ACHIEVEMENTS) if (earned[a.id]) { byTier[a.tier]++; total++; }
  return { total, of: ACHIEVEMENTS.length, byTier };
}
