// Две темы оформления: одно приложение, два языка подачи.
//
// «Сага» — исходная: тёмное фэнтези, золото по чёрному, засечный шрифт,
// иконки game-icons.net, квесты и боссы.
// «Чистая» — спокойный тёмно-синий интерфейс без игровой мишуры: чёрный,
// тёмно-синий, голубой, белый; гротеск, штриховые иконки Lucide и обычные
// человеческие слова. Так приложение можно открыть при коллегах в зале.
//
// Тема — это три слоя, и все три живут здесь:
//   1. цвет и типографика  → css/theme-plain.css по атрибуту data-theme
//   2. набор иконок        → iconSet: "game" | "line"
//   3. словарь             → LEX: квест/тренировка, босс/название и т.д.
// Всё остальное приложение темы не знает и знать не должно.

export const THEMES = {
  saga: {
    id: "saga", name: "Сага", iconSet: "game",
    note: "Тёмное фэнтези: золото по чёрному, гербы, квесты и боссы",
    color: "#06090b", swatch: ["#06090b", "#0e181b", "#c9a961", "#e9e6da"],
  },
  plain: {
    id: "plain", name: "Чистая", iconSet: "line",
    note: "Спокойный тёмно-синий интерфейс: обычные слова, штриховые иконки",
    color: "#080b11", swatch: ["#080b11", "#131c2b", "#38bdf8", "#e8eef7"],
  },
};
export const THEME_ORDER = ["saga", "plain"];
export const DEFAULT_THEME = "saga";
export const themeOf = (id) => THEMES[id] || THEMES[DEFAULT_THEME];

/* ---------- словарь ----------
   Слева — ключ, справа — как это называется в каждой теме. Ключей немного
   намеренно: переводим не весь текст, а то, что бросается в глаза и делает
   интерфейс игровым — названия разделов, сущностей и вердиктов. */
const SAGA = {
  tabHero: "Персонаж", tabQuests: "Квесты", tabBuffs: "Баффы",
  tabFood: "Ресурсы", tabLog: "Хроники",

  quest: "квест", questA: "квеста", questMany: "квестов",
  Quest: "Квест", quests: "Квесты", lastQuest: "Прошлый квест",
  questOne: "Завершить квест", questEmpty: "Квест пуст: запиши хотя бы один подход.",
  questAbout: "О квесте", questStart: "Выбрать стартовый квест",
  nextQuest: "следующий", firstQuest: "первый квест",

  pool: "Арсенал движений", poolAbout: "Об арсенале",
  lifts: "Арсенал героя · расчётный 1ПМ",
  bodyweight: "Вес героя",
  awards: "Знаки отличия", awardsAll: "Все знаки", awardsEmpty:
    "Пока пусто. Бей рекорды, закрывай нормативы и перевыполняй квесты — знаки придут сами.",
  saga: "сага",
  heroEyebrow: "SOLO WIN · прокачка персонажа",
  heroNovice: "«гринд только начинается»",
  doneCount: "квестов пройдено",
  classLbl: "Класс", classSub: "Подкласс", classHint: "качай характеристики — и откроется класс",

  vGold: "Квест покорён", vGoldSub: "Руны силы легли в твою пользу. Герой стал крепче.",
  vMid: "Достойно, но не всё", vMidSub: "Враг отступил, но ушёл живым. В следующий раз — до конца.",
  vBack: "Вернуться к квестам",
  vFail: "Слабый натиск", vFailSub: "Клинок едва задел цель. Хроники помнят всё.",

  ration: "паёк", nGold: "Паёк собран", nMid: "Припасы копятся", nFail: "Кладовая пуста",
  buff: "бафф", buffNew: "Новый бафф", buffEdit: "Правка баффа", buffOff: "Снять бафф",
  buffDue: "Проверить баффы!", buffOk: "Арсенал сверен", buffNever: "Арсенал ещё не сверялся.",
  buffsNote: "Приём по расписанию, запасы и арсенал. Только натуральное и легальное.",
  buffAdd: "+ Добавить свой бафф",
  logNote: "Хроники прокачки: рабочие веса, которые движок ведёт из квеста в квест.",
  logEmptyW: "Пока пусто. Первый квест впишет сюда рабочие веса.",
  logEmptyR: "Пока пусто. Первый квест впишет сюда строку.",
  logLast: "Последние квесты", logEmpty: "Летопись чиста, странник.",
  foodEmpty: "Провизии пока нет. Найди продукт и добавь порцию.", dayTip: "1",
  achNew: "Новый знак", achAgain: "Снова",
  helpHeavy: "квест с максимальной базой — ставь его на свежие ноги",
  helpStart: "кнопка в шапке включает выбор стартового квеста, если круг начинаешь не с первого",
  helpFeel: "состояние перед квестом",
  helpFocus: "на какую группу в этом квесте приходится больше всего подходов",
  helpDeload: "те же квесты и то же число подходов",
  cycleNote: "квесты",
  helpFeelTail: "Движок помнит, в каком состоянии закрыт квест, и не считает тяжёлый день откатом силовых",
  stockHead: "Арсенал", stockHint: "«+» — активировать. Доза правится по ✎ в «Запасах».",
  programNote: "",   // в «Саге» берётся описание из самой программы
};
const PLAIN = {
  tabHero: "Профиль", tabQuests: "Тренировки", tabBuffs: "Добавки",
  tabFood: "Питание", tabLog: "Прогресс",

  quest: "тренировка", questA: "тренировки", questMany: "тренировок",
  Quest: "Тренировка", quests: "Тренировки", lastQuest: "Прошлая тренировка",
  questOne: "Завершить тренировку", questEmpty: "Пусто: запиши хотя бы один подход.",
  questAbout: "О тренировке", questStart: "С какой тренировки начать цикл",
  nextQuest: "по плану", firstQuest: "первую тренировку",

  pool: "Каталог упражнений", poolAbout: "О каталоге",
  lifts: "Базовые движения · расчётный 1ПМ",
  bodyweight: "Собственный вес",
  awards: "Достижения", awardsAll: "Все достижения", awardsEmpty:
    "Пока пусто. Достижения появятся сами — за рекорды, регулярность и закрытые тренировки.",
  saga: "блок",
  heroEyebrow: "BODY UPGRADE · силовой прогресс",
  heroNovice: "первый цикл",
  doneCount: "тренировок закрыто",
  classLbl: "Уровень подготовки", classSub: "Профиль", classHint: "закрой первые тренировки — характеристики наберутся сами",

  vGold: "Отработано", vGoldSub: "План закрыт полностью. Так и держи.",
  vMid: "Почти", vMidSub: "Основное сделано, но до плана не дотянул.",
  vBack: "К тренировкам",
  vFail: "Недоработка", vFailSub: "Больше половины плана осталось на полу.",

  ration: "рацион", nGold: "Норма закрыта", nMid: "Набирается", nFail: "Почти ничего",
  buff: "добавка", buffNew: "Новая добавка", buffEdit: "Правка добавки", buffOff: "Убрать добавку",
  buffDue: "Пора проверить добавки", buffOk: "Список сверен", buffNever: "Список ещё не сверялся.",
  buffsNote: "",   // в «Чистой» подпись к разделу не нужна: название вкладки и так всё говорит
  buffAdd: "+ Добавить свою добавку",
  logNote: "",
  logEmptyW: "Пока пусто. Первая тренировка впишет сюда рабочие веса.",
  logEmptyR: "",
  logLast: "Последние тренировки", logEmpty: "Записей пока нет.",
  foodEmpty: "Пока ничего не добавлено.", dayTip: "",
  achNew: "Новое достижение", achAgain: "Снова",
  helpHeavy: "тренировка с максимальной базой — ставь её на свежие ноги",
  helpStart: "кнопка в шапке включает выбор стартовой тренировки, если цикл начинаешь не с первой",
  helpFeel: "состояние перед тренировкой",
  helpFocus: "на какую группу в этой тренировке приходится больше всего подходов",
  helpDeload: "те же тренировки и то же число подходов",
  cycleNote: "тренировки",
  helpFeelTail: "Движок помнит, в каком состоянии закрыта тренировка, и не считает тяжёлый день откатом силовых",
  stockHead: "Каталог добавок", stockHint: "",
  programNote: "Сплит Верх / Низ / Фулбоди-добор: каждая мышечная группа получает два активных дня в неделю, по 2–3 упражнения за день. Недели 1 и 3 — верх и низ силовые, фулбоди объёмный; недели 2 и 4 — наоборот, так что каждая группа каждую неделю видит и тяжёлую, и объёмную работу. Недели 3–4 идут на втором наборе движений: вспомогательные заменяются вариантами, движение дня меняется на родственное (присед со штангой → фронтальный). Пятая неделя — разгрузка: те же тренировки и то же число подходов, но вес −15%, чтобы снять накопленную усталость до того, как она превратится в застой.",
};
const LEX = { saga: SAGA, plain: PLAIN };

/* ---------- английский ----------
   Английский словарь «Чистой» — полный: им пользуются и меню, и профиль.
   У «Саги» по-английски свои только игровые слова; остальное берётся из «Чистой». */
const PLAIN_EN = {
  tabHero: "Profile", tabQuests: "Workouts", tabBuffs: "Supplements",
  tabFood: "Nutrition", tabLog: "Progress",

  quest: "workout", questA: "workouts", questMany: "workouts",
  Quest: "Workout", quests: "Workouts", lastQuest: "Last workout",
  questOne: "Finish workout", questEmpty: "Empty: log at least one set.",
  questAbout: "About the workout", questStart: "Which workout starts the cycle",
  nextQuest: "planned", firstQuest: "the first workout",

  pool: "Exercise catalog", poolAbout: "About the catalog",
  lifts: "Main lifts · estimated 1RM",
  bodyweight: "Bodyweight",
  awards: "Achievements", awardsAll: "All achievements", awardsEmpty:
    "Nothing yet. Achievements arrive on their own — for records, consistency and completed workouts.",
  saga: "block",
  heroEyebrow: "BODY UPGRADE · strength progress",
  heroNovice: "first cycle",
  doneCount: "workouts done",
  classLbl: "Training level", classSub: "Profile", classHint: "finish your first workouts — the stats will fill in",

  vGold: "Done", vGoldSub: "The plan is fully complete. Keep it up.",
  vMid: "Almost", vMidSub: "The main work is done, but the plan is not complete.",
  vBack: "To workouts",
  vFail: "Short", vFailSub: "More than half of the plan was left on the floor.",

  ration: "diet", nGold: "Target reached", nMid: "Building up", nFail: "Almost nothing",
  buff: "supplement", buffNew: "New supplement", buffEdit: "Edit supplement", buffOff: "Remove supplement",
  buffDue: "Time to check supplements", buffOk: "List checked", buffNever: "The list has not been checked yet.",
  buffsNote: "",
  buffAdd: "+ Add your own supplement",
  logNote: "",
  logEmptyW: "Nothing yet. Your first workout will add working weights here.",
  logEmptyR: "",
  logLast: "Recent workouts", logEmpty: "No entries yet.",
  foodEmpty: "Nothing added yet.", dayTip: "",
  achNew: "New achievement", achAgain: "Again",
  helpHeavy: "the heaviest workout — do it on fresh legs",
  helpStart: "the header button picks the starting workout if you don't begin the cycle with the first one",
  helpFeel: "how you feel before the workout",
  helpFocus: "which muscle group gets the most sets in this workout",
  helpDeload: "same workouts and the same number of sets",
  cycleNote: "workouts",
  helpFeelTail: "The engine remembers how you felt and does not count a hard day as a strength drop",
  stockHead: "Supplement catalog", stockHint: "",
  programNote: "",
};
const SAGA_EN = {
  tabHero: "Hero", tabQuests: "Quests", tabBuffs: "Buffs", tabFood: "Supplies", tabLog: "Chronicles",
  quest: "quest", questA: "quests", questMany: "quests", Quest: "Quest", quests: "Quests", lastQuest: "Last quest",
  pool: "Arsenal", awards: "Insignia", awardsAll: "All insignia", heroEyebrow: "SOLO WIN · level up your hero",
  doneCount: "quests cleared", classLbl: "Class", classSub: "Subclass", buff: "buff",
};
const LEX_EN = { saga: SAGA_EN, plain: PLAIN_EN };

/** Слово по ключу в заданной теме и языке. Неизвестный ключ возвращается как есть —
 *  это видно на экране и чинится за минуту, а не падает приложением. */
export const say = (theme, key, lang = "ru") => {
  if (lang === "en") {
    const e = LEX_EN[theme] || SAGA_EN;
    if (e[key] != null) return e[key];
    if (PLAIN_EN[key] != null && PLAIN_EN[key] !== "") return PLAIN_EN[key];
  }
  const d = LEX[theme] || SAGA;
  return d[key] != null ? d[key] : (SAGA[key] != null ? SAGA[key] : key);
};
export { PLAIN_EN };

/** Все ключи словаря — нужно тестам: ни один не должен потеряться в теме. */
export const LEX_KEYS = Object.keys(SAGA);
export { LEX };
