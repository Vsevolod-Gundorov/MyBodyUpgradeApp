// Язык интерфейса: русский и английский. Чистые данные, без DOM и состояния.
//
// Слова, которые зависят от темы (квест / тренировка), живут в data/theme.js —
// там у каждой темы свой английский словарь. Здесь — всё остальное:
// профиль, настройки, блок питания, названия целей и программ.
// Ключа нет в английском — показывается русский: это видно на экране
// и чинится за минуту, а не ломает приложение. Тест следит, чтобы ключи совпадали.

export const LANGS = { ru: "Русский", en: "English" };
export const LANG_ORDER = ["ru", "en"];
export const DEFAULT_LANG = "ru";

const RU = {
  athlete: "Атлет",
  editProfile: "Изменить профиль",
  openSettings: "Настройки",
  myData: "Мои данные",
  weight: "Вес",
  body: "Рост, возраст, пол",
  goal: "Цель",
  food: "Питание",
  experience: "Опыт в зале",
  cm: "см", kg: "кг", years: "лет",
  fillProfile: "Заполните профиль",
  fillProfileSub: "Нормы питания и стартовые веса посчитаются под вас.",
  fill: "Заполнить",

  // блок питания в профиле
  nutTitle: "Питание",
  nutEdit: "Изменить нормы",
  nutOpen: "Открыть питание",
  dayTraining: "Тренировка",
  dayRest: "Отдых",
  today: "сегодня",
  kcal: "ккал",
  protein: "Белки", fat: "Жиры", carbs: "Углеводы",
  proteinShort: "Б", fatShort: "Ж", carbsShort: "У",
  g: "г",
  manualNorms: "Нормы заданы вручную",
  all: "Все",

  // настройки
  settings: "Настройки",
  back: "Назад",
  look: "Оформление",
  screen: "Экран",
  brightness: "Яркость",
  uiSize: "Размер текста и иконок",
  sizeS: "Мелкий", sizeM: "Обычный", sizeL: "Крупный", sizeXL: "Огромный",
  language: "Язык",
  langBeta: "Английский пока переведён частично: профиль, настройки и меню.",
  sound: "Звук и отклик",
  uiSound: "Звук интерфейса",
  volume: "Громкость уведомлений",
  volumeTest: "Проверить",
  haptics: "Вибро-отдача",
  data: "Данные",
  offSearch: "Поиск продуктов в открытой базе",
  reminders: "Напоминания в Telegram",
  remindersOff: "Работают в приложении, открытом из Telegram: пишет бот.",
  remindRest: "Уведомления о начале подхода",
  remindSupp: "Напоминания о приеме добавок",
  account: "Аккаунт Telegram",
  syncing: "синхронизация…",
  syncNow: "Синхронизировать сейчас",
  syncServer: "Журнал хранится на сервере, копия — в облаке Telegram.",
  syncCloud: "Журнал привязан к этому аккаунту и сам уезжает в облако Telegram: открой приложение с другого телефона — прогресс будет там же.",
  hero: "Герой",
  // статус синхронизации
  st_idle: "ожидает", st_saving: "сохраняю…", st_saved: "синхронизировано", st_off: "только на устройстве",
  st_error: "ошибка облака", st_serverError: "ошибка сервера", st_offline: "нет сети · сохранено здесь",
  st_denied: "нет доступа к серверу", st_expired: "переоткройте приложение", st_full: "сервер занят · журнал здесь",
};

const EN = {
  athlete: "Athlete",
  editProfile: "Edit profile",
  openSettings: "Settings",
  myData: "My data",
  weight: "Weight",
  body: "Height, age, sex",
  goal: "Goal",
  food: "Nutrition",
  experience: "Gym experience",
  cm: "cm", kg: "kg", years: "y.o.",
  fillProfile: "Complete your profile",
  fillProfileSub: "Nutrition targets and starting weights will be tailored to you.",
  fill: "Complete",

  nutTitle: "Nutrition",
  nutEdit: "Edit targets",
  nutOpen: "Open nutrition",
  dayTraining: "Training",
  dayRest: "Rest",
  today: "today",
  kcal: "kcal",
  protein: "Protein", fat: "Fat", carbs: "Carbs",
  proteinShort: "P", fatShort: "F", carbsShort: "C",
  g: "g",
  manualNorms: "Targets set manually",
  all: "All",

  settings: "Settings",
  back: "Back",
  look: "Appearance",
  screen: "Display",
  brightness: "Brightness",
  uiSize: "Text and icon size",
  sizeS: "Small", sizeM: "Default", sizeL: "Large", sizeXL: "Huge",
  language: "Language",
  langBeta: "English is partial for now: profile, settings and menus.",
  sound: "Sound and feedback",
  uiSound: "Interface sounds",
  volume: "Notification volume",
  volumeTest: "Test",
  haptics: "Haptics",
  data: "Data",
  offSearch: "Search the open food database",
  reminders: "Telegram reminders",
  remindersOff: "Work when the app is opened from Telegram: the bot sends them.",
  remindRest: "Next set notifications",
  remindSupp: "Supplement reminders",
  account: "Telegram account",
  syncing: "syncing…",
  syncNow: "Sync now",
  syncServer: "Your log is stored on the server, with a copy in Telegram cloud.",
  syncCloud: "Your log is tied to this account and saved to Telegram cloud: open the app on another phone and your progress will be there.",
  hero: "Hero",
  st_idle: "waiting", st_saving: "saving…", st_saved: "synced", st_off: "this device only",
  st_error: "cloud error", st_serverError: "server error", st_offline: "offline · saved here",
  st_denied: "no server access", st_expired: "reopen the app", st_full: "server busy · log kept here",
};

export const DICT = { ru: RU, en: EN };

/** Слово по ключу на языке. Неизвестный язык — русский; нет перевода — русский; нет ключа — сам ключ. */
export function tr(lang, key) {
  const d = DICT[lang] || RU;
  return d[key] != null ? d[key] : (RU[key] != null ? RU[key] : key);
}

/* Названия из профиля — цели, программы питания, образ жизни, опыт, пол.
   Русские названия живут в data/profile.js, здесь — английские. */
export const ENUM_EN = {
  direction: { cut: "Lose weight", maintain: "Maintain", recomp: "Recomposition", bulk: "Gain mass" },
  pace: { slow: "gentle", normal: "optimal", fast: "fast" },
  program: { balanced: "Balanced", protein: "High protein", lowcarb: "Low carb", keto: "Keto", custom: "Custom" },
  activity: { sedentary: "sedentary", light: "lightly active", moderate: "active", active: "very active" },
  experience: { novice: "Novice", beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" },
  sex: { m: "male", f: "female" },
};

/** Тема оформления по-английски. */
export const THEME_EN = {
  saga: { name: "Saga", note: "Dark fantasy: gold on black, crests, quests and bosses" },
  plain: { name: "Clean", note: "Calm dark blue interface: plain words, line icons" },
};
