import { PROGRAM, BASELINES, LIFT_NAMES } from "../data/program.js";
import { NUTRITION, FOODS, FOOD_CATS, WATER_TARGET_ML, offSearch, estimateFiber } from "../data/nutrition.js";
import { GAME_ICONS } from "../data/icons.js";

/* ================= иконки (game-icons.net, CC BY 3.0; fill = currentColor) ================= */
const ICONS = Object.assign({}, GAME_ICONS);
// алиасы под имена, которые используются по приложению
const alias = (a, b) => { if (GAME_ICONS[b]) ICONS[a] = GAME_ICONS[b]; };
alias("hammer", "muscle");
alias("bolt", "lightning");
alias("layers", "weight");
alias("heart", "endurance");
alias("drumstick", "meat");
alias("apple", "meat");
const icon = (name, cls = "") => {
  const g = ICONS[name];
  return g ? `<svg class="ico ${cls}" viewBox="${g.vb}" aria-hidden="true">${g.inner}</svg>` : "";
};
// какая иконка у какой характеристики + свой цвет шкалы и акцент
const STAT_ICONS = { СИЛА: "hammer", МОЩЬ: "bolt", ВЫНОСЛ: "flame", ОБЪЁМ: "layers", ДИСЦИПЛ: "shield", СТОЙКОСТЬ: "gem" };
const STAT_GRAD = {
  СИЛА: "linear-gradient(90deg,#8f3030,#cf5a4a,#ec8a72)",       // багрянец
  МОЩЬ: "linear-gradient(90deg,#5a3f8f,#8a6bcf,#b49ae8)",       // фиолет
  ВЫНОСЛ: "linear-gradient(90deg,#b5732f,#e0a24a,#f3c66e)",     // янтарь
  ОБЪЁМ: "linear-gradient(90deg,#2f7d7a,#4fb0aa,#8fd8d0)",      // бирюза
  ДИСЦИПЛ: "linear-gradient(90deg,#2f5a8f,#4f86c0,#8fb6e0)",    // синь
  СТОЙКОСТЬ: "linear-gradient(90deg,#5c7d3f,#8fb15e,#c0dd92)",  // зелень
};
const STAT_ACCENT = { СИЛА: "#e07a5f", МОЩЬ: "#a98be0", ВЫНОСЛ: "#e0a24a", ОБЪЁМ: "#5fc0b8", ДИСЦИПЛ: "#6fa0dc", СТОЙКОСТЬ: "#9fc46e" };

/* ================= баффы: арсенал натурального атлета ================= */
// Только легальные, натуральные добавки. dose = число, unit = единица, times = слоты приёма.
const BUFF_CATS = ["Сила и мощь", "Пампинг и выносливость", "Белок и рост", "Восстановление и здоровье"];
const BUFF_SLOTS = ["Утро", "День", "До трен.", "После трен.", "Вечер", "Перед сном"];
const BUFFS = [
  { id: "creatine",  name: "Эликсир Силы",        real: "Креатин моногидрат",   icon: "flask",   dose: 5,   unit: "г",  cat: "Сила и мощь", times: ["Утро"], effect: "АТФ, сила, объём мышц", hint: "можно в любое время — важно принимать каждый день" },
  { id: "betaala",   name: "Ярость Карнозина",    real: "Бета-аланин",          icon: "flame",   dose: 4,   unit: "г",  cat: "Сила и мощь", times: ["До трен."], effect: "буфер кислоты, многоповтор", hint: "лёгкое покалывание кожи — это норма" },
  { id: "caffeine",  name: "Искра Ярости",        real: "Кофеин",               icon: "bolt",    dose: 150, unit: "мг", cat: "Сила и мощь", times: ["До трен."], effect: "фокус, сила, бодрость", hint: "не позже, чем за 6–8 ч до сна" },
  { id: "arginine",  name: "Дыхание Пампа",       real: "L-Аргинин",            icon: "droplet", dose: 7,   unit: "г",  cat: "Пампинг и выносливость", times: ["До трен."], effect: "оксид азота, пампинг", hint: "за 40–60 мин до тренировки" },
  { id: "citrulline",name: "Кровь Титана",        real: "Цитруллин малат",      icon: "heart",   dose: 6,   unit: "г",  cat: "Пампинг и выносливость", times: ["До трен."], effect: "кровоток, выносливость, пампинг", hint: "за 40–60 мин до тренировки" },
  { id: "electro",   name: "Соли Странника",      real: "Электролиты (Na/K)",   icon: "potion",  dose: 1,   unit: "порция", cat: "Пампинг и выносливость", times: ["До трен.", "После трен."], effect: "гидратация, судороги", hint: "в жару и на дефиците — больше" },
  { id: "whey",      name: "Нектар Роста",        real: "Сывороточный протеин", icon: "flask",   dose: 30,  unit: "г",  cat: "Белок и рост", times: ["После трен."], effect: "белок, синтез мышц", hint: "" },
  { id: "omega3",    name: "Масло Левиафана",     real: "Омега-3 (рыбий жир)",  icon: "droplet", dose: 2,   unit: "г",  cat: "Восстановление и здоровье", times: ["Утро"], effect: "суставы, сердце, восстановление", hint: "с едой, содержащей жир" },
  { id: "vitd",      name: "Свет Солнца",         real: "Витамин D3",           icon: "sun",     dose: 3000,unit: "МЕ", cat: "Восстановление и здоровье", times: ["Утро"], effect: "гормоны, кости, иммунитет", hint: "с жирной едой; хорошо в паре с K2" },
  { id: "mag",       name: "Камень Покоя",        real: "Магний (глицинат)",    icon: "moon",    dose: 350, unit: "мг", cat: "Восстановление и здоровье", times: ["Перед сном"], effect: "сон, мышцы, нервы", hint: "вечером; отдельно от кальция и цинка" },
  { id: "zinc",      name: "Печать Тестостерона", real: "Цинк",                 icon: "gem",     dose: 25,  unit: "мг", cat: "Восстановление и здоровье", times: ["Перед сном"], effect: "гормоны, иммунитет", hint: "отдельно от кальция, магния и железа" },
  { id: "vitc",      name: "Щит Аскорбия",        real: "Витамин C",            icon: "shield",  dose: 1000,unit: "мг", cat: "Восстановление и здоровье", times: ["Утро"], effect: "антиоксидант, иммунитет", hint: "" },
  { id: "multi",     name: "Венец Изобилия",      real: "Мультивитамины",       icon: "capsule", dose: 1,   unit: "порция", cat: "Восстановление и здоровье", times: ["Утро"], effect: "база микронутриентов", hint: "с едой" },
  { id: "ashwa",     name: "Корень Спокойствия",  real: "Ашваганда",            icon: "leaf",    dose: 500, unit: "мг", cat: "Восстановление и здоровье", times: ["Вечер"], effect: "кортизол, стресс, сон", hint: "курсами; хорошо перед сном при стрессе" },
];
const BUFF_BY_ID = Object.fromEntries(BUFFS.map((b) => [b.id, b]));
const BUFF_CHECK_DAYS = 30; // раз в месяц — напоминание «Проверить баффы!»
const LOW_STOCK_DAYS = 10;  // предупреждать, когда запаса ≤ стольких дней
// все баффы = встроенные + пользовательские
const allBuffs = () => [...BUFFS, ...((S.buffs && S.buffs.custom) || [])];
const buffById = (id) => allBuffs().find((b) => b.id === id);

/* --- авто-подбор фэнтезийного имени/иконки/единиц по реальному названию добавки --- */
const SUPP_DB = [
  { k: /креатин|creatine/i, name: "Эликсир Силы", icon: "flask", unit: "г", cat: "Сила и мощь", effect: "АТФ, сила, объём мышц", times: ["Утро"] },
  { k: /бета.?аланин|beta.?alanine/i, name: "Ярость Карнозина", icon: "flame", unit: "г", cat: "Сила и мощь", effect: "буфер кислоты, многоповтор", times: ["До трен."] },
  { k: /кофеин|caffeine/i, name: "Искра Ярости", icon: "bolt", unit: "мг", cat: "Сила и мощь", effect: "фокус, бодрость", times: ["До трен."], hint: "не позже, чем за 6–8 ч до сна" },
  { k: /гуарана|guarana/i, name: "Дикий Огонь", icon: "flame", unit: "мг", cat: "Сила и мощь", effect: "энергия, фокус", times: ["До трен."] },
  { k: /предтрен|pre.?workout/i, name: "Зелье Берсерка", icon: "potion", unit: "порция", cat: "Сила и мощь", effect: "энергия, пампинг, фокус", times: ["До трен."] },
  { k: /аргинин|arginine/i, name: "Дыхание Пампа", icon: "droplet", unit: "г", cat: "Пампинг и выносливость", effect: "оксид азота, пампинг", times: ["До трен."] },
  { k: /цитруллин|citrulline/i, name: "Кровь Титана", icon: "heart", unit: "г", cat: "Пампинг и выносливость", effect: "кровоток, выносливость", times: ["До трен."] },
  { k: /таурин|taurine/i, name: "Тень Тавра", icon: "bolt", unit: "г", cat: "Пампинг и выносливость", effect: "фокус, выносливость", times: ["До трен."] },
  { k: /карнитин|carnitine/i, name: "Пламя Жиролома", icon: "flame", unit: "г", cat: "Пампинг и выносливость", effect: "жирообмен, энергия", times: ["Утро"] },
  { k: /электролит|electrolyte|солев|regidron/i, name: "Соли Странника", icon: "potion", unit: "порция", cat: "Пампинг и выносливость", effect: "гидратация, судороги", times: ["До трен."] },
  { k: /сыворот|whey|изолят|isolate/i, name: "Нектар Роста", icon: "flask", unit: "г", cat: "Белок и рост", effect: "белок, синтез мышц", times: ["После трен."] },
  { k: /казеин|casein/i, name: "Ночной Нектар", icon: "moon", unit: "г", cat: "Белок и рост", effect: "медленный белок на ночь", times: ["Перед сном"] },
  { k: /гейнер|gainer/i, name: "Пир Исполина", icon: "wheat", unit: "порция", cat: "Белок и рост", effect: "калории, масса", times: ["После трен."] },
  { k: /bcaa|бцаа|eaa|эаа|аминокисл|amino/i, name: "Осколки Силы", icon: "gem", unit: "г", cat: "Белок и рост", effect: "аминокислоты, восстановление", times: ["До трен."] },
  { k: /глютамин|glutamine/i, name: "Щит Кишечника", icon: "shield", unit: "г", cat: "Белок и рост", effect: "восстановление, ЖКТ", times: ["Перед сном"] },
  { k: /коллаген|collagen/i, name: "Связь Сухожилий", icon: "gem", unit: "г", cat: "Восстановление и здоровье", effect: "суставы, связки, кожа", times: ["Утро"] },
  { k: /омега|omega|рыб.?и?й?\s?жир|fish.?oil/i, name: "Масло Левиафана", icon: "droplet", unit: "г", cat: "Восстановление и здоровье", effect: "суставы, сердце, восстановление", times: ["Утро"], hint: "с едой, содержащей жир" },
  { k: /витамин\s?d|vitamin\s?d|\bd3\b/i, name: "Свет Солнца", icon: "sun", unit: "МЕ", cat: "Восстановление и здоровье", effect: "гормоны, кости, иммунитет", times: ["Утро"], hint: "с жирной едой" },
  { k: /магни|magnesium/i, name: "Камень Покоя", icon: "moon", unit: "мг", cat: "Восстановление и здоровье", effect: "сон, мышцы, нервы", times: ["Перед сном"], hint: "отдельно от кальция и цинка" },
  { k: /цинк|zinc/i, name: "Печать Тестостерона", icon: "gem", unit: "мг", cat: "Восстановление и здоровье", effect: "гормоны, иммунитет", times: ["Перед сном"], hint: "отдельно от кальция, магния и железа" },
  { k: /витамин\s?c|vitamin\s?c|аскорб/i, name: "Щит Аскорбия", icon: "shield", unit: "мг", cat: "Восстановление и здоровье", effect: "антиоксидант, иммунитет", times: ["Утро"] },
  { k: /мультивитам|multivit|витаминн.?\s?комплекс/i, name: "Венец Изобилия", icon: "capsule", unit: "порция", cat: "Восстановление и здоровье", effect: "база микронутриентов", times: ["Утро"], hint: "с едой" },
  { k: /ашваганд|ashwagandha/i, name: "Корень Спокойствия", icon: "leaf", unit: "мг", cat: "Восстановление и здоровье", effect: "кортизол, стресс, сон", times: ["Вечер"] },
  { k: /мелатонин|melatonin/i, name: "Печать Снов", icon: "moon", unit: "мг", cat: "Восстановление и здоровье", effect: "сон, засыпание", times: ["Перед сном"], hint: "за 30–60 мин до сна" },
  { k: /родиол|rhodiola/i, name: "Хлад Вершин", icon: "leaf", unit: "мг", cat: "Восстановление и здоровье", effect: "стресс, выносливость", times: ["Утро"] },
  { k: /куркум|curcumin|turmeric/i, name: "Золотой Корень", icon: "leaf", unit: "мг", cat: "Восстановление и здоровье", effect: "противовоспалительное, суставы", times: ["Утро"] },
  { k: /железо|iron|ferr/i, name: "Кровь Руды", icon: "gem", unit: "мг", cat: "Восстановление и здоровье", effect: "кровь, энергия", times: ["Утро"], hint: "с витамином C; отдельно от кальция" },
  { k: /витамин\s?b|b12|b6|b.?комплекс/i, name: "Искры Жизни", icon: "bolt", unit: "мг", cat: "Восстановление и здоровье", effect: "энергия, нервы", times: ["Утро"] },
  { k: /глюкозамин|хондроитин|glucosamine|chondroitin|мсм|msm/i, name: "Смазка Суставов", icon: "shield", unit: "мг", cat: "Восстановление и здоровье", effect: "суставы, хрящи", times: ["Утро"] },
  { k: /пробиотик|probiotic|лактоба|бифидо/i, name: "Малый Легион", icon: "leaf", unit: "капс.", cat: "Восстановление и здоровье", effect: "микрофлора, ЖКТ", times: ["Утро"] },
  { k: /клетчатк|fiber|псиллиум|psyllium|отруб/i, name: "Нить Насыщения", icon: "wheat", unit: "г", cat: "Восстановление и здоровье", effect: "клетчатка, пищеварение", times: ["День"] },
  { k: /кальци|calcium/i, name: "Костяной Оплот", icon: "shield", unit: "мг", cat: "Восстановление и здоровье", effect: "кости, зубы", times: ["День"], hint: "отдельно от цинка, магния и железа" },
];
const NAME_POOLS = {
  "Сила и мощь": ["Гнев Молота", "Клык Зверя", "Молот Титана", "Рёв Берсерка", "Пламя Ярости"],
  "Пампинг и выносливость": ["Прилив Крови", "Ветер Степей", "Пульс Бури", "Река Силы", "Дыхание Ветра"],
  "Белок и рост": ["Дар Плоти", "Камень Роста", "Хлеб Исполина", "Зерно Силы", "Плоть Титана"],
  "Восстановление и здоровье": ["Роса Заката", "Тихий Родник", "Мшистый Оберег", "Печать Покоя", "Лунная Роса", "Оберег Хранителя"],
};
const CAT_ICON = { "Сила и мощь": "muscle", "Пампинг и выносливость": "droplet", "Белок и рост": "flask", "Восстановление и здоровье": "leaf" };
function guessCat(s) {
  if (/сон|мелатонин|стресс|кортизол|адаптоген|витамин|минерал|магни|цинк|железо|кальци|омега|сустав|иммунит|коллаген|антиоксид|пробиотик|d3|k2/i.test(s)) return "Восстановление и здоровье";
  if (/белок|протеин|амино|bcaa|eaa|казеин|гейнер|масса|рост|глютамин/i.test(s)) return "Белок и рост";
  if (/пампинг|оксид|азот|выносл|карнитин|электролит|цитруллин|аргинин|таурин/i.test(s)) return "Пампинг и выносливость";
  if (/сила|энерг|кофеин|предтрен|креатин|мощ|фокус|гуарана|бета.?аланин/i.test(s)) return "Сила и мощь";
  return "Восстановление и здоровье";
}
function guessUnit(s) {
  if (/витамин\s?d|vitamin\s?d|\bd3\b|k2/i.test(s)) return "МЕ";
  if (/мультивитам|multivit|гейнер|gainer|предтрен|pre.?workout|порош|комплекс/i.test(s)) return "порция";
  if (/капс|caps|таблет|tablet|пробиотик/i.test(s)) return "капс.";
  if (/\bмл\b|\bml\b|капл|сироп/i.test(s)) return "мл";
  if (/протеин|protein|креатин|creatine|глютамин|glutamine|bcaa|бцаа|eaa|эаа|цитруллин|аргинин|бета.?аланин|карнитин|carnitine|коллаген|collagen|таурин|taurine|клетчатк|fiber|омега|omega|масло|казеин/i.test(s)) return "г";
  return "мг";
}
// подобрать имя из пула, не занятое другими баффами (offset — для «другого облика»)
function pickPoolName(cat, offset = 0) {
  const pool = NAME_POOLS[cat] || NAME_POOLS["Восстановление и здоровье"];
  const used = new Set(allBuffs().map((b) => b.name));
  const free = pool.filter((n) => !used.has(n));
  const arr = free.length ? free : pool;
  return arr[offset % arr.length];
}
// по реальному названию → {name, icon, unit, cat, effect, times, hint}
function autoBuffFromReal(real, offset = 0) {
  const s = (real || "").trim();
  const hit = SUPP_DB.find((d) => d.k.test(s));
  if (hit) {
    let name = hit.name;
    // если такое имя уже есть (встроенный аналог) — берём альтернативу из пула
    if (allBuffs().some((b) => b.name === name) || offset > 0) name = pickPoolName(hit.cat, offset);
    return { name, icon: hit.icon, unit: hit.unit, cat: hit.cat, effect: hit.effect || "", times: hit.times || ["Утро"], hint: hit.hint || "" };
  }
  const cat = guessCat(s);
  return { name: pickPoolName(cat, offset), icon: CAT_ICON[cat] || "flask", unit: guessUnit(s), cat, effect: "", times: ["Утро"], hint: "" };
}
const doseStr = (b, val) => { const d = (val != null ? val : b.dose); return b.unit ? `${d} ${b.unit}` : `${d}`; };

/* ================= состояние (БД = localStorage + экспорт в JSON-файл) ================= */
const DB_KEY = "bodyupgrade.v1";

const defaultState = () => ({
  hero: { name: "Всеволод", title: "Одинокий Гриндер", bodyweight: 93 },
  xp: 0,
  sessions: [], // { id, workoutId, date, verdict, score, xp, entries: { exId: [{w, r}] } }
  drafts: {},   // workoutId -> entries (незавершённые)
  cycleStart: 0, // с какого квеста (индекс в ORDER) начинается цикл
  questStart: {}, // wid -> ts начала квеста (для таймера квеста)
  settings: { sound: true, haptics: true },
  buffs: {
    active: { creatine: 10, arginine: 7 }, // id -> доза (число; единица берётся из баффа)
    checkedAt: null,                        // ISO даты последней проверки арсенала
    custom: [],                             // свои баффы [{id,name,real,icon,dose,unit,effect,cat,times,hint}]
    stock: {},                              // id -> осталось порций (для учёта запаса)
    log: {},                                // "YYYY-MM-DD" -> { "id@slot": true } — что принято за день
  },
  nutrition: {
    log: {},        // date -> { dayType: "training"|"rest", items: [{n,g,k,p,f,cb,fb,src}], water: 0 }
    recent: [],     // недавно использованные продукты (макс. 12)
    foodStats: {},  // id -> { food, count, last } — для «частое + недавнее»
  },
  statuses: [],  // заработанные ситуационные статусы [{id,name,desc,icon,date}]
});

let S = load();
function load() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) || {};
      const base = defaultState();
      const S2 = Object.assign(base, parsed);
      // бережно достраиваем вложенные объекты: новые поля появляются,
      // но ничего сохранённого пользователем не стирается
      S2.hero = Object.assign({}, base.hero, parsed.hero);
      S2.buffs = Object.assign({}, base.buffs, parsed.buffs);
      if (parsed.buffs && parsed.buffs.active) S2.buffs.active = parsed.buffs.active;
      S2.buffs.custom = (parsed.buffs && Array.isArray(parsed.buffs.custom)) ? parsed.buffs.custom : [];
      S2.buffs.stock = (parsed.buffs && parsed.buffs.stock) || {};
      S2.buffs.log = (parsed.buffs && parsed.buffs.log) || {};
      // миграция: старые дозы-строки ("10 г") -> число
      Object.keys(S2.buffs.active).forEach((k) => {
        const v = S2.buffs.active[k];
        if (typeof v === "string") { const n = parseFloat(v.replace(",", ".")); S2.buffs.active[k] = isNaN(n) ? 1 : n; }
      });
      S2.nutrition = Object.assign({}, base.nutrition, parsed.nutrition);
      S2.nutrition.log = (parsed.nutrition && parsed.nutrition.log) || {};
      S2.nutrition.recent = (parsed.nutrition && parsed.nutrition.recent) || [];
      S2.nutrition.foodStats = (parsed.nutrition && parsed.nutrition.foodStats) || {};
      S2.statuses = Array.isArray(parsed.statuses) ? parsed.statuses : [];
      S2.settings = Object.assign({}, base.settings, parsed.settings);
      S2.cycleStart = Number.isInteger(parsed.cycleStart) ? parsed.cycleStart : 0;
      S2.questStart = (parsed.questStart && typeof parsed.questStart === "object") ? parsed.questStart : {};
      return S2;
    }
  } catch (e) { /* повреждённые данные — начинаем заново */ }
  return defaultState();
}
function save() { localStorage.setItem(DB_KEY, JSON.stringify(S)); }

/* ================= справочники ================= */
const WORKOUTS = {};
const WEEK_OF = {};
PROGRAM.weeks.forEach((wk) => wk.workouts.forEach((w) => { WORKOUTS[w.id] = w; WEEK_OF[w.id] = wk; }));
const ORDER = PROGRAM.weeks.flatMap((wk) => wk.workouts.map((w) => w.id));

const epley = (w, r) => (r >= 1 ? w * (1 + r / 30) : 0);
const fmt = (n) => (Math.round(n * 10) / 10).toString().replace(".", ",");
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => { const [y, m, d] = iso.split("-"); return `${d}.${m}.${String(y).slice(2)}`; };

/* ================= скоринг: отработал или схалявил ================= */
function scoreSession(workout, entries) {
  let plannedSets = 0, doneSets = 0, weightPts = 0, weightMax = 0;
  workout.exercises.forEach((ex) => {
    const sets = (entries[ex.id] || []).filter((s) => s.w > 0 && s.r > 0);
    plannedSets += ex.sets;
    doneSets += Math.min(sets.length, ex.sets);
    if (ex.w && ex.w[0] > 0) {
      const weight = ex.main ? 2 : 1;
      weightMax += weight;
      if (sets.length) {
        const top = Math.max(...sets.map((s) => s.w));
        if (top >= ex.w[0]) weightPts += weight;            // работал в своей вилке
        else if (top >= ex.w[0] * 0.85) weightPts += weight * 0.6; // ниже вилки
        else weightPts += weight * 0.3;                     // сильно ниже
      }
    }
  });
  const coverage = plannedSets ? doneSets / plannedSets : 0;
  const intensity = weightMax ? weightPts / weightMax : 1;
  const score = Math.round(100 * (0.65 * coverage + 0.35 * intensity));
  let verdict, cls, flavor;
  if (score >= 85) { verdict = "Квест покорён"; cls = "verdict-gold"; flavor = "Руны силы легли в твою пользу. Герой стал крепче."; }
  else if (score >= 60) { verdict = "Достойно, но не всё"; cls = "verdict-mid"; flavor = "Враг отступил, но ушёл живым. В следующий раз — до конца."; }
  else { verdict = "Слабый натиск"; cls = "verdict-fail"; flavor = "Клинок едва задел цель. Хроники помнят всё."; }
  const xp = Math.round(score * 1.2 + doneSets * 2);
  return { score, verdict, cls, flavor, xp, doneSets, plannedSets };
}

/* ================= вычисление статов героя ================= */
function bestE1RM(lift, upto = Infinity) {
  let best = 0;
  S.sessions.forEach((s, i) => {
    if (i > upto) return;
    const w = WORKOUTS[s.workoutId]; if (!w) return;
    w.exercises.forEach((ex) => {
      if (ex.lift !== lift) return;
      (s.entries[ex.id] || []).forEach(({ w: wt, r }) => { if (wt && r) best = Math.max(best, epley(wt, Math.min(r, 10))); });
    });
  });
  return best;
}

function heroStats() {
  const lifts = {};
  let strengthGain = 0;
  Object.keys(BASELINES).forEach((k) => {
    const cur = Math.max(bestE1RM(k), 0);
    lifts[k] = { base: BASELINES[k], cur: cur || BASELINES[k] };
    strengthGain += Math.max(0, (lifts[k].cur - BASELINES[k]) / BASELINES[k]);
  });
  const level = Math.floor(Math.sqrt(S.xp / 40)) + 1;
  const nextXp = 40 * Math.pow(level, 2);
  const prevXp = 40 * Math.pow(level - 1, 2);
  const lvlProgress = Math.min(1, (S.xp - prevXp) / Math.max(1, nextXp - prevXp));

  // Сила: старт 62, растёт от прибавок e1RM
  const str = Math.min(99, Math.round(62 + strengthGain * 220));
  // Мощь: суммарный расчётный 1ПМ относительно веса тела (relative strength)
  const totalE1RM = Object.values(lifts).reduce((a, v) => a + v.cur, 0);
  const bw = S.hero.bodyweight || 90;
  const pow = Math.min(99, Math.round((totalE1RM / bw) * 13));
  // Выносливость: средний тоннаж последних 6 сессий (т)
  const tonn = S.sessions.slice(-6).map((s) => {
    let t = 0; Object.values(s.entries).forEach((sets) => sets.forEach(({ w, r }) => (t += (w || 0) * (r || 0))));
    return t / 1000;
  });
  const avgT = tonn.length ? tonn.reduce((a, b) => a + b, 0) / tonn.length : 0;
  const endr = Math.min(99, Math.round(40 + avgT * 2.4));
  // Объём: суммарный тоннаж всех походов за всё время (т)
  let lifetimeT = 0;
  S.sessions.forEach((s) => Object.values(s.entries).forEach((sets) => sets.forEach(({ w, r }) => (lifetimeT += (w || 0) * (r || 0)))));
  lifetimeT /= 1000;
  const vol = Math.min(99, Math.round(Math.sqrt(lifetimeT) * 13));
  // Дисциплина: сессии за последние 14 дней против плана 6
  const cutoff = Date.now() - 14 * 864e5;
  const recent = S.sessions.filter((s) => new Date(s.date).getTime() >= cutoff).length;
  const disc = Math.min(99, Math.round((recent / 6) * 99));
  // Стойкость: средний счёт всех сессий
  const avgScore = S.sessions.length ? S.sessions.reduce((a, s) => a + s.score, 0) / S.sessions.length : 0;
  const grit = Math.round(avgScore * 0.99);

  const stats = { СИЛА: str, МОЩЬ: pow, ВЫНОСЛ: endr, ОБЪЁМ: vol, ДИСЦИПЛ: disc, СТОЙКОСТЬ: grit };
  return { level, lvlProgress, lifts, stats, cls: classInfo(stats, S.sessions.length) };
}

/* ================= классы и подклассы (из роста характеристик) ================= */
const CLASS_NOUN = { СИЛА: "Титан", МОЩЬ: "Громовержец", ВЫНОСЛ: "Марафонец", ОБЪЁМ: "Колосс", ДИСЦИПЛ: "Паладин", СТОЙКОСТЬ: "Несгибаемый" };
const CLASS_EPITHET = { СИЛА: "Могучий", МОЩЬ: "Яростный", ВЫНОСЛ: "Неутомимый", ОБЪЁМ: "Исполинский", ДИСЦИПЛ: "Праведный", СТОЙКОСТЬ: "Стойкий" };
const CLASS_ICON = { СИЛА: "muscle", МОЩЬ: "lightning", ВЫНОСЛ: "flame", ОБЪЁМ: "weight", ДИСЦИПЛ: "shield", СТОЙКОСТЬ: "gem" };
function classInfo(stats, sessionsCount) {
  const e = Object.entries(stats).sort((a, b) => b[1] - a[1]);
  const [p1, v1] = e[0], [p2, v2] = e[1];
  if (sessionsCount < 1 || v1 < 58) {
    return { name: "Странник", sub: "Новобранец", primary: p1, secondary: p2, icon: "helm", novice: true, hybrid: false };
  }
  // гибридный билд: два топ-стата близки — двойной класс (напр. «Титан-Паладин»)
  const hybrid = (v1 - v2) <= 5 && v2 >= 55;
  if (hybrid) {
    return { name: `${CLASS_NOUN[p1]}-${CLASS_NOUN[p2]}`, sub: "Гибридный билд", primary: p1, secondary: p2, icon: CLASS_ICON[p1], novice: false, hybrid: true };
  }
  return { name: CLASS_NOUN[p1], sub: CLASS_EPITHET[p2], primary: p1, secondary: p2, icon: CLASS_ICON[p1], novice: false, hybrid: false };
}

function nextWorkoutId() {
  // порядок цикла с учётом выбранного стартового квеста
  const n = ORDER.length;
  const start = (((S.cycleStart || 0) % n) + n) % n;
  const rot = ORDER.slice(start).concat(ORDER.slice(0, start));
  // следующий — с наименьшим числом прохождений, первый в порядке от старта
  const counts = rot.map((id) => S.sessions.filter((s) => s.workoutId === id).length);
  const min = Math.min(...counts);
  return rot[counts.indexOf(min)];
}

/* ================= роутинг ================= */
const app = document.getElementById("app");
const overlayRoot = document.getElementById("overlay-root");
const VIEWS = ["profile", "cycle", "buffs", "resources", "progress"];
let view = VIEWS.includes((location.hash || "").slice(1)) ? location.hash.slice(1) : "profile";

document.querySelectorAll(".tab").forEach((t) => {
  const holder = t.querySelector(".tab-ico");
  if (holder && t.dataset.icon) holder.innerHTML = icon(t.dataset.icon);
  t.addEventListener("click", () => {
    if (t.dataset.view === view) return;
    withLoader(() => { view = t.dataset.view; render(); });
  });
});

/* ---- анимированный лоадер между экранами ---- */
const loaderEl = document.getElementById("loader");
const loaderEmblem = document.getElementById("loader-emblem");
if (loaderEmblem) loaderEmblem.innerHTML = icon("sigil");
const LOADER_WORDS = ["Пробуждение", "Сбор рун", "Врата открываются", "Судьба зовёт", "Кровь и сталь", "Восхождение"];
const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let loaderHideTimer = null;
function withLoader(action) {
  if (reduceMotion || !loaderEl) { action(); return; }
  const word = document.getElementById("loader-word");
  if (word) word.textContent = LOADER_WORDS[Math.floor(Math.random() * LOADER_WORDS.length)];
  fxTransition();
  clearTimeout(loaderHideTimer);
  loaderEl.classList.remove("out");
  loaderEl.classList.add("show");
  setTimeout(() => {
    try { action(); }
    finally {
      // всегда прячем лоадер, даже если рендер бросил ошибку
      loaderEl.classList.add("out");
      loaderHideTimer = setTimeout(() => { loaderEl.classList.remove("show", "out"); }, 320);
    }
  }, 440);
}

/* ---- звук (WebAudio-синтез, без файлов) и тактильная отдача ---- */
let audioCtx = null;
function ac() {
  if (!S.settings || !S.settings.sound) return null;
  if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; } }
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}
function tone(freq, dur, type = "sine", gain = 0.05, when = 0) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + when;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.03);
}
function haptic(p) { if (S.settings && S.settings.haptics && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) {} } }
function fxTransition() { tone(300, 0.16, "triangle", 0.035); tone(470, 0.13, "sine", 0.025, 0.035); haptic(10); }
function fxChime() { tone(660, 0.2, "sine", 0.05); tone(990, 0.24, "sine", 0.04, 0.07); tone(1320, 0.3, "sine", 0.03, 0.15); haptic([14, 40, 22]); }
function fxTap() { tone(240, 0.05, "square", 0.02); haptic(7); }

/* ================= таймеры квеста и умного отдыха ================= */
const fmtClock = (sec) => { sec = Math.max(0, Math.round(sec)); const m = Math.floor(sec / 60); return `${m}:${String(sec % 60).padStart(2, "0")}`; };
let questTimerId = null;         // интервал часов квеста (перерисовывается на каждый render)
let restIntervalId = null;       // интервал таймера отдыха (живёт поверх экранов)
let restState = null;            // { endAt, total, note }
const timedSets = new WeakSet(); // подходы, для которых отдых уже запускался
let restFeel = "norm";           // состояние: fresh | norm | tired
const FEEL_FACTOR = { fresh: 0.85, norm: 1, tired: 1.25 };

// зона нагрузки по числу повторов (для подписи отдыха)
function repZone(r) {
  if (r <= 5) return "сила";
  if (r <= 8) return "сила/гипертрофия";
  if (r <= 12) return "гипертрофия";
  if (r <= 15) return "гипертрофия/выносл.";
  return "выносливость";
}
// изоляция — по id упражнения (остальное считаем многосуставным компаундом)
const ISO_RE = /curl|raise|delt|pushdown|french|calv|abs|cross|hammer|legext|legcurl|shrug|fly|pec/i;
// уровень упражнения: 1 — тяжёлая база штанги (макс. перформанс), 2 — вторичный
// компаунд / гипертрофия, 3 — изоляция/подсобка
function exTier(ex) {
  if (ex.id === "squat-vol") return 2;                              // многоповторный присед — гипертрофия
  if (["squat", "deadlift", "bench", "ohp"].includes(ex.lift)) return 1;
  if (ISO_RE.test(ex.id)) return 3;
  return 2;
}
// Умный отдых. Тяжёлая база (присед/становая/жим/швунг) требует 4–5 мин, иначе
// повторы падают между подходами (Willardson & Burkett 2005/2006: при 8ПМ суммарные
// повторы за 4 сета растут 1→2→5 мин: присед 22→25→29, жим 17→22→26). Подсобка и
// изоляция — коротко по зоне повторов (de Salles 2009; NSCA; Grgic 2018).
function smartRest(ex, set, a) {
  const r = set.r || 8;
  const tier = exTier(ex);
  const pct = (a && a.bestCeil) ? set.w / a.bestCeil : null;
  const warmup = pct != null && pct <= 0.6; // явно лёгкий/разминочный подход
  let rest;
  if (tier === 1) {
    // тяжёлая база: длинный отдых, чтобы держать перформанс
    if (r <= 3) rest = 300; else if (r <= 5) rest = 270; else if (r <= 6) rest = 255;
    else if (r <= 8) rest = 240; else if (r <= 10) rest = 210; else if (r <= 12) rest = 180;
    else if (r <= 15) rest = 150; else rest = 120;
    if (warmup) rest = Math.min(rest, 120);
  } else if (tier === 2) {
    // вторичный компаунд / гипертрофийная база
    if (r <= 5) rest = 165; else if (r <= 8) rest = 135; else if (r <= 10) rest = 105;
    else if (r <= 12) rest = 90; else if (r <= 15) rest = 70; else rest = 55;
    if (pct != null) { if (pct >= 0.9) rest += 20; else if (pct <= 0.6) rest -= 15; }
  } else {
    // изоляция
    if (r <= 8) rest = 90; else if (r <= 12) rest = 70; else if (r <= 15) rest = 55; else rest = 45;
  }
  // состояние
  rest *= (FEEL_FACTOR[restFeel] || 1);
  // тяжёлая база на рабочих подходах в силовой зоне — гарантируем ≥4 мин
  if (tier === 1 && r <= 8 && !warmup) rest = Math.max(rest, 240);
  rest = Math.round(rest / 5) * 5;
  return Math.max(40, Math.min(360, rest));
}

function ensureRestBar() {
  let b = document.getElementById("rest-bar");
  if (!b) {
    b = document.createElement("div");
    b.id = "rest-bar"; b.className = "rest-bar";
    b.innerHTML = `
      <div class="rest-prog"><i></i></div>
      <div class="rest-row">
        <span class="rest-label">Отдых · <b id="rest-time">0:00</b><span class="rest-note dim small" id="rest-note"></span></span>
        <div class="rest-ctl">
          <button id="rest-minus" aria-label="Меньше 15 с">−15</button>
          <button id="rest-plus" aria-label="Больше 15 с">+15</button>
          <button id="rest-skip" class="rest-skip">Пропустить</button>
        </div>
      </div>`;
    overlayRoot.appendChild(b);
    b.querySelector("#rest-minus").onclick = () => { if (restState) { restState.endAt -= 15000; restState.total = Math.max(15, restState.total - 15); tickRest(); fxTap(); } };
    b.querySelector("#rest-plus").onclick = () => { if (restState) { restState.endAt += 15000; restState.total += 15; tickRest(); fxTap(); } };
    b.querySelector("#rest-skip").onclick = () => stopRest();
  }
  return b;
}
function startRest(sec, note) {
  restState = { endAt: Date.now() + sec * 1000, total: sec, note: note || "" };
  const b = ensureRestBar(); b.classList.remove("done");
  const noteEl = b.querySelector("#rest-note"); if (noteEl) noteEl.textContent = note ? ` · ${note}` : "";
  fxTap();
  clearInterval(restIntervalId);
  restIntervalId = setInterval(tickRest, 250);
  tickRest();
}
function tickRest() {
  const b = document.getElementById("rest-bar");
  if (!b || !restState) { clearInterval(restIntervalId); return; }
  const rem = (restState.endAt - Date.now()) / 1000;
  if (rem <= 0) { finishRest(); return; }
  b.querySelector("#rest-time").textContent = fmtClock(rem);
  b.querySelector(".rest-prog i").style.width = Math.max(0, Math.min(100, (rem / restState.total) * 100)) + "%";
}
function finishRest() {
  clearInterval(restIntervalId);
  const b = document.getElementById("rest-bar");
  if (b) {
    b.classList.add("done");
    b.querySelector("#rest-time").textContent = "готово";
    b.querySelector(".rest-prog i").style.width = "0%";
    setTimeout(() => { const x = document.getElementById("rest-bar"); if (x) x.remove(); }, 1400);
  }
  restState = null;
  fxChime(); haptic([25, 60, 25]);
}
function stopRest() {
  clearInterval(restIntervalId); restState = null;
  const b = document.getElementById("rest-bar"); if (b) b.remove();
  fxTap();
}
function stopRestSilent() {
  clearInterval(restIntervalId); restState = null;
  const b = document.getElementById("rest-bar"); if (b) b.remove();
}

function render() {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === view));
  updateBuffBadge();
  window.scrollTo(0, 0);
  if (view === "profile") renderProfile();
  else if (view === "cycle") renderCycle();
  else if (view === "buffs") renderBuffs();
  else if (view === "resources") renderResources();
  else if (view === "progress") renderProgress();
}

/* дней с последней проверки арсенала; null == не проверяли ни разу */
function buffsDaysSince() {
  const at = S.buffs?.checkedAt;
  if (!at) return null;
  return Math.floor((Date.now() - new Date(at).getTime()) / 864e5);
}
function buffsDue() {
  const d = buffsDaysSince();
  return d === null || d >= BUFF_CHECK_DAYS;
}
function updateBuffBadge() {
  const badge = document.getElementById("buffs-badge");
  if (badge) badge.hidden = !buffsDue();
}

const runeSVG = `<svg viewBox="0 0 24 24"><path d="M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1z"/></svg>`;

/* ================= ПРОФИЛЬ ================= */
function renderProfile() {
  const h = heroStats();
  const ring = 2 * Math.PI * 52;
  const bw = S.hero.bodyweight;

  const c = h.cls;
  const statuses = S.statuses || [];
  app.innerHTML = `
    <div class="hero-head gilded">
      <div class="eyebrow">SOLO WIN · прокачка персонажа</div>
      <h1 class="display hero-name">${S.hero.name}</h1>
      <div class="hero-title">${c.novice ? "«гринд только начинается»" : `«${S.hero.title}»`}</div>
      <div class="level-ring">
        <svg viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(224,189,102,.16)" stroke-width="5"/>
          <circle cx="60" cy="60" r="52" fill="none" stroke="var(--gold-bright)" stroke-width="5"
            stroke-linecap="round" stroke-dasharray="${ring}" stroke-dashoffset="${ring * (1 - h.lvlProgress)}"/>
        </svg>
        <div class="lvl"><b>${h.level}</b><span>уровень</span></div>
      </div>
      <div class="dim small mono">${S.xp} XP · квестов пройдено: ${S.sessions.length}</div>
    </div>

    <div class="panel panel--ornate class-panel">
      <span class="class-medallion medallion medallion--lg">${icon(c.icon)}</span>
      <div class="class-body">
        <div class="eyebrow">Класс</div>
        <div class="class-name display">${c.name}</div>
        <div class="class-sub">Подкласс: <b>${c.sub}</b></div>
        <div class="class-gov dim small mono">${c.novice ? "качай характеристики — и откроется класс" : (c.hybrid ? `гибрид: ${c.primary} + ${c.secondary}` : `по росту: ${c.primary} · ${c.secondary}`)}</div>
      </div>
    </div>

    <div class="panel panel--ornate">
      <div class="eyebrow" style="margin-bottom:12px">Характеристики</div>
      <div class="statgrid">
        ${Object.entries(h.stats).map(([k, v]) => `
          <div class="stat">
            <span class="stat-ico" style="color:${STAT_ACCENT[k] || "#c9a961"}">${icon(STAT_ICONS[k] || "gem")}</span>
            <span class="label">${k}</span>
            <span class="bar"><i style="width:${v}%;background:${STAT_GRAD[k] || "linear-gradient(90deg,#8a713e,#c9a961,#e8cd82)"}"></i></span>
            <span class="val mono" style="color:${STAT_ACCENT[k] || "#c9a961"}">${v}</span>
          </div>`).join("")}
      </div>
    </div>

    <div class="panel">
      <div class="eyebrow" style="margin-bottom:10px">Знаки отличия${statuses.length ? ` · ${statuses.length}` : ""}</div>
      ${statuses.length
        ? `<div class="status-grid">${statuses.slice(0, 24).map((st, i) => `
            <button class="status-badge" data-si="${i}" title="${st.name}: ${st.desc}">
              <span class="medallion">${icon(st.icon || "gem")}</span>
              <span class="sb-name">${st.name}</span>
            </button>`).join("")}</div>`
        : `<div class="empty">Пока пусто. Бей рекорды, закрывай нормативы и перевыполняй квесты — статусы придут сами.</div>`}
    </div>

    <div class="panel">
      <div class="eyebrow" style="margin-bottom:8px">Арсенал героя · расчётный 1ПМ</div>
      ${Object.entries(h.lifts).map(([k, v]) => {
        const d = v.cur - v.base;
        return `<div class="kv"><span>${LIFT_NAMES[k]}</span>
          <span class="mono">${fmt(v.cur)} кг ${d > 0.5 ? `<span class="verdict-gold">+${fmt(d)}</span>` : `<span class="dim">база</span>`}</span></div>`;
      }).join("")}
      <div class="kv"><span>Вес героя</span><span class="mono">${bw} кг</span></div>
    </div>

    <div class="panel">
      <div class="eyebrow" style="margin-bottom:10px">Настройки</div>
      <button class="toggle-row" id="tg-sound"><span>Звук интерфейса</span><span class="tg ${S.settings?.sound ? "on" : ""}"><i></i></span></button>
      <button class="toggle-row" id="tg-haptics"><span>Вибро-отдача</span><span class="tg ${S.settings?.haptics ? "on" : ""}"><i></i></span></button>
    </div>

    <div class="panel">
      <div class="eyebrow" style="margin-bottom:10px">Сохранение</div>
      <div class="grid2">
        <button class="btn-ghost" id="btn-export">Экспорт JSON</button>
        <button class="btn-ghost" id="btn-import">Импорт JSON</button>
      </div>
      <input type="file" id="file-import" accept="application/json" hidden />
    </div>`;

  document.getElementById("tg-sound").onclick = () => { S.settings.sound = !S.settings.sound; if (S.settings.sound) fxTap(); save(); render(); };
  document.getElementById("tg-haptics").onclick = () => { S.settings.haptics = !S.settings.haptics; if (S.settings.haptics) haptic(15); save(); render(); };
  app.querySelectorAll(".status-badge").forEach((b) => b.onclick = () => showStatusDetail(statuses[+b.dataset.si]));

  document.getElementById("btn-export").onclick = () => {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bodyupgrade-${today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const fileInput = document.getElementById("file-import");
  document.getElementById("btn-import").onclick = () => fileInput.click();
  fileInput.onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try { S = Object.assign(defaultState(), JSON.parse(rd.result)); save(); render(); }
      catch { alert("Свиток повреждён: это не JSON приложения."); }
    };
    rd.readAsText(f);
  };
}

/* ================= КВЕСТЫ (цикл) ================= */
function renderCycle() {
  const nextId = nextWorkoutId();
  const startId = ORDER[(((S.cycleStart || 0) % ORDER.length) + ORDER.length) % ORDER.length];
  app.innerHTML = `
    <p class="dim small" style="margin-top:2px">Гринд характеристик: 3 квеста в неделю, порядок 1→12. Отметь ⚑, если начинаешь цикл не с первого квеста.</p>
    ${PROGRAM.weeks.map((wk) => `
      <div class="week-block">
        <div class="week-tag ${wk.type === "объёмная" ? "vol" : ""}">
          <span class="dot"></span> Неделя ${wk.n} — ${wk.type} · ${wk.pattern}
        </div>
        ${wk.saga ? `<div class="saga display">${wk.saga}</div>` : ""}
        ${wk.workouts.map((w) => {
          const idx = ORDER.indexOf(w.id);
          const done = S.sessions.filter((s) => s.workoutId === w.id);
          const last = done[done.length - 1];
          const isNext = w.id === nextId;
          const isStart = w.id === startId;
          return `
          <div class="wcard-wrap">
            <button class="wcard ${last ? "done" : ""} ${isNext ? "next" : ""}" data-w="${w.id}">
              <span class="medallion">${icon(w.icon || "anvil")}</span>
              <span class="wcard-body">
                <span class="row1">
                  <span class="boss">${w.boss}${isNext ? ' <span class="verdict-gold small">◈ след.</span>' : ""}</span>
                  ${last ? `<span class="verdict-chip ${last.cls} clickable" data-sid="${last.id}">${last.score}% ›</span>` : `<span class="dim small">—</span>`}
                </span>
                <span class="sub">${w.title} · ${w.exercises.length} упр.${last ? ` · был ${fmtDate(last.date)}` : ""}</span>
              </span>
            </button>
            <button class="wflag ${isStart ? "on" : ""}" data-i="${idx}" aria-label="Отметить стартом цикла"
              title="${isStart ? "Старт цикла" : "Сделать стартом цикла"}">⚑</button>
          </div>`;
        }).join("")}
      </div>`).join("")}`;

  app.querySelectorAll(".wcard").forEach((c) => c.addEventListener("click", () => withLoader(() => renderWorkout(c.dataset.w))));
  app.querySelectorAll(".verdict-chip.clickable").forEach((ch) => ch.addEventListener("click", (e) => { e.stopPropagation(); showSessionDetail(ch.dataset.sid); }));
  app.querySelectorAll(".wflag").forEach((f) => f.addEventListener("click", (e) => {
    e.stopPropagation();
    const i = +f.dataset.i;
    S.cycleStart = (S.cycleStart === i) ? 0 : i; // повторное нажатие — сбросить на первый
    fxTap(); save(); render();
  }));
}

/* ================= ЭКРАН ТРЕНИРОВКИ ================= */
function renderWorkout(wid) {
  const w = WORKOUTS[wid];
  const entries = S.drafts[wid] || {};
  // предзаполнение из последней сессии этого workout
  const lastSession = [...S.sessions].reverse().find((s) => s.workoutId === wid);

  // таймер квеста: старт при открытии; сброс, если запись «протухла» (>6 ч)
  if (!S.questStart) S.questStart = {};
  const nowTs = Date.now();
  if (!S.questStart[wid] || nowTs - S.questStart[wid] > 6 * 3600e3) { S.questStart[wid] = nowTs; save(); }

  app.innerHTML = `
    <div class="topbar">
      <button class="back-btn" id="back"><svg viewBox="0 0 24 24"><path d="M15 4l-8 8 8 8V4z"/></svg></button>
      <span class="medallion medallion--lg">${icon(w.icon || "anvil")}</span>
      <div class="topbar-mid">
        <div class="eyebrow">${WEEK_OF[wid].type === "объёмная" ? "объёмная" : "силовая"} · неделя ${WEEK_OF[wid].n}</div>
        <h2 class="display">${w.boss}</h2>
        <div class="dim small">${w.title}</div>
      </div>
      <span class="quest-timer mono" id="quest-timer" title="Время квеста">⏱ 0:00</span>
    </div>
    <div class="feel-row">
      <span class="feel-lbl">Состояние</span>
      ${[["fresh", "Свежий"], ["norm", "Норма"], ["tired", "Устал"]].map(([k, t]) =>
        `<button class="feel ${restFeel === k ? "on" : ""}" data-feel="${k}">${t}</button>`).join("")}
    </div>
    <div id="ex-list"></div>
    <button class="finish-btn" id="finish">Завершить квест</button>`;

  document.getElementById("back").onclick = () => withLoader(() => { view = "cycle"; render(); });
  app.querySelectorAll(".feel").forEach((b) => b.onclick = () => {
    restFeel = b.dataset.feel; fxTap();
    app.querySelectorAll(".feel").forEach((x) => x.classList.toggle("on", x.dataset.feel === restFeel));
  });

  // часы квеста (интервал самоочищается, когда элемент исчезает при смене экрана)
  clearInterval(questTimerId);
  const upQt = () => {
    const el = document.getElementById("quest-timer");
    if (!el) { clearInterval(questTimerId); return; }
    el.textContent = "⏱ " + fmtClock((Date.now() - S.questStart[wid]) / 1000);
  };
  upQt();
  questTimerId = setInterval(upQt, 1000);

  const movSeries = buildMovementSeries(); // история по каждому движению для целей потолка/пола
  const list = document.getElementById("ex-list");
  w.exercises.forEach((ex, i) => {
    const el = document.createElement("div");
    el.className = `ex ${ex.main ? "main-ex" : ""}`;
    const saved = entries[ex.id] || [];
    el.innerHTML = `
      <button class="ex-head" aria-expanded="false">
        <span>
          <span class="name">${ex.name}</span>${ex.main ? ' <span class="main-badge">движение дня</span>' : ""}
          <div class="plan">План: ${ex.scheme} · ${ex.wNote || `${fmt(ex.w[0])}${ex.w[1] !== ex.w[0] ? "–" + fmt(ex.w[1]) : ""} кг`}</div>
          ${exTargetHTML(ex, analyzeLift(movSeries[movementKey(ex)]), (movSeries[movementKey(ex)] || []).length)}
        </span>
        <span class="ex-status ${saved.length ? "ok" : ""}">${saved.length ? saved.length + " подх." : "0 / " + ex.sets}</span>
      </button>
      <div class="ex-body">
        <div class="set-labels"><span>#</span><span>Вес, кг</span><span>Повторы</span><span></span></div>
        <div class="sets"></div>
        <button class="add-set">+ подход</button>
      </div>`;
    list.appendChild(el);

    const head = el.querySelector(".ex-head");
    head.onclick = () => {
      const open = el.classList.toggle("open");
      head.setAttribute("aria-expanded", open);
    };

    const setsBox = el.querySelector(".sets");
    const status = el.querySelector(".ex-status");

    function ensure(id) { if (!S.drafts[wid]) S.drafts[wid] = {}; if (!S.drafts[wid][id]) S.drafts[wid][id] = []; return S.drafts[wid][id]; }

    function drawSets() {
      const arr = ensure(ex.id);
      setsBox.innerHTML = "";
      arr.forEach((s, si) => {
        const row = document.createElement("div");
        row.className = "set-row";
        row.innerHTML = `
          <span class="idx mono">${si + 1}</span>
          <input inputmode="decimal" placeholder="${placeholderW(si)}" value="${s.w || ""}" aria-label="вес" />
          <input inputmode="numeric" placeholder="${ex.reps[0]}–${ex.reps[1]}" value="${s.r || ""}" aria-label="повторы" />
          <button class="del" aria-label="удалить">✕</button>`;
        const [wi, ri] = row.querySelectorAll("input");
        wi.oninput = () => { s.w = parseFloat(wi.value.replace(",", ".")) || 0; save(); upd(); };
        ri.oninput = () => { s.r = parseInt(ri.value) || 0; save(); upd(); };
        // умный отдых: запись подхода завершена (ушёл фокус с повторов, вес и повторы заданы)
        const maybeRest = () => {
          if (s.w > 0 && s.r > 0 && !timedSets.has(s)) {
            timedSets.add(s);
            const a = analyzeLift(movSeries[movementKey(ex)]);
            startRest(smartRest(ex, s, a), `${ex.name} · ${repZone(s.r)}`);
          }
        };
        ri.onchange = maybeRest;
        wi.onchange = () => { if (s.r > 0) maybeRest(); };
        row.querySelector(".del").onclick = () => { timedSets.delete(s); arr.splice(si, 1); save(); drawSets(); upd(); };
        setsBox.appendChild(row);
      });
    }
    function placeholderW(si) {
      // подсказка: прошлый раз или нижняя граница вилки
      const prev = lastSession?.entries?.[ex.id]?.[si]?.w;
      return prev || ex.w[0] || "";
    }
    function upd() {
      const n = ensure(ex.id).filter((s) => s.w && s.r).length;
      status.textContent = n ? `${n} / ${ex.sets}` : `0 / ${ex.sets}`;
      status.classList.toggle("ok", n >= ex.sets);
    }
    el.querySelector(".add-set").onclick = () => {
      const arr = ensure(ex.id);
      const prevSet = arr[arr.length - 1];
      arr.push({ w: prevSet ? prevSet.w : 0, r: 0 });
      save(); drawSets(); upd();
      const inputs = setsBox.querySelectorAll(".set-row:last-child input");
      if (inputs[1]) inputs[1].focus();
    };

    drawSets(); upd();
    if (i === 0 && !saved.length) { el.classList.add("open"); head.setAttribute("aria-expanded", "true"); }
  });

  document.getElementById("finish").onclick = () => {
    const e = S.drafts[wid] || {};
    const anySets = Object.values(e).some((arr) => arr.some((s) => s.w && s.r));
    if (!anySets) { alert("Квест пуст: запиши хотя бы один подход."); return; }
    const res = scoreSession(w, e);
    // рекорды: лучший расчётный 1ПМ по движениям квеста ДО этой сессии
    const prBefore = {};
    w.exercises.forEach((ex) => { if (ex.lift) prBefore[ex.lift] = Math.max(prBefore[ex.lift] || 0, bestE1RM(ex.lift)); });
    const firstClear = S.sessions.filter((s) => s.workoutId === wid).length === 0;
    let tonn = 0; Object.values(e).forEach((arr) => arr.forEach(({ w: wt, r }) => (tonn += (wt || 0) * (r || 0))));
    const durationSec = S.questStart && S.questStart[wid] ? Math.round((Date.now() - S.questStart[wid]) / 1000) : 0;
    S.sessions.push({ id: crypto.randomUUID(), workoutId: wid, date: today(), verdict: res.verdict, cls: res.cls, score: res.score, xp: res.xp, durationSec, entries: e });
    S.xp += res.xp;
    delete S.drafts[wid];
    if (S.questStart) delete S.questStart[wid];
    clearInterval(questTimerId); stopRestSilent();
    const cut = Date.now() - 7 * 864e5;
    const recentCount = S.sessions.filter((s) => new Date(s.date).getTime() >= cut).length;
    const prAfter = {}; Object.keys(prBefore).forEach((l) => (prAfter[l] = bestE1RM(l)));
    const awarded = awardStatuses({ res, prBefore, prAfter, tonn, firstClear, recentCount });
    save();
    showVerdict(res, awarded, durationSec);
  };
}

/* ================= ситуационные статусы ================= */
const LUCKY_STATUSES = [
  { id: "grace", name: "Благодать Древа", desc: "Золотая благодать снизошла на героя", icon: "sun" },
  { id: "emberlord", name: "Искра Предвестника", desc: "В крови вспыхнул древний огонь", icon: "flame" },
  { id: "runegift", name: "Дар Рун", desc: "Руны сложились в счастливый узор", icon: "gem" },
  { id: "moonblessed", name: "Лунное Благословение", desc: "Тёмная луна одарила силой", icon: "moon" },
  { id: "tealtide", name: "Прилив Тумана", desc: "Сине-зелёная дымка укрыла усталость", icon: "droplet" },
  { id: "grindsoul", name: "Душа Гринда", desc: "Ты слился с рутиной прокачки в одно целое", icon: "sigil" },
  { id: "loothunter", name: "Охотник за Лутом", desc: "Из подхода выпал редкий трофей", icon: "gem" },
  { id: "berserk", name: "Кровавый Раж", desc: "Ярость затопила мышцы", icon: "muscle" },
  { id: "ironwill", name: "Стальная Хватка", desc: "Гриф будто прирос к ладоням", icon: "weight" },
  { id: "phantom", name: "Второе Дыхание", desc: "Откуда-то взялись силы на последний рывок", icon: "wings" },
  { id: "sage", name: "Мудрость Древних", desc: "Техника отточена до совершенства", icon: "scroll" },
  { id: "titanblood", name: "Кровь Титанов", desc: "В жилах проснулась исполинская мощь", icon: "lightning" },
];
function awardStatuses({ res, prBefore, prAfter, tonn, firstClear, recentCount }) {
  const out = [];
  const add = (id, name, desc, ic) => out.push({ id, name, desc, icon: ic, date: today() });
  const prLifts = Object.keys(prAfter).filter((l) => prAfter[l] > (prBefore[l] || 0) + 0.4);
  if (prLifts.length) add("pr", "Новый Предел", `Личный рекорд: ${prLifts.map((l) => LIFT_NAMES[l]).join(", ")}`, "gem");
  if (res.score >= 90) add("flawless", "Безупречный Квест", "Квест пройден на 90%+", "shield");
  if (res.doneSets >= res.plannedSets && res.score >= 80) add("overkill", "Сверх Нормы", "Все подходы закрыты в полную силу", "muscle");
  if (tonn >= 8000) add("ironmountain", "Гора Железа", `${(tonn / 1000).toFixed(1)} т поднято за квест`, "weight");
  if (firstClear) add("firstblood", "Первопроходец", "Первое прохождение квеста", "sword");
  if (recentCount >= 3) add("relentless", "Несокрушимая Воля", "3 квеста за 7 дней", "flame");
  // вехи гринда — за каждые 10 закрытых квестов
  const total = S.sessions.length;
  if (total > 0 && total % 10 === 0) add("grindveteran", "Ветеран Гринда", `${total} квестов позади`, "sigil");
  if (total === 1) add("awakened", "Пробуждённый", "Начало пути прокачки положено", "helm");
  // случайная удача — редкий статус за интересное испытание
  if (Math.random() < 0.22) { const l = LUCKY_STATUSES[Math.floor(Math.random() * LUCKY_STATUSES.length)]; add(l.id, l.name, l.desc, l.icon); }
  if (out.length) { S.statuses = [...out, ...(S.statuses || [])].slice(0, 80); }
  return out;
}

function showVerdict(res, awarded, durationSec) {
  const o = document.createElement("div");
  o.className = "overlay";
  const gold = res.cls === "verdict-fail" ? "#c65b3c" : "#e0bd66";
  const bright = res.cls === "verdict-fail" ? "#e0805a" : "#f7dd94";
  const badges = (awarded && awarded.length)
    ? `<div class="v-statuses">
         <div class="eyebrow" style="margin-bottom:8px">Получен статус${awarded.length > 1 ? "ы" : ""}</div>
         ${awarded.map((st) => `<div class="v-status"><span class="medallion">${icon(st.icon || "gem")}</span><span><b>${st.name}</b><span class="dim small"> — ${st.desc}</span></span></div>`).join("")}
       </div>`
    : "";
  o.innerHTML = `
    <div>
      <div class="seal"><svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="44" fill="none" stroke="${gold}" stroke-width="1.5"/>
        <path d="M50 14l9 18 20 3-14.5 14 3.5 20-18-9.5L32 69l3.5-20L21 35l20-3z"
          fill="none" stroke="${bright}" stroke-width="1.5"/>
      </svg></div>
      <div class="v-title ${res.cls}">${res.verdict}</div>
      <div class="v-sub">${res.flavor}</div>
      <div class="v-xp">Счёт ${res.score}% · подходы ${res.doneSets}/${res.plannedSets} · +${res.xp} XP${durationSec ? ` · ⏱ ${fmtClock(durationSec)}` : ""}</div>
      ${badges}
      <button class="v-close">Вернуться к квестам</button>
    </div>`;
  overlayRoot.appendChild(o);
  if (awarded && awarded.length) fxChime(); else { tone(520, 0.18, "sine", 0.04); haptic(20); }
  o.querySelector(".v-close").onclick = () => { o.remove(); withLoader(() => { view = "cycle"; render(); }); };
}

/* просмотр ранее выполненного квеста (прошлые победы) */
function showSessionDetail(sessionId) {
  const s = S.sessions.find((x) => x.id === sessionId);
  if (!s) return;
  const w = WORKOUTS[s.workoutId];
  fxTap();
  const rows = (w ? w.exercises : []).map((ex) => {
    const sets = (s.entries[ex.id] || []).filter((x) => x.w > 0 && x.r > 0);
    if (!sets.length) return "";
    const ceil = Math.max(...sets.map((x) => e1rmAvg(x.w, x.r)));
    const setStr = sets.map((x) => `${fmt(x.w)}×${x.r}`).join("  ");
    return `<div class="sd-ex">
      <div class="sd-ex-top"><span class="sd-name">${ex.name}${ex.main ? ' <span class="main-badge">дв. дня</span>' : ""}</span><span class="sd-ceil mono">1ПМ ${fmt(ceil)}</span></div>
      <div class="sd-sets mono">${setStr}</div>
    </div>`;
  }).join("");
  const o = document.createElement("div");
  o.className = "overlay portion-overlay";
  o.innerHTML = `
    <div class="portion-card sd-card">
      <div class="eyebrow">Прошлый квест · ${fmtDate(s.date)}</div>
      <div class="portion-name display">${w ? w.boss : s.workoutId}</div>
      <div class="sd-verdict ${s.cls} mono">${s.score}% · +${s.xp} XP${s.durationSec ? ` · ⏱ ${fmtClock(s.durationSec)}` : ""}${w ? ` · ${w.title}` : ""}</div>
      <div class="sd-list">${rows || `<div class="empty">Подходы не записаны.</div>`}</div>
      <button class="btn-ghost" id="sd-close">Закрыть</button>
    </div>`;
  overlayRoot.appendChild(o);
  o.querySelector("#sd-close").onclick = () => o.remove();
  o.addEventListener("click", (e) => { if (e.target === o) o.remove(); });
}

/* детали достижения (по тапу на значок) */
function showStatusDetail(st) {
  if (!st) return;
  fxTap();
  const o = document.createElement("div");
  o.className = "overlay status-overlay";
  o.innerHTML = `
    <div class="status-detail">
      <span class="medallion medallion--lg">${icon(st.icon || "gem")}</span>
      <div class="sd-title display">${st.name}</div>
      <div class="sd-desc">${st.desc || ""}</div>
      ${st.date ? `<div class="dim small mono" style="margin-top:8px">получено ${fmtDate(st.date)}</div>` : ""}
      <button class="btn-ghost" id="st-close" style="margin-top:16px;max-width:200px">Закрыть</button>
    </div>`;
  overlayRoot.appendChild(o);
  o.querySelector("#st-close").onclick = () => o.remove();
  o.addEventListener("click", (e) => { if (e.target === o) o.remove(); });
}

/* ================= БАФФЫ (арсенал добавок) ================= */
/* --- хелперы приёма и запасов --- */
const buffTimes = (b) => (b && b.times && b.times.length ? b.times : ["Утро"]);
const dosesPerDay = (b) => buffTimes(b).length || 1;
function currentSlot() { const h = new Date().getHours(); if (h >= 5 && h < 11) return "Утро"; if (h >= 11 && h < 16) return "День"; if (h >= 16 && h < 21) return "Вечер"; return "Перед сном"; }
function stockDaysLeft(b) { const s = S.buffs.stock ? S.buffs.stock[b.id] : null; return (typeof s === "number") ? Math.floor(s / dosesPerDay(b)) : null; }
function toggleTaken(id, slot, force) {
  const date = today();
  if (!S.buffs.log[date]) S.buffs.log[date] = {};
  const k = `${id}@${slot}`, cur = !!S.buffs.log[date][k];
  const next = force == null ? !cur : force;
  if (next === cur) return;
  if (next) { S.buffs.log[date][k] = true; if (typeof S.buffs.stock[id] === "number") S.buffs.stock[id] = Math.max(0, S.buffs.stock[id] - 1); }
  else { delete S.buffs.log[date][k]; if (typeof S.buffs.stock[id] === "number") S.buffs.stock[id] += 1; }
}

function renderBuffs() {
  if (!S.buffs.log) S.buffs.log = {}; if (!S.buffs.stock) S.buffs.stock = {};
  const active = S.buffs?.active || {};
  const activeBuffs = allBuffs().filter((b) => active[b.id] != null);
  const days = buffsDaysSince();
  const due = buffsDue();
  const date = today();
  const dayLog = S.buffs.log[date] || {};
  const cur = currentSlot();

  // ---- чек-лист приёма по слотам ----
  const bySlot = {}; BUFF_SLOTS.forEach((sl) => (bySlot[sl] = []));
  activeBuffs.forEach((b) => buffTimes(b).forEach((sl) => { (bySlot[sl] ||= []).push(b); }));
  const slotsWith = BUFF_SLOTS.filter((sl) => bySlot[sl] && bySlot[sl].length);
  let total = 0, taken = 0;
  slotsWith.forEach((sl) => bySlot[sl].forEach((b) => { total++; if (dayLog[`${b.id}@${sl}`]) taken++; }));

  const checklist = slotsWith.length
    ? slotsWith.map((sl) => {
        const items = bySlot[sl];
        const allDone = items.every((b) => dayLog[`${b.id}@${sl}`]);
        return `<div class="dose-slot ${sl === cur ? "now" : ""}">
          <div class="ds-head">
            <span class="ds-name">${sl}${sl === cur ? ' <span class="ds-now">сейчас</span>' : ""}</span>
            <button class="ds-all" data-slot="${sl}">${allDone ? "снять всё" : "принять всё"}</button>
          </div>
          ${items.map((b) => {
            const on = !!dayLog[`${b.id}@${sl}`];
            return `<button class="dose-item ${on ? "done" : ""}" data-take="${b.id}@${sl}">
              <span class="di-check">${on ? "✓" : ""}</span>
              <span class="di-body">
                <span class="di-top"><span class="di-name">${b.name}</span><span class="di-dose mono">${doseStr(b, active[b.id])}</span></span>
                <span class="di-sub dim small">${b.real}${b.hint ? ` · <span class="di-hint">💡 ${b.hint}</span>` : ""}</span>
              </span>
            </button>`;
          }).join("")}
        </div>`;
      }).join("")
    : `<div class="empty">Активных баффов нет. Добавь их из Арсенала ниже — и здесь появится план приёма на день.</div>`;

  // ---- запасы ----
  const lowList = activeBuffs.filter((b) => { const d = stockDaysLeft(b); return d != null && d <= LOW_STOCK_DAYS; });
  const stockCards = activeBuffs.length
    ? activeBuffs.map((b) => {
        const serv = S.buffs.stock[b.id];
        const dleft = stockDaysLeft(b);
        const low = dleft != null && dleft <= LOW_STOCK_DAYS;
        const stockLine = (typeof serv === "number")
          ? `<span class="st-days ${low ? "low" : ""}">осталось ${serv} порц.${dleft != null ? ` · ~${dleft} дн.` : ""}</span>`
          : `<span class="dim small">запас не задан</span>`;
        return `<div class="stock-card ${low ? "low" : ""}" data-id="${b.id}">
          <span class="medallion">${icon(b.icon)}</span>
          <span class="buff-body">
            <span class="buff-top"><b class="buff-name">${b.name}</b><button class="buff-dose edit mono" data-dose="${b.id}">${doseStr(b, active[b.id])} ✎</button></span>
            <span class="st-line">${stockLine} · <button class="st-set" data-stock="${b.id}">${typeof serv === "number" ? "пополнить" : "задать запас"}</button></span>
          </span>
          <button class="buff-toggle off" data-remove="${b.id}" title="Снять бафф" aria-label="Снять бафф">✕</button>
        </div>`;
      }).join("")
    : "";

  // ---- арсенал ----
  const cats = [...BUFF_CATS];
  allBuffs().forEach((b) => { if (b.cat && !cats.includes(b.cat)) cats.push(b.cat); });
  const arsenal = cats.map((cat) => {
    const items = allBuffs().filter((b) => b.cat === cat);
    if (!items.length) return "";
    return `<div class="buff-cat">
      <div class="week-tag" style="margin:14px 0 4px"><span class="dot"></span> ${cat}</div>
      ${items.map((b) => {
        const on = active[b.id] != null;
        const custom = String(b.id).startsWith("cust");
        return `<div class="buff arsenal ${on ? "on" : ""}" data-id="${b.id}">
          <span class="medallion">${icon(b.icon)}</span>
          <span class="buff-body">
            <span class="buff-top"><b class="buff-name">${b.name}${custom ? ' <span class="buff-mine">своё</span>' : ""}</b><span class="buff-dose mono dim">${doseStr(b)}</span></span>
            <span class="buff-real dim small">${b.real}${b.effect ? ` · ${b.effect}` : ""} · ${buffTimes(b).join(", ")}</span>
          </span>
          ${custom ? `<button class="buff-edit" data-edit="${b.id}" aria-label="Редактировать">✎</button>` : ""}
          <button class="buff-toggle ${on ? "off" : "add"}" aria-label="${on ? "Снять" : "Активировать"}">${on ? "✓" : "+"}</button>
        </div>`;
      }).join("")}
    </div>`;
  }).join("");

  const reminder = due
    ? `<div class="buff-reminder due">
         <div class="br-ico">${icon("hourglass")}</div>
         <div class="br-body"><b>Проверить баффы!</b><span class="dim small">${days === null ? "Арсенал ещё не сверялся." : `Прошло ${days} дн. с последней сверки.`} Что заканчивается, что обновить.</span></div>
         <button class="br-ok" id="buff-check">Сверено</button>
       </div>`
    : `<div class="buff-reminder ok">
         <div class="br-ico">${icon("shield")}</div>
         <div class="br-body"><b>Арсенал сверен</b><span class="dim small">Следующая проверка через ${BUFF_CHECK_DAYS - days} дн.</span></div>
       </div>`;

  const lowAlert = lowList.length
    ? `<div class="buff-reminder due" style="margin-top:10px">
         <div class="br-ico">${icon("flask")}</div>
         <div class="br-body"><b>Скоро закончится</b><span class="dim small">${lowList.map((b) => `${b.name} (~${stockDaysLeft(b)} дн.)`).join(", ")}</span></div>
       </div>` : "";

  app.innerHTML = `
    <p class="dim small" style="margin-top:2px">Приём по расписанию, запасы и арсенал. Только натуральное и легальное.</p>
    ${reminder}${lowAlert}

    <div class="rune-divider">${runeSVG}</div>
    <div class="ds-toph">
      <span class="eyebrow">Приём сегодня · ${taken}/${total}</span>
      ${total ? `<button class="ds-allday" id="ds-allday">${taken >= total ? "снять всё" : "принять всё"}</button>` : ""}
    </div>
    <div class="dose-prog"><i style="width:${total ? Math.round(taken / total * 100) : 0}%"></i></div>
    <div id="checklist">${checklist}</div>

    ${activeBuffs.length ? `<div class="rune-divider">${runeSVG}</div>
    <div class="eyebrow" style="margin-bottom:6px">Запасы · ${activeBuffs.length}</div>
    <div id="stock">${stockCards}</div>` : ""}

    <div class="rune-divider">${runeSVG}</div>
    <div class="eyebrow" style="margin-bottom:2px">Арсенал</div>
    <p class="dim small" style="margin-bottom:8px">«+» — активировать. Доза правится по ✎ в «Запасах».</p>
    ${arsenal}
    <button class="btn-ghost buff-add-btn" id="buff-add" style="margin-top:12px">+ Добавить свой бафф</button>`;

  const check = document.getElementById("buff-check");
  if (check) check.onclick = () => { S.buffs.checkedAt = today(); fxTap(); save(); render(); };

  // отметки приёма
  app.querySelectorAll(".dose-item").forEach((el) => el.onclick = () => {
    const [id, sl] = el.dataset.take.split("@");
    toggleTaken(id, sl); fxTap(); save(); render();
  });
  app.querySelectorAll(".ds-all").forEach((btn) => btn.onclick = () => {
    const sl = btn.dataset.slot;
    const items = bySlot[sl] || [];
    const allDone = items.every((b) => dayLog[`${b.id}@${sl}`]);
    items.forEach((b) => toggleTaken(b.id, sl, !allDone));
    fxTap(); save(); render();
  });
  const allday = document.getElementById("ds-allday");
  if (allday) allday.onclick = () => {
    const on = taken < total;
    slotsWith.forEach((sl) => bySlot[sl].forEach((b) => toggleTaken(b.id, sl, on)));
    if (on) fxChime(); else fxTap();
    save(); render();
  };

  // запасы: доза и пополнение
  app.querySelectorAll(".buff-dose.edit").forEach((b) => b.onclick = (e) => { e.stopPropagation(); editActiveDose(b, b.dataset.dose); });
  app.querySelectorAll(".st-set").forEach((b) => b.onclick = (e) => { e.stopPropagation(); editStock(b, b.dataset.stock); });
  app.querySelectorAll("[data-remove]").forEach((b) => b.onclick = (e) => {
    e.stopPropagation();
    delete S.buffs.active[b.dataset.remove]; save(); render();
  });

  // арсенал
  document.getElementById("buff-add").onclick = () => openBuffEditor(null);
  app.querySelectorAll(".buff-edit").forEach((b) => b.onclick = (e) => { e.stopPropagation(); openBuffEditor((S.buffs.custom || []).find((x) => x.id === b.dataset.edit)); });
  app.querySelectorAll(".buff.arsenal[data-id]").forEach((el) => {
    const id = el.dataset.id;
    const toggle = el.querySelector(".buff-toggle");
    if (toggle) toggle.onclick = (e) => {
      e.stopPropagation();
      if (active[id] != null) delete S.buffs.active[id];
      else S.buffs.active[id] = (buffById(id) || {}).dose ?? 1;
      save(); render();
    };
  });
}

// инлайновое редактирование дозы (число; единица — из баффа)
function editActiveDose(btn, id) {
  const b = buffById(id) || { unit: "" };
  const wrap = document.createElement("span");
  wrap.className = "dose-edit-wrap";
  wrap.innerHTML = `<input class="dose-input mono" inputmode="decimal" value="${S.buffs.active[id] ?? ""}" aria-label="доза" /><span class="dose-unit">${b.unit || ""}</span>`;
  btn.replaceWith(wrap);
  const inp = wrap.querySelector("input");
  inp.focus(); inp.select();
  const commit = () => { const v = parseFloat((inp.value + "").replace(",", ".")); if (!isNaN(v) && v > 0) S.buffs.active[id] = v; save(); render(); };
  inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } if (e.key === "Escape") render(); };
  inp.onblur = commit;
}

// инлайновая правка запаса (порций)
function editStock(btn, id) {
  const inp = document.createElement("input");
  inp.className = "dose-input mono"; inp.inputMode = "numeric";
  inp.value = (typeof S.buffs.stock[id] === "number") ? S.buffs.stock[id] : "";
  inp.placeholder = "порц."; inp.setAttribute("aria-label", "осталось порций");
  btn.replaceWith(inp);
  inp.focus(); inp.select();
  const commit = () => { const v = parseInt(inp.value, 10); if (!isNaN(v) && v >= 0) S.buffs.stock[id] = v; save(); render(); };
  inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } if (e.key === "Escape") render(); };
  inp.onblur = commit;
}

// форма своего баффа: пользователь вводит реальную добавку, система подбирает имя/иконку
function openBuffEditor(buff) {
  const editing = !!buff;
  const b = buff || {};
  let offset = 0;
  let preview = editing
    ? { name: b.name, icon: b.icon, unit: b.unit || guessUnit(b.real || ""), cat: b.cat, effect: b.effect, times: buffTimes(b), hint: b.hint || "" }
    : autoBuffFromReal("", 0);
  let times = new Set(preview.times);
  let manualCat = false;

  const o = document.createElement("div");
  o.className = "overlay portion-overlay";
  o.innerHTML = `
    <div class="portion-card buff-editor">
      <div class="eyebrow">${editing ? "Правка баффа" : "Новый бафф"}</div>
      <div class="be-preview"><span class="medallion" id="be-medal">${icon(preview.icon)}</span>
        <div><div class="be-pname display" id="be-pname">${preview.name || "…"}</div>
        <button class="be-reroll" id="be-reroll">↻ другой облик</button></div></div>
      <div class="be-field"><label>Что за добавка</label>
        <input id="be-real" list="supp-list" value="${(b.real || "").replace(/"/g, "&quot;")}" placeholder="напр. Креатин, Магний, Омега-3…" autocomplete="off" />
        <datalist id="supp-list">${DATALIST_SUPPS.map((s) => `<option value="${s}"></option>`).join("")}</datalist>
      </div>
      <div class="be-row">
        <div class="be-field"><label>Доза</label><div class="dose-field"><input id="be-dose" inputmode="decimal" value="${b.dose != null ? b.dose : ""}" placeholder="5" /><span class="dose-unit" id="be-unit">${preview.unit}</span></div></div>
        <div class="be-field"><label>Категория</label><select id="be-cat">${BUFF_CATS.map((c) => `<option ${c === preview.cat ? "selected" : ""}>${c}</option>`).join("")}</select></div>
      </div>
      <div class="be-field"><label>Эффект (необязательно)</label><input id="be-effect" value="${(b.effect || "").replace(/"/g, "&quot;")}" placeholder="подставится автоматически" /></div>
      <div class="be-field"><label>Когда принимать</label><div class="slot-pick" id="be-slots">${BUFF_SLOTS.map((sl) => `<button class="slot-chip ${times.has(sl) ? "on" : ""}" data-sl="${sl}">${sl}</button>`).join("")}</div></div>
      <div class="be-field"><label>Запас, порций (необязательно)</label><input id="be-stock" inputmode="numeric" value="${(S.buffs.stock && b.id && typeof S.buffs.stock[b.id] === "number") ? S.buffs.stock[b.id] : ""}" placeholder="напр. 60" /></div>
      <div class="portion-actions">
        ${editing ? `<button class="btn-ghost" id="be-del">Удалить</button>` : `<button class="btn-ghost" id="be-cancel">Отмена</button>`}
        <button class="finish-btn" id="be-save" style="margin-top:0">${editing ? "Сохранить" : "Добавить"}</button>
      </div>
      ${editing ? `<button class="btn-ghost" id="be-cancel" style="margin-top:10px">Отмена</button>` : ""}
    </div>`;
  overlayRoot.appendChild(o);

  const realIn = o.querySelector("#be-real");
  const unitEl = o.querySelector("#be-unit");
  const catSel = o.querySelector("#be-cat");
  const effIn = o.querySelector("#be-effect");
  const applyPreview = () => {
    o.querySelector("#be-medal").innerHTML = icon(preview.icon);
    o.querySelector("#be-pname").textContent = preview.name || "…";
    unitEl.textContent = preview.unit;
  };
  const recompute = (fromReal) => {
    preview = autoBuffFromReal(realIn.value, offset);
    if (!manualCat) catSel.value = preview.cat;
    if (fromReal) { // подхватываем тайминг и эффект из подбора
      times = new Set(preview.times);
      o.querySelectorAll(".slot-chip").forEach((c) => c.classList.toggle("on", times.has(c.dataset.sl)));
      if (!effIn.value.trim()) effIn.placeholder = preview.effect || "подставится автоматически";
    }
    applyPreview();
  };
  realIn.oninput = () => recompute(true);
  o.querySelector("#be-reroll").onclick = (e) => { e.preventDefault(); offset++; preview = autoBuffFromReal(realIn.value, offset); applyPreview(); fxTap(); };
  catSel.onchange = () => { manualCat = true; };
  o.querySelectorAll(".slot-chip").forEach((c) => c.onclick = () => { const sl = c.dataset.sl; if (times.has(sl)) times.delete(sl); else times.add(sl); c.classList.toggle("on"); fxTap(); });
  o.querySelector("#be-cancel").onclick = () => o.remove();
  const delBtn = o.querySelector("#be-del");
  if (delBtn) delBtn.onclick = () => { S.buffs.custom = (S.buffs.custom || []).filter((x) => x.id !== b.id); delete S.buffs.active[b.id]; delete S.buffs.stock[b.id]; save(); o.remove(); render(); };

  o.querySelector("#be-save").onclick = () => {
    const real = realIn.value.trim();
    if (!real) { realIn.focus(); return; }
    const auto = autoBuffFromReal(real, offset);
    const tl = BUFF_SLOTS.filter((sl) => times.has(sl)); if (!tl.length) tl.push("Утро");
    const dose = parseFloat((o.querySelector("#be-dose").value + "").replace(",", ".")) || auto.dose || 1;
    const rec = {
      id: editing ? b.id : "cust" + Date.now(),
      name: editing && b.real === real ? b.name : preview.name,
      icon: editing && b.real === real ? b.icon : preview.icon,
      real, unit: preview.unit, dose,
      effect: o.querySelector("#be-effect").value.trim() || auto.effect || "",
      cat: catSel.value, times: tl, hint: auto.hint || (editing ? b.hint : "") || "",
    };
    if (!S.buffs.custom) S.buffs.custom = [];
    const i = (S.buffs.custom || []).findIndex((x) => x.id === rec.id);
    if (i >= 0) S.buffs.custom[i] = rec; else S.buffs.custom.push(rec);
    const stk = parseInt(o.querySelector("#be-stock").value, 10);
    if (!isNaN(stk) && stk >= 0) S.buffs.stock[rec.id] = stk;
    save(); o.remove(); render();
  };
}
const DATALIST_SUPPS = ["Креатин моногидрат", "Сывороточный протеин", "Кофеин", "Цитруллин малат", "L-Аргинин", "Бета-аланин", "Омега-3 (рыбий жир)", "Витамин D3", "Магний", "Цинк", "Витамин C", "Мультивитамины", "Ашваганда", "Таурин", "BCAA", "EAA", "Глютамин", "Мелатонин", "Коллаген", "Казеин", "Гейнер", "Родиола", "Куркумин", "Железо", "Витамин B12", "Глюкозамин", "Пробиотик", "Клетчатка", "Электролиты", "Кальций", "L-Карнитин", "Гуарана", "Предтреник"];

/* ================= РЕСУРСЫ (снабжение / питание) ================= */
const NUT_ICON = { kcal: "flame", protein: "drumstick", carbs: "wheat", fat: "avocado", fiber: "leaf" };
// у каждой шкалы — свой цвет заливки и акцент иконки
const NUT_GRAD = {
  kcal: "linear-gradient(90deg,#b5732f,#e0a24a,#f3c66e)",    // янтарь
  protein: "linear-gradient(90deg,#8f3030,#cf5a4a,#ec8a72)", // багрянец
  carbs: "linear-gradient(90deg,#9a7a24,#d8b43f,#f2dd78)",   // золото
  fat: "linear-gradient(90deg,#5c7d3f,#8fb15e,#c0dd92)",     // зелень
  fiber: "linear-gradient(90deg,#5f7d2f,#9bb84a,#cbe07a)",   // лайм
};
const NUT_ACCENT = { kcal: "#e0a24a", protein: "#e07a5f", carbs: "#e6c24a", fat: "#9fc46e", fiber: "#bcd35f" };

let resDate = null;               // выбранный день (по умолчанию сегодня)
const curResDate = () => resDate || today();
const WD = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
// даты считаем в UTC — согласованно с today() (он тоже из toISOString)
function addDays(iso, n) { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function dateLabel(iso) { const d = new Date(iso + "T00:00:00Z"); return `${WD[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; }

function nutDay(date) { // создаёт и сохраняет запись дня (для записи)
  if (!S.nutrition) S.nutrition = { log: {}, recent: [] };
  if (!S.nutrition.log[date]) {
    const trained = S.sessions.some((s) => s.date === date);
    S.nutrition.log[date] = { dayType: trained ? "training" : "rest", items: [], water: 0 };
  }
  return S.nutrition.log[date];
}
function nutRead(date) { // читает без создания (для отображения прошлых пустых дней)
  return (S.nutrition && S.nutrition.log[date]) ||
    { dayType: S.sessions.some((s) => s.date === date) ? "training" : "rest", items: [], water: 0 };
}
function nutTotals(day) {
  const t = { k: 0, p: 0, f: 0, cb: 0, fb: 0 };
  day.items.forEach((it) => {
    const m = it.g / 100;
    t.k += it.k * m; t.p += it.p * m; t.f += it.f * m; t.cb += it.cb * m; t.fb += (it.fb || 0) * m;
  });
  return t;
}
function pushRecent(food) {
  if (!S.nutrition.recent) S.nutrition.recent = [];
  S.nutrition.recent = [food, ...S.nutrition.recent.filter((r) => r.id !== food.id)].slice(0, 12);
  if (!S.nutrition.foodStats) S.nutrition.foodStats = {};
  const cur = S.nutrition.foodStats[food.id];
  S.nutrition.foodStats[food.id] = { food, count: (cur ? cur.count : 0) + 1, last: Date.now() };
  // не даём словарю расти бесконечно — держим 60 самых свежих
  const ids = Object.keys(S.nutrition.foodStats);
  if (ids.length > 60) {
    ids.sort((a, b) => S.nutrition.foodStats[a].last - S.nutrition.foodStats[b].last)
      .slice(0, ids.length - 60).forEach((id) => delete S.nutrition.foodStats[id]);
  }
}

/* ---- гидратация: сколько воды даёт напиток (кофе/чай/кола/энергетик и т.п.) ---- */
const DRINK_RE = /(вода|минерал|чай|кофе|кол[аы]|лимонад|газиров|морс|компот|квас|энергет|energ|сок|juice|смузи|коктейл|молоко|кефир|айран|латте|latte|капучино|cappuccino|americano|espresso|эспрессо|тоник|tonic|нектар|напит|cola|soda|drink|tea|coffee|water)/i;
const itemIsDrink = (it) => it.drink === true || DRINK_RE.test(it.n || "");
function itemHy(it) { // индекс гидратации
  if (it.hy) return it.hy;
  const n = it.n || "";
  if (/кофе|чай|coffee|tea/i.test(n)) return 0.95;
  if (/вода|минерал|water/i.test(n)) return 1;
  return 0.9;
}
function itemWaterMl(it) { // вода из напитка = масса × доля воды × индекс гидратации
  if (!itemIsDrink(it)) return 0;
  const frac = Math.max(0, Math.min(1, 1 - ((it.p + it.f + it.cb) / 100)));
  return it.g * frac * itemHy(it);
}
const drinkWaterOf = (day) => day.items.reduce((a, it) => a + itemWaterMl(it), 0);

// класс шкалы: недобор / в цель / перебор (для белка перебор — не беда)
function gaugeState(pct, kind) {
  if (pct < 0.9) return "lo";
  if (pct <= 1.1) return "ok";
  return kind === "protein" ? "ok" : "hi";
}

function renderResources() {
  const date = curResDate();
  const isToday = date === today();
  const day = nutRead(date);
  const T = NUTRITION.dayTypes[day.dayType];
  const tot = nutTotals(day);

  const fiberTgt = NUTRITION.constants.fiber[0];
  // готовность пайка считаем по 4 основным нутриентам; клетчатка — отдельная шкала
  const core = [
    { key: "kcal", name: "Калории", unit: "ккал", cur: tot.k, tgt: T.kcal },
    { key: "protein", name: "Белок", unit: "г", cur: tot.p, tgt: T.protein, floor: true },
    { key: "carbs", name: "Углеводы", unit: "г", cur: tot.cb, tgt: T.carbs },
    { key: "fat", name: "Жиры", unit: "г", cur: tot.f, tgt: T.fat },
  ];
  const readiness = Math.round(100 * core.reduce((a, m) => a + Math.min(1, m.cur / m.tgt), 0) / core.length);
  const proteinOk = tot.p >= T.protein * 0.95;
  const kcalPct = tot.k / T.kcal;
  const kcalOk = kcalPct >= 0.9 && kcalPct <= 1.1;
  let vCls, vTxt;
  if (readiness >= 90 && proteinOk && kcalOk) { vCls = "verdict-gold"; vTxt = "Паёк собран"; }
  else if (readiness >= 55) { vCls = "verdict-mid"; vTxt = "Припасы копятся"; }
  else { vCls = "verdict-fail"; vTxt = "Кладовая пуста"; }

  const gaugeList = [...core, { key: "fiber", name: "Клетчатка", unit: "г", cur: tot.fb, tgt: fiberTgt, floor: true }];
  const ring = 2 * Math.PI * 52;
  const gaugeHTML = gaugeList.map((m) => {
    const pct = m.tgt ? m.cur / m.tgt : 0;
    const st = gaugeState(pct, m.floor ? "protein" : m.key);
    const left = Math.round(m.tgt - m.cur);
    const sub = st === "ok" ? "в цель ✓" : (left > 0 ? `осталось ${left} ${m.unit}` : `перебор ${Math.abs(left)} ${m.unit}`);
    return `
      <div class="gauge ${st}">
        <div class="g-top">
          <span class="g-name" style="color:${NUT_ACCENT[m.key]}">${icon(NUT_ICON[m.key])}<b>${m.name}</b></span>
          <span class="g-val mono">${Math.round(m.cur)}<span class="g-tgt"> / ${m.tgt} ${m.unit}</span></span>
        </div>
        <div class="g-bar"><i style="width:${Math.min(100, pct * 100).toFixed(0)}%;background:${NUT_GRAD[m.key]}"></i></div>
        <div class="g-sub mono">${sub}</div>
      </div>`;
  }).join("");

  // вода = стаканы вручную + вода из напитков дня
  const drinkWater = Math.round(drinkWaterOf(day));
  const totalWater = day.water + drinkWater;
  const waterCups = Math.round(day.water / 250);
  const waterPct = Math.min(100, (totalWater / WATER_TARGET_ML) * 100);

  const itemsHTML = day.items.length
    ? day.items.map((it, i) => {
        const wml = Math.round(itemWaterMl(it));
        const amt = it.amt != null ? it.amt : it.g;
        const unit = it.unit || "г";
        return `
        <div class="meal-row">
          <button class="meal-main" data-i="${i}" aria-label="Изменить порцию">
            <span class="meal-name">${it.n}</span>
            <span class="meal-portion mono">${fmt(amt)} ${unit}${wml ? `<span class="water-badge">${icon("droplet")}${wml} мл</span>` : ""} <span class="meal-pen">✎</span></span>
          </button>
          <span class="meal-kcal mono">${Math.round(it.k * it.g / 100)} ккал</span>
          <button class="meal-del" data-i="${i}" aria-label="Убрать">✕</button>
        </div>`;
      }).join("")
    : `<div class="empty">Провизии пока нет. Найди продукт и добавь порцию.</div>`;

  const tip = day.dayType === "training"
    ? `<div class="nut-tip"><span class="dim small">⚔ Тренировочный день · за 2 ч до похода: ${NUTRITION.timing.pre.carbs.join("–")} г углеводов + ${NUTRITION.timing.pre.protein.join("–")} г белка · после: ${NUTRITION.timing.post.carbs.join("–")} г углеводов + ${NUTRITION.timing.post.protein.join("–")} г белка.</span></div>`
    : `<div class="nut-tip"><span class="dim small">☾ День отдыха · углеводы ровнее по приёмам, ужин легче. Белок держим ${T.protein} г.</span></div>`;

  // календарь: 7 дней. Окно оканчивается сегодня, либо выбранным днём, если он раньше.
  const winEnd = (date <= today() && date > addDays(today(), -6)) ? today() : date;
  const strip = Array.from({ length: 7 }, (_, i) => addDays(winEnd, -(6 - i))).map((iso) => {
    const d = new Date(iso + "T00:00:00Z");
    const rec = S.nutrition && S.nutrition.log[iso];
    const has = rec && (rec.items.length || rec.water > 0);
    const future = iso > today();
    return `<button class="cday ${iso === date ? "on" : ""} ${future ? "future" : ""}" data-d="${iso}" ${future ? "disabled" : ""}>
      <span class="cw">${WD[d.getUTCDay()]}</span><span class="cn">${d.getUTCDate()}</span>
      <span class="cdot ${has ? "has" : ""}"></span>
    </button>`;
  }).join("");

  app.innerHTML = `
    <div class="daynav">
      <button class="dn-arrow" id="day-prev" aria-label="Прошлый день"><svg viewBox="0 0 24 24"><path d="M15 4l-8 8 8 8V4z"/></svg></button>
      <div class="dn-label">${dateLabel(date)}${isToday ? ' <span class="dn-today">сегодня</span>' : ""}</div>
      <button class="dn-arrow" id="day-next" aria-label="Следующий день" ${isToday ? "disabled" : ""}><svg viewBox="0 0 24 24"><path d="M9 4l8 8-8 8V4z"/></svg></button>
    </div>
    <div class="weekstrip">${strip}</div>
    ${!isToday ? `<button class="today-btn" id="day-today">← Вернуться в сегодня</button>` : ""}

    <div class="daytype-toggle">
      <button class="dt ${day.dayType === "training" ? "on" : ""}" data-dt="training">${icon("hammer")} Тренировочный</button>
      <button class="dt ${day.dayType === "rest" ? "on" : ""}" data-dt="rest">${icon("moon")} Отдых</button>
    </div>

    <div class="panel panel--ornate fuel-panel">
      <div class="level-ring fuel-ring">
        <svg viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(201,169,97,.15)" stroke-width="5"/>
          <circle cx="60" cy="60" r="52" fill="none" stroke="#c9a961" stroke-width="5"
            stroke-linecap="round" stroke-dasharray="${ring}" stroke-dashoffset="${ring * (1 - readiness / 100)}"/>
        </svg>
        <div class="lvl"><b>${readiness}%</b><span>паёк</span></div>
      </div>
      <div class="fuel-verdict ${vCls}">${vTxt}</div>
      <div class="dim small mono">${T.label} · цель ${T.kcal} ккал · Б ${T.protein} · Ж ${T.fat} · У ${T.carbs}</div>
    </div>

    <div class="gauges">${gaugeHTML}</div>

    <div class="panel water-panel">
      <div class="g-top">
        <span class="g-name" style="color:#7fc7d6">${icon("droplet")}<b>Вода</b></span>
        <span class="g-val mono">${(totalWater / 1000).toFixed(2)}<span class="g-tgt"> / ${(WATER_TARGET_ML / 1000).toFixed(1)} л</span></span>
      </div>
      <div class="g-bar"><i class="water" style="width:${waterPct.toFixed(0)}%"></i></div>
      <div class="water-breakdown mono dim small">${waterCups} стак. × 250 мл${drinkWater ? ` <span class="wb-drink">+ ${drinkWater} мл из напитков</span>` : ""}</div>
      <div class="water-ctl">
        <button class="wbtn" id="water-minus" aria-label="Убрать стакан">− стакан</button>
        <button class="wbtn wbtn-add" id="water-plus" aria-label="Добавить стакан">+ стакан</button>
      </div>
    </div>

    ${tip}

    <div class="rune-divider">${runeSVG}</div>

    <div class="eyebrow" style="margin-bottom:6px">Добавить провизию</div>
    <div class="food-search">
      <input id="food-q" type="search" inputmode="search" placeholder="Найди продукт — курица, кофе, кола…" autocomplete="off" />
    </div>
    <div id="food-results"></div>

    <div class="rune-divider">${runeSVG}</div>
    <div class="eyebrow" style="margin-bottom:6px">${isToday ? "Съедено сегодня" : "Съедено в этот день"} · ${day.items.length}</div>
    <div id="meal-log">${itemsHTML}</div>`;

  // навигация по дням
  document.getElementById("day-prev").onclick = () => { resDate = addDays(date, -1); render(); };
  const nextBtn = document.getElementById("day-next");
  if (nextBtn && !nextBtn.disabled) nextBtn.onclick = () => { if (date < today()) { resDate = addDays(date, 1); render(); } };
  const todayBtn = document.getElementById("day-today");
  if (todayBtn) todayBtn.onclick = () => { resDate = today(); render(); };
  app.querySelectorAll(".cday").forEach((b) => { if (!b.disabled) b.onclick = () => { resDate = b.dataset.d; render(); }; });

  // тип дня, вода, удаление — пишем в постоянную запись выбранного дня
  app.querySelectorAll(".dt").forEach((b) => b.onclick = () => { nutDay(date).dayType = b.dataset.dt; save(); render(); });
  document.getElementById("water-plus").onclick = () => { nutDay(date).water += 250; save(); render(); };
  document.getElementById("water-minus").onclick = () => { const d = nutDay(date); d.water = Math.max(0, d.water - 250); save(); render(); };
  app.querySelectorAll(".meal-del").forEach((b) => b.onclick = () => { nutDay(date).items.splice(+b.dataset.i, 1); save(); render(); });
  // клик по приёму — изменить порцию
  app.querySelectorAll(".meal-main").forEach((b) => b.onclick = () => {
    const i = +b.dataset.i;
    openPortion(nutRead(date).items[i], date, i);
  });

  wireFoodSearch(date);
}

/* ---------- поиск продуктов: локальный справочник + Open Food Facts ---------- */
let foodSearchTimer = null;
let foodSearchCtl = null;

function wireFoodSearch(date) {
  const input = document.getElementById("food-q");
  const box = document.getElementById("food-results");
  if (!input || !box) return;

  const renderList = (foods, note, opts = {}) => {
    const star = opts.starIds || new Set();
    box.innerHTML =
      (note ? `<div class="dim small" style="padding:4px 2px">${note}</div>` : "") +
      (foods.length ? foods.map((f) => `
        <div class="food-item" data-id="${f.id}">
          <span class="food-body">
            <span class="food-name">${f.n}${star.has(f.id) ? ' <span class="freq-badge">★ часто</span>' : ""}</span>
            <span class="food-macros dim small mono">${f.k} ккал · Б ${fmt(f.p)} · Ж ${fmt(f.f)} · У ${fmt(f.cb)} <span class="per100">/ 100 г</span></span>
          </span>
          <button class="food-add" aria-label="Добавить">+</button>
        </div>`).join("") : `<div class="empty">Ничего не найдено. Попробуй другое слово.</div>`) +
      (opts.moreCount ? `<button class="food-more" id="food-more">Развернуть · ещё ${opts.moreCount}</button>` : "");
    // кэш найденных, чтобы открыть порцию
    box._foods = {};
    foods.forEach((f) => (box._foods[f.id] = f));
    box.querySelectorAll(".food-item").forEach((el) => {
      el.querySelector(".food-add").onclick = () => openPortion(box._foods[el.dataset.id], date);
    });
    const more = box.querySelector("#food-more");
    if (more && opts.onMore) more.onclick = opts.onMore;
  };

  // «Частое и недавнее»: 2 самых частых + 3 последних, остальное — под «Развернуть»
  const showDefault = (expanded = false) => {
    const fs = S.nutrition.foodStats || {};
    let pool = Object.values(fs);
    if (!pool.length && (S.nutrition.recent || []).length) pool = S.nutrition.recent.map((f, i) => ({ food: f, count: 1, last: 1e12 - i }));
    if (!pool.length) { renderList(FOODS.slice(0, 8), "Популярное"); return; }
    const freq = [...pool].sort((a, b) => b.count - a.count || b.last - a.last).filter((x) => x.count >= 2).slice(0, 2);
    const freqIds = new Set(freq.map((x) => x.food.id));
    const byRecent = pool.filter((x) => !freqIds.has(x.food.id)).sort((a, b) => b.last - a.last);
    const rest = byRecent.slice(3);
    const head = [...freq, ...byRecent.slice(0, 3)].map((x) => x.food);
    const list = expanded ? [...head, ...rest.map((x) => x.food)] : head;
    renderList(list, "Частое и недавнее", {
      starIds: freqIds,
      moreCount: (!expanded && rest.length) ? rest.length : 0,
      onMore: () => showDefault(true),
    });
  };
  showDefault();

  input.oninput = () => {
    const q = input.value.trim().toLowerCase();
    clearTimeout(foodSearchTimer);
    if (foodSearchCtl) { foodSearchCtl.abort(); foodSearchCtl = null; }
    if (!q) { showDefault(); return; }

    // мгновенно — локальные совпадения
    const local = FOODS.filter((f) => f.n.toLowerCase().includes(q)).slice(0, 10);
    renderList(local, "Из справочника · ищу в базе Open Food Facts…");

    // затем — Open Food Facts (с debounce)
    foodSearchTimer = setTimeout(async () => {
      foodSearchCtl = new AbortController();
      const killer = setTimeout(() => foodSearchCtl && foodSearchCtl.abort(), 8000); // не ждём вечно
      try {
        const remote = await offSearch(q, foodSearchCtl.signal);
        clearTimeout(killer);
        if (input.value.trim().toLowerCase() !== q) return; // запрос устарел
        const seen = new Set(local.map((f) => f.n.toLowerCase()));
        const merged = [...local, ...remote.filter((r) => !seen.has(r.n.toLowerCase()))].slice(0, 30);
        renderList(merged, merged.length > local.length ? "Справочник + Open Food Facts" : "Из справочника");
      } catch (e) {
        clearTimeout(killer);
        if (e.name === "AbortError") return;
        renderList(local, "Open Food Facts недоступен — показываю справочник.");
      }
    }, 350);
  };
}

function openPortion(food, date, editIndex) {
  if (!food) return;
  const editing = editIndex != null;
  const drink = !!food.drink;
  const per = { k: food.k, p: food.p, f: food.f, cb: food.cb, fb: food.fb || 0 };
  const waterFrac = Math.max(0, Math.min(1, 1 - ((per.p + per.f + per.cb) / 100)));
  const hy = food.hy || (drink ? 0.9 : 0);
  let unit = food.unit || (drink ? "мл" : "г");
  const startAmt = food.amt != null ? food.amt : (editing && food.g != null ? food.g : 100);

  const step = () => (unit === "мл" ? 25 : 10);
  const chipsFor = () => (unit === "мл" ? [200, 250, 330, 500] : [50, 100, 150, 200, 250]);

  const o = document.createElement("div");
  o.className = "overlay portion-overlay";
  o.innerHTML = `
    <div class="portion-card">
      <div class="eyebrow">${editing ? "Изменить порцию" : "Порция"}</div>
      <div class="portion-name display">${food.n}</div>
      <div class="dim small mono portion-per100">${per.k} ккал · Б ${fmt(per.p)} · Ж ${fmt(per.f)} · У ${fmt(per.cb)}${per.fb ? ` · клет ${fmt(per.fb)}` : ""} на 100 г</div>

      <div class="unit-toggle" role="group" aria-label="Единица измерения">
        <button class="ut" data-u="г">Граммы</button>
        <button class="ut" data-u="мл">Миллилитры</button>
      </div>

      <div class="stepper">
        <button class="stp" id="p-minus" aria-label="Меньше">−</button>
        <div class="stp-mid"><input id="portion-g" inputmode="decimal" value="${startAmt}" aria-label="количество" /><span class="stp-unit" id="p-unit">${unit}</span></div>
        <button class="stp" id="p-plus" aria-label="Больше">+</button>
      </div>

      <div class="portion-chips" id="p-chips"></div>
      <div class="portion-preview" id="p-preview"></div>

      <div class="portion-actions">
        <button class="btn-ghost" id="portion-cancel">Отмена</button>
        <button class="finish-btn" id="portion-add" style="margin-top:0">${editing ? "Сохранить" : "Добавить"}</button>
      </div>
    </div>`;
  overlayRoot.appendChild(o);

  const gInput = o.querySelector("#portion-g");
  const chipsBox = o.querySelector("#p-chips");
  const preview = o.querySelector("#p-preview");
  const unitEl = o.querySelector("#p-unit");
  const getAmt = () => Math.max(0, parseFloat(("" + gInput.value).replace(",", ".")) || 0);

  function drawChips() {
    chipsBox.innerHTML = chipsFor().map((v) => `<button class="pchip" data-g="${v}">${v} ${unit}</button>`).join("");
    chipsBox.querySelectorAll(".pchip").forEach((c) => c.onclick = () => { gInput.value = c.dataset.g; upd(); });
  }
  function upd() {
    const a = getAmt(), m = a / 100;
    const wml = drink ? Math.round(a * waterFrac * hy) : 0;
    o.querySelectorAll(".ut").forEach((b) => b.classList.toggle("on", b.dataset.u === unit));
    unitEl.textContent = unit;
    preview.innerHTML = `
      <div class="pv"><span class="pv-v mono" style="color:${NUT_ACCENT.kcal}">${Math.round(per.k * m)}</span><span class="pv-l">ккал</span></div>
      <div class="pv"><span class="pv-v mono" style="color:${NUT_ACCENT.protein}">${fmt(per.p * m)}</span><span class="pv-l">белок</span></div>
      <div class="pv"><span class="pv-v mono" style="color:${NUT_ACCENT.carbs}">${fmt(per.cb * m)}</span><span class="pv-l">углев</span></div>
      <div class="pv"><span class="pv-v mono" style="color:${NUT_ACCENT.fat}">${fmt(per.f * m)}</span><span class="pv-l">жиры</span></div>
      <div class="pv"><span class="pv-v mono" style="color:${NUT_ACCENT.fiber}">${fmt(per.fb * m)}</span><span class="pv-l">клетч</span></div>
      ${wml ? `<div class="pv"><span class="pv-v mono" style="color:#7fc7d6">${wml}</span><span class="pv-l">вода, мл</span></div>` : ""}`;
  }
  o.querySelectorAll(".ut").forEach((b) => b.onclick = () => { unit = b.dataset.u; drawChips(); upd(); gInput.focus(); });
  o.querySelector("#p-minus").onclick = () => { gInput.value = Math.max(0, Math.round((getAmt() - step()) * 10) / 10); upd(); };
  o.querySelector("#p-plus").onclick = () => { gInput.value = Math.round((getAmt() + step()) * 10) / 10; upd(); };
  gInput.oninput = upd;
  o.querySelector("#portion-cancel").onclick = () => o.remove();
  o.querySelector("#portion-add").onclick = () => {
    const a = getAmt();
    if (a <= 0) { gInput.focus(); return; }
    const rec = { n: food.n, g: a, amt: a, unit, k: per.k, p: per.p, f: per.f, cb: per.cb, fb: per.fb, src: food.src, drink: food.drink, hy: food.hy };
    const d = nutDay(date);
    if (editing) d.items[editIndex] = rec;
    else {
      d.items.push(rec);
      pushRecent({ id: food.id || ("man" + food.n), src: food.src, n: food.n, k: per.k, p: per.p, f: per.f, cb: per.cb, fb: per.fb, drink: food.drink, hy: food.hy });
    }
    save(); o.remove(); render();
  };
  drawChips(); upd();
  setTimeout(() => gInput.select(), 50);
}

/* ================= ХРОНИКИ (прогресс) ================= */
/* ================= анализ пределов силы (потолки/полы, тренды) ================= */
// Методика из лучших практик: 1ПМ = среднее формул Эпли и Бжицки (кап 10 повторов).
// Потолок сессии = лучший рабочий 1ПМ. Пол = худший из «рабочих» подходов (≥80% топ-веса
// сессии — отсекаем разминку и нижние ступени лесенки). В тренд идут только «тяжёлые»
// выходы (потолок ≥90% исторического максимума), чтобы лёгкие/вспомогательные дни не мешали.
const AN = { REP_CAP: 10, WORKSET: 0.8, PLATEAU: 6, HEAVY: 0.9, GROW: 0.01 };
function e1rmAvg(w, r) {
  const reps = Math.min(r, AN.REP_CAP);
  if (!w || !reps) return 0;
  const epley = w * (1 + reps / 30);
  const brzycki = (w * 36) / (37 - reps);
  return (epley + brzycki) / 2;
}
function buildLiftSeries() {
  const series = { bench: [], squat: [], deadlift: [], ohp: [] };
  const sorted = [...S.sessions].sort((a, b) => a.date.localeCompare(b.date));
  for (const s of sorted) {
    const w = WORKOUTS[s.workoutId]; if (!w) continue;
    const perLift = {};
    w.exercises.forEach((ex) => {
      if (!ex.lift) return;
      const sets = (s.entries[ex.id] || []).filter((x) => x.w > 0 && x.r > 0);
      if (sets.length) (perLift[ex.lift] ||= []).push(...sets);
    });
    for (const [lift, sets] of Object.entries(perLift)) {
      const topW = Math.max(...sets.map((x) => x.w));
      const work = sets.filter((x) => x.w >= topW * AN.WORKSET);
      const ceil = Math.max(...work.map((x) => e1rmAvg(x.w, x.r)));
      const floor = Math.min(...work.map((x) => e1rmAvg(x.w, x.r)));
      series[lift] && series[lift].push({ date: s.date, ceil, floor });
    }
  }
  return series;
}
// Ключ движения: базовый лифт (bench/squat/deadlift/ohp) либо id упражнения.
// Так история потолка/пола копится по ОДНОМУ движению между разными квестами.
const movementKey = (ex) => ex.lift || ex.id;
function buildMovementSeries() {
  const series = {};
  const sorted = [...S.sessions].sort((a, b) => a.date.localeCompare(b.date));
  for (const s of sorted) {
    const w = WORKOUTS[s.workoutId]; if (!w) continue;
    const perKey = {};
    w.exercises.forEach((ex) => {
      const sets = (s.entries[ex.id] || []).filter((x) => x.w > 0 && x.r > 0);
      if (sets.length) (perKey[movementKey(ex)] ||= []).push(...sets);
    });
    for (const [key, sets] of Object.entries(perKey)) {
      const topW = Math.max(...sets.map((x) => x.w));
      const work = sets.filter((x) => x.w >= topW * AN.WORKSET);
      const ceil = Math.max(...work.map((x) => e1rmAvg(x.w, x.r)));
      const floor = Math.min(...work.map((x) => e1rmAvg(x.w, x.r)));
      (series[key] ||= []).push({ date: s.date, ceil, floor });
    }
  }
  return series;
}
function trendPctPerMonth(points, key) {
  if (points.length < 3) return null;
  const t0 = new Date(points[0].date + "T00:00:00Z").getTime();
  const xs = points.map((p) => (new Date(p.date + "T00:00:00Z").getTime() - t0) / 864e5);
  const ys = points.map((p) => p[key]);
  const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  if (!den || !my) return null;
  return ((num / den) * 30 / my) * 100;
}
function analyzeLift(pts) {
  if (!pts || pts.length < 2) return null; // нужно ≥2 замеров, чтобы считать пределы
  let running = 0; const heavy = [];
  for (const p of pts) { running = Math.max(running, p.ceil); if (p.ceil >= running * AN.HEAVY) heavy.push(p); }
  const src = heavy.length >= 2 ? heavy : pts;
  const last = src[src.length - 1];
  const bestCeil = Math.max(...src.map((p) => p.ceil));
  const bestFloor = Math.max(...src.map((p) => p.floor));
  let sinceCeil = 0, runCeil = 0, sinceFloor = 0, runFloor = 0;
  for (const p of src) {
    if (p.ceil >= runCeil) { runCeil = p.ceil; sinceCeil = 0; } else sinceCeil++;
    if (p.floor >= runFloor) { runFloor = p.floor; sinceFloor = 0; } else sinceFloor++;
  }
  const tCeil = trendPctPerMonth(src, "ceil");
  const tFloor = trendPctPerMonth(src, "floor");
  let status, cls;
  if (src.length < 3) { status = "Замеры идут — копим данные для тренда"; cls = "verdict-mid"; }
  else if (sinceCeil >= AN.PLATEAU && sinceFloor >= AN.PLATEAU) { status = "Плато — пора делоад и смена стимула"; cls = "verdict-fail"; }
  else if (tFloor != null && tFloor > 0.3 && (tCeil == null || tCeil >= 0)) { status = "Рост — база крепнет, пол ползёт вверх"; cls = "verdict-gold"; }
  else if (tCeil != null && tCeil > 0.3 && tFloor != null && tFloor <= 0) { status = "Потолок без базы — добавь объём в рабочей зоне"; cls = "verdict-mid"; }
  else if (tCeil != null && tCeil < -0.5) { status = "Откат — проверь сон/питание/делоад"; cls = "verdict-fail"; }
  else { status = "Стабильно — в пределах шума, наблюдаем"; cls = "verdict-mid"; }
  return {
    bestCeil, bestFloor, lastCeil: last.ceil, lastFloor: last.floor,
    tCeil, tFloor, sinceCeil, sinceFloor, heavyCount: heavy.length, sessions: pts.length,
    targetCeil: bestCeil * (1 + AN.GROW), targetFloor: bestFloor * (1 + AN.GROW), status, cls,
  };
}
// Целевой блок пределов силы для упражнения квеста (считается из завершённых квестов).
function exTargetHTML(ex, a, count = 0) {
  const loReps = (ex.reps && ex.reps[0]) || 5;
  if (!a) {
    const msg = count >= 1
      ? "◎ Пределы силы: делаем 2-й замер — после него посчитаю потолок и пол"
      : "◎ Пределы силы: 1-й замер — задаём точку отсчёта";
    return `<div class="ex-target neu">${msg}</div>`;
  }
  // вес топ-сета, который на loReps повторов даёт целевой потолок (обратная формула Эпли)
  const topSet = Math.round((a.targetCeil / (1 + loReps / 30)) / 2.5) * 2.5;
  return `<div class="ex-target">
    <span class="et-row"><span class="et-k">потолок</span><b class="mono">${fmt(a.bestCeil)}</b><span class="et-goal mono">цель ≥ ${fmt(a.targetCeil)}</span></span>
    <span class="et-row"><span class="et-k">пол</span><b class="mono">${fmt(a.bestFloor)}</b><span class="et-goal mono">цель ≥ ${fmt(a.targetFloor)}</span></span>
    <span class="et-hint">🎯 топ-сет ≈ <b>${fmt(topSet)} кг × ${loReps}</b>, чтобы двигать потолок</span>
  </div>`;
}

function renderProgress() {
  const liftSeries = {};
  Object.keys(BASELINES).forEach((k) => (liftSeries[k] = []));
  S.sessions.forEach((s) => {
    const w = WORKOUTS[s.workoutId]; if (!w) return;
    w.exercises.forEach((ex) => {
      if (!ex.lift) return;
      let best = 0;
      (s.entries[ex.id] || []).forEach(({ w: wt, r }) => { if (wt && r) best = Math.max(best, epley(wt, Math.min(r, 10))); });
      if (best) liftSeries[ex.lift].push({ date: s.date, v: best });
    });
  });

  // анализ пределов силы (потолки/полы)
  const anSeries = buildLiftSeries();
  const anCards = Object.keys(anSeries).map((k) => {
    const a = analyzeLift(anSeries[k]);
    if (!a) return `
      <div class="limit-card">
        <div class="lc-head"><b>${LIFT_NAMES[k]}</b><span class="dim small">мало данных</span></div>
        <div class="dim small">Нужно ≥2 квеста с этим движением, чтобы считать потолок и пол.</div>
      </div>`;
    const arrow = (t) => t == null ? "—" : (t > 0.3 ? `▲ +${fmt(t)}%/мес` : (t < -0.3 ? `▼ ${fmt(t)}%/мес` : `≈ ${fmt(t)}%/мес`));
    const tcls = (t) => t == null ? "flat" : (t > 0.3 ? "up" : (t < -0.3 ? "down" : "flat"));
    return `
      <div class="limit-card">
        <div class="lc-head"><b>${LIFT_NAMES[k]}</b><span class="lc-status ${a.cls}">${a.status}</span></div>
        <div class="lc-grid">
          <div class="lc-cell">
            <span class="lc-l">Потолок</span>
            <span class="lc-v mono">${fmt(a.bestCeil)} <i>кг</i></span>
            <span class="lc-t ${tcls(a.tCeil)} mono">${arrow(a.tCeil)}</span>
          </div>
          <div class="lc-cell">
            <span class="lc-l">Пол <b class="dim">(главное)</b></span>
            <span class="lc-v mono">${fmt(a.bestFloor)} <i>кг</i></span>
            <span class="lc-t ${tcls(a.tFloor)} mono">${arrow(a.tFloor)}</span>
          </div>
        </div>
        <div class="lc-target mono dim small">Цель месяца: потолок ≥ ${fmt(a.targetCeil)} · пол ≥ ${fmt(a.targetFloor)} кг</div>
        <div class="lc-meta dim small">Рекорд потолка: ${a.sinceCeil === 0 ? "в последнем квесте" : a.sinceCeil + " квестов назад"} · пола: ${a.sinceFloor === 0 ? "в последнем квесте" : a.sinceFloor + " квестов назад"}</div>
      </div>`;
  }).join("");

  app.innerHTML = `
    <p class="dim small" style="margin-top:2px">Хроники прокачки: потолки и полы, которые должны расти от квеста к квесту.</p>
    <svg width="0" height="0"><defs><linearGradient id="goldfade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c9a961" stop-opacity=".35"/><stop offset="1" stop-color="#c9a961" stop-opacity="0"/>
    </linearGradient></defs></svg>

    <div class="panel">
      <div class="eyebrow" style="margin-bottom:10px">Пределы силы</div>
      <div class="limits">${anCards}</div>
      <details class="method">
        <summary>Как это считается</summary>
        <div class="method-body dim small">
          <p><b>1ПМ</b> каждого подхода — среднее формул <b>Эпли</b> и <b>Бжицки</b>, повторы капаются на 10 (выше формулы врут).</p>
          <p><b>Потолок</b> квеста — лучший рабочий 1ПМ. Это «удачный день».</p>
          <p><b>Пол</b> — худший из <b>рабочих</b> подходов (≥80% топ-веса квеста; разминка и низ лесенки отсекаются). Это твоя <b>базовая сила</b> — она важнее потолка: растёт пол → крепнет фундамент.</p>
          <p>В тренд идут только <b>тяжёлые</b> квесты (потолок ≥90% исторического максимума) — лёгкие и вспомогательные дни не смазывают картину. Тренд — наклон линейной регрессии в <b>%/месяц</b>.</p>
          <p><b>Плато</b> — если ${AN.PLATEAU}+ квестов подряд нет нового потолка и пола: пора делоад и смена стимула. Целевой рост продвинутого атлета — <b>≥1%/мес</b>.</p>
        </div>
      </details>
    </div>

    <div class="rune-divider">${runeSVG}</div>
    <div class="eyebrow" style="margin:2px 0 8px">Кривые роста</div>
    <div id="charts"></div>

    <div class="rune-divider">${runeSVG}</div>
    <div class="panel">
      <div class="eyebrow" style="margin-bottom:8px">Последние квесты</div>
      <div id="log"></div>
    </div>`;

  const charts = document.getElementById("charts");
  Object.entries(liftSeries).forEach(([k, arr]) => {
    const base = BASELINES[k];
    const pts = [{ date: "база", v: base }, ...arr];
    const last = pts[pts.length - 1].v;
    const d = last - base;
    const card = document.createElement("div");
    card.className = "panel chart-card";
    card.innerHTML = `
      <div class="head">
        <b>${LIFT_NAMES[k]}</b>
        <span class="delta ${d > 0.5 ? "up" : "flat"} mono">${fmt(last)} кг ${d > 0.5 ? "▲ +" + fmt(d) : ""}</span>
      </div>
      ${arr.length ? sparkline(pts.map((p) => p.v)) : `<div class="empty">Пока пусто. Первый квест впишет сюда строку.</div>`}`;
    charts.appendChild(card);
  });

  const log = document.getElementById("log");
  const rows = [...S.sessions].reverse().slice(0, 20);
  log.innerHTML = rows.length
    ? rows.map((s) => `<button class="log-row" data-sid="${s.id}">
        <span>${WORKOUTS[s.workoutId]?.boss || s.workoutId}</span>
        <span class="dim mono small">${fmtDate(s.date)}</span>
        <span class="${s.cls} mono">${s.score}% ›</span></button>`).join("")
    : `<div class="empty">Летопись чиста, странник.</div>`;
  log.querySelectorAll(".log-row").forEach((r) => r.onclick = () => showSessionDetail(r.dataset.sid));
}

function sparkline(values) {
  const W = 320, H = 64, pad = 6;
  const min = Math.min(...values) * 0.98, max = Math.max(...values) * 1.02;
  const x = (i) => pad + (i * (W - 2 * pad)) / Math.max(1, values.length - 1);
  const y = (v) => H - pad - ((v - min) / Math.max(0.001, max - min)) * (H - 2 * pad);
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(values.length - 1).toFixed(1)},${H - pad} L${pad},${H - pad} Z`;
  const lastX = x(values.length - 1), lastY = y(values[values.length - 1]);
  return `<svg class="sparkline" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <path class="area" d="${area}"/><path class="line" d="${line}"/>
    <circle cx="${lastX}" cy="${lastY}" r="3"/></svg>`;
}

/* ================= старт ================= */
render();
