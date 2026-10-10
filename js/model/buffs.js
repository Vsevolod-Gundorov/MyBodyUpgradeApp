// Модель: каталог добавок, расписание приёма и запасы.
import { SLOT_TIMES, hhmmToMin } from "../../data/reminders.js";
import { today } from "../core/format.js";
import { S } from "./store.js";

/* ================= баффы: арсенал натурального атлета ================= */
// Только легальные, натуральные добавки. dose = число, unit = единица, times = слоты приёма.
export const BUFF_CATS = ["Сила и мощь", "Пампинг и выносливость", "Белок и рост", "Восстановление и здоровье"];

export const BUFF_SLOTS = ["Утро", "День", "До трен.", "После трен.", "Вечер", "Перед сном"];

export const BUFFS = [
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

export const BUFF_BY_ID = Object.fromEntries(BUFFS.map((b) => [b.id, b]));

export const BUFF_CHECK_DAYS = 30; // раз в месяц — напоминание «Проверить баффы!»

export const LOW_STOCK_DAYS = 10;  // предупреждать, когда запаса ≤ стольких дней

// все баффы = встроенные + пользовательские
export const allBuffs = () => [...BUFFS, ...((S.buffs && S.buffs.custom) || [])];

export const buffById = (id) => allBuffs().find((b) => b.id === id);

/* --- авто-подбор фэнтезийного имени/иконки/единиц по реальному названию добавки --- */
export const SUPP_DB = [
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

export const NAME_POOLS = {
  "Сила и мощь": ["Гнев Молота", "Клык Зверя", "Молот Титана", "Рёв Берсерка", "Пламя Ярости"],
  "Пампинг и выносливость": ["Прилив Крови", "Ветер Степей", "Пульс Бури", "Река Силы", "Дыхание Ветра"],
  "Белок и рост": ["Дар Плоти", "Камень Роста", "Хлеб Исполина", "Зерно Силы", "Плоть Титана"],
  "Восстановление и здоровье": ["Роса Заката", "Тихий Родник", "Мшистый Оберег", "Печать Покоя", "Лунная Роса", "Оберег Хранителя"],
};

export const CAT_ICON = { "Сила и мощь": "muscle", "Пампинг и выносливость": "droplet", "Белок и рост": "flask", "Восстановление и здоровье": "leaf" };

export function guessCat(s) {
  if (/сон|мелатонин|стресс|кортизол|адаптоген|витамин|минерал|магни|цинк|железо|кальци|омега|сустав|иммунит|коллаген|антиоксид|пробиотик|d3|k2/i.test(s)) return "Восстановление и здоровье";
  if (/белок|протеин|амино|bcaa|eaa|казеин|гейнер|масса|рост|глютамин/i.test(s)) return "Белок и рост";
  if (/пампинг|оксид|азот|выносл|карнитин|электролит|цитруллин|аргинин|таурин/i.test(s)) return "Пампинг и выносливость";
  if (/сила|энерг|кофеин|предтрен|креатин|мощ|фокус|гуарана|бета.?аланин/i.test(s)) return "Сила и мощь";
  return "Восстановление и здоровье";
}

export function guessUnit(s) {
  if (/витамин\s?d|vitamin\s?d|\bd3\b|k2/i.test(s)) return "МЕ";
  if (/мультивитам|multivit|гейнер|gainer|предтрен|pre.?workout|порош|комплекс/i.test(s)) return "порция";
  if (/капс|caps|таблет|tablet|пробиотик/i.test(s)) return "капс.";
  if (/\bмл\b|\bml\b|капл|сироп/i.test(s)) return "мл";
  if (/протеин|protein|креатин|creatine|глютамин|glutamine|bcaa|бцаа|eaa|эаа|цитруллин|аргинин|бета.?аланин|карнитин|carnitine|коллаген|collagen|таурин|taurine|клетчатк|fiber|омега|omega|масло|казеин/i.test(s)) return "г";
  return "мг";
}

// подобрать имя из пула, не занятое другими баффами (offset — для «другого облика»)
export function pickPoolName(cat, offset = 0) {
  const pool = NAME_POOLS[cat] || NAME_POOLS["Восстановление и здоровье"];
  const used = new Set(allBuffs().map((b) => b.name));
  const free = pool.filter((n) => !used.has(n));
  const arr = free.length ? free : pool;
  return arr[offset % arr.length];
}

// по реальному названию → {name, icon, unit, cat, effect, times, hint}
export function autoBuffFromReal(real, offset = 0) {
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

export const doseStr = (b, val) => { const d = (val != null ? val : b.dose); return b.unit ? `${d} ${b.unit}` : `${d}`; };

/* дней с последней проверки арсенала; null == не проверяли ни разу */
export function buffsDaysSince() {
  const at = S.buffs?.checkedAt;
  if (!at) return null;
  return Math.floor((Date.now() - new Date(at).getTime()) / 864e5);
}

export function buffsDue() {
  const d = buffsDaysSince();
  return d === null || d >= BUFF_CHECK_DAYS;
}

/* ================= БАФФЫ (арсенал добавок) ================= */
/* --- хелперы приёма и запасов --- */
export const buffTimes = (b) => (b && b.times && b.times.length ? b.times : ["Утро"]);

export const dosesPerDay = (b) => buffTimes(b).length || 1;

export function currentSlot() { const h = new Date().getHours(); if (h >= 5 && h < 11) return "Утро"; if (h >= 11 && h < 16) return "День"; if (h >= 16 && h < 21) return "Вечер"; return "Перед сном"; }

/**
 * Есть ли дело прямо сейчас: наступил час приёма, а он не отмечен, или запас
 * на исходе (≤ 3 дней). Только тогда вкладка подсвечивается — без вечной точки.
 */
export function buffsActionable(now = new Date()) {
  const active = (S.buffs && S.buffs.active) || {};
  const list = allBuffs().filter((b) => active[b.id] != null);
  if (!list.length) return false;
  const log = (S.buffs.log && S.buffs.log[today()]) || {};
  const min = now.getHours() * 60 + now.getMinutes();
  const at = (slot) => hhmmToMin((S.reminders && S.reminders.times && S.reminders.times[slot]) || SLOT_TIMES[slot]);
  const due = list.some((b) => buffTimes(b).some((slot) => SLOT_TIMES[slot] && at(slot) <= min && !log[`${b.id}@${slot}`]));
  const low = list.some((b) => { const d = stockDaysLeft(b); return d != null && d <= 3; });
  return due || low;
}

export function stockDaysLeft(b) { const s = S.buffs.stock ? S.buffs.stock[b.id] : null; return (typeof s === "number") ? Math.floor(s / dosesPerDay(b)) : null; }

export function toggleTaken(id, slot, force) {
  const date = today();
  if (!S.buffs.log[date]) S.buffs.log[date] = {};
  const k = `${id}@${slot}`, cur = !!S.buffs.log[date][k];
  const next = force == null ? !cur : force;
  if (next === cur) return;
  if (next) { S.buffs.log[date][k] = true; if (typeof S.buffs.stock[id] === "number") S.buffs.stock[id] = Math.max(0, S.buffs.stock[id] - 1); }
  else { delete S.buffs.log[date][k]; if (typeof S.buffs.stock[id] === "number") S.buffs.stock[id] += 1; }
}

export const DATALIST_SUPPS = ["Креатин моногидрат", "Сывороточный протеин", "Кофеин", "Цитруллин малат", "L-Аргинин", "Бета-аланин", "Омега-3 (рыбий жир)", "Витамин D3", "Магний", "Цинк", "Витамин C", "Мультивитамины", "Ашваганда", "Таурин", "BCAA", "EAA", "Глютамин", "Мелатонин", "Коллаген", "Казеин", "Гейнер", "Родиола", "Куркумин", "Железо", "Витамин B12", "Глюкозамин", "Пробиотик", "Клетчатка", "Электролиты", "Кальций", "L-Карнитин", "Гуарана", "Предтреник"];
