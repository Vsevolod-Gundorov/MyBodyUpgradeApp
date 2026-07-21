import { PROGRAM, BASELINES, LIFT_NAMES } from "../data/program.js";
import { NUTRITION, FOODS, FOOD_CATS, WATER_TARGET_ML, offSearch } from "../data/nutrition.js";

/* ================= иконки (внутренняя SVG-разметка, fill = currentColor) ================= */
const ICONS = {
  // тренировки
  anvil: `<path d="M2 8h10c0 2-1.6 2.9-3.6 3L7 14h8l1.9 3.4H5.7L4 13.9C2.9 13.4 2 12.1 2 10.6V8z"/><rect x="16.4" y="8" width="4.6" height="1.9" rx=".5"/><rect x="6.6" y="18" width="8.8" height="2.7" rx=".9"/>`,
  pillars: `<rect x="3.5" y="3" width="17" height="2.4" rx=".5"/><rect x="5.5" y="6.2" width="2.6" height="9.6"/><rect x="10.7" y="6.2" width="2.6" height="9.6"/><rect x="15.9" y="6.2" width="2.6" height="9.6"/><rect x="3.5" y="16.6" width="17" height="3" rx=".6"/>`,
  mountain: `<path d="M2 20L8.6 6.5l3.6 6.6 2.1-3.1L22 20H2z"/><circle cx="17.3" cy="6.6" r="2.4"/>`,
  spine: `<rect x="9.7" y="2.6" width="4.6" height="2.3" rx="1.1"/><rect x="9.3" y="5.8" width="5.4" height="2.3" rx="1.1"/><rect x="9.7" y="9" width="4.6" height="2.3" rx="1.1"/><rect x="9.3" y="12.2" width="5.4" height="2.3" rx="1.1"/><rect x="9.7" y="15.4" width="4.6" height="2.3" rx="1.1"/><rect x="9.3" y="18.6" width="5.4" height="2.3" rx="1.1"/>`,
  dagger: `<path d="M12 1.5l2.1 5.3v8.4l-2.1 3.6-2.1-3.6V6.8L12 1.5z"/><rect x="7.6" y="15" width="8.8" height="1.9" rx=".6"/><rect x="11" y="16.6" width="2" height="4.4" rx=".4"/>`,
  tower: `<path d="M4 9.2V5.2h2.2v1.9h1.8V5.2h2.2v1.9h1.6V5.2h2.2v1.9h1.8V5.2H20v4H4z"/><path d="M5 9.2h14V21H5z"/><rect x="9.4" y="13.4" width="5.2" height="7.6" rx=".4" fill="#171307"/>`,
  sun: `<circle cx="12" cy="12" r="4.4"/><g><rect x="11" y="1.2" width="2" height="3.4" rx="1"/><rect x="11" y="19.4" width="2" height="3.4" rx="1"/><rect x="1.2" y="11" width="3.4" height="2" rx="1"/><rect x="19.4" y="11" width="3.4" height="2" rx="1"/><rect x="3.6" y="4.4" width="2" height="3.3" rx="1" transform="rotate(-45 4.6 6)"/><rect x="18.4" y="16.3" width="2" height="3.3" rx="1" transform="rotate(-45 19.4 18)"/><rect x="18.4" y="4.4" width="2" height="3.3" rx="1" transform="rotate(45 19.4 6)"/><rect x="3.6" y="16.3" width="2" height="3.3" rx="1" transform="rotate(45 4.6 18)"/></g>`,
  hourglass: `<rect x="4.6" y="2.2" width="14.8" height="1.9" rx=".6"/><rect x="4.6" y="19.9" width="14.8" height="1.9" rx=".6"/><path d="M6 4.4h12v1.9l-5 5.7 5 5.7v1.9H6v-1.9l5-5.7-5-5.7V4.4z"/>`,
  wings: `<path d="M12 5.2c-2 4.1-5.2 6.2-9.4 6.2 2.1 3.1 5.3 4.1 8.4 3l1 4.4 1-4.4c3.1 1.1 6.3.1 8.4-3-4.2 0-7.4-2.1-9.4-6.2z"/>`,
  tree: `<circle cx="12" cy="7.4" r="5"/><path d="M11 11.2h2v4.4l3.4 4.4-4.4-2.2-4.4 2.2 3.4-4.4v-4.4z"/>`,
  flame: `<path d="M12 2c1 3.2 5 5 5 9.2A5 5 0 0 1 7 11.2c0-2.1 1-3.2 2.1-4.2 0 1.1.5 2.1 1.6 2.1.6 0 1-.6 1-1.6 0-2.1-1.1-4.1.3-5.5z"/>`,
  peak: `<path d="M2 20.5L8.4 7l3.6 6.6 2.1-3.1L22 20.5H2z"/><rect x="11.3" y="2" width="1.4" height="6.2"/><path d="M12.7 2.6l4.4 1.3-4.4 1.3z"/>`,
  // характеристики
  hammer: `<rect x="11.5" y="2.6" width="8.4" height="4.2" rx="1" transform="rotate(45 15.7 4.7)"/><rect x="2.6" y="14.8" width="12.4" height="2.7" rx="1.1" transform="rotate(-45 8.8 16.1)"/>`,
  bolt: `<path d="M13 2L4 13.6h6l-1 8.4 9-12h-6l1-8z"/>`,
  layers: `<path d="M12 2.2l9.2 4.1-9.2 4.1-9.2-4.1L12 2.2z"/><path d="M2.8 11l9.2 4.1 9.2-4.1 1 1.7-10.2 4.5L1.8 12.7l1-1.7z"/><path d="M2.8 15.4l9.2 4.1 9.2-4.1 1 1.7-10.2 4.5-10.2-4.5 1-1.7z"/>`,
  shield: `<path d="M12 2l8 3v6c0 5-3.5 8.6-8 11-4.5-2.4-8-6-8-11V5l8-3z"/>`,
  gem: `<path d="M12 2l6 6-6 14L6 8l6-6z"/>`,
  // баффы / добавки
  flask: `<path d="M9 2h6v2h-1v4.3l4.7 8.6A2 2 0 0 1 16.9 20H7.1a2 2 0 0 1-1.8-3.1L10 8.3V4H9V2zm1 7.6L8 13h8l-2-3.4V4h-4v5.6z"/>`,
  droplet: `<path d="M12 2.5c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z"/>`,
  moon: `<path d="M14.5 3A9 9 0 1 0 21 16.6 7 7 0 0 1 14.5 3z"/>`,
  leaf: `<path d="M20 4C10 4 4 11 4 20c9 0 16-6 16-16z"/><path d="M7.5 17.2l7-7 1.3 1.3-7 7z"/>`,
  heart: `<path d="M12 21C5 15 3 11 3 8a4.6 4.6 0 0 1 9-1 4.6 4.6 0 0 1 9 1c0 3-2 7-9 13z"/>`,
  capsule: `<path d="M4 12.5l8.5-8.5a4.6 4.6 0 0 1 6.5 6.5L10.5 19a4.6 4.6 0 0 1-6.5-6.5zm5 5l5-5-6-6-5 5 6 6z"/>`,
  potion: `<path d="M10 2h4v3.2l3 2.3A6 6 0 1 1 7 7.5l3-2.3V2zm-1 8.5A4 4 0 1 0 15 10l-1-.8H10l-1 .8z"/>`,
  // ресурсы / питание
  apple: `<path d="M12 7.2c-1.4-1.9-3.8-2.3-5.4-1C4.7 7.7 4.6 11 6 14.4 7 16.7 8.5 19 10.4 19c.6 0 1-.2 1.6-.2s1 .2 1.6.2c1.9 0 3.4-2.3 4.4-4.6 1.4-3.4 1.3-6.7-.6-8.2-1.6-1.3-4-.9-5.4 1z"/><path d="M12.2 6.4c0-1.6 1.2-2.9 3-3.1-.1 1.7-1.3 3-3 3.1z"/>`,
  drumstick: `<path d="M13.8 3.4a5.4 5.4 0 0 0-4 9l-3.1 3.1a2.6 2.6 0 1 0 1.7 1.7l3.1-3.1a5.4 5.4 0 1 0 2.3-10.7zM6 16.4l-1.5 1.5a1.5 1.5 0 1 0 2.1 2.1L8.1 18.5z"/>`,
  wheat: `<rect x="11.4" y="4" width="1.2" height="17" rx=".6"/><path d="M11.4 5.6c-2.2-.5-3.8.6-3.8 2.8 2.2.5 3.8-.6 3.8-2.8zM12.6 5.6c2.2-.5 3.8.6 3.8 2.8-2.2.5-3.8-.6-3.8-2.8zM11.4 9.8c-2.2-.5-3.8.6-3.8 2.8 2.2.5 3.8-.6 3.8-2.8zM12.6 9.8c2.2-.5 3.8.6 3.8 2.8-2.2.5-3.8-.6-3.8-2.8zM11.4 14c-2.2-.5-3.8.6-3.8 2.8 2.2.5 3.8-.6 3.8-2.8zM12.6 14c2.2-.5 3.8.6 3.8 2.8-2.2.5-3.8-.6-3.8-2.8z"/>`,
  avocado: `<path d="M12 2.6c3 0 5.2 3.2 5.2 8.2S15 21.4 12 21.4 6.8 15.8 6.8 10.8 9 2.6 12 2.6z"/><circle cx="12" cy="15" r="2.7" fill="#171307"/>`,
};
const icon = (name, cls = "") => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ""}</svg>`;
// какая иконка у какой характеристики
const STAT_ICONS = { СИЛА: "hammer", МОЩЬ: "bolt", ВЫНОСЛ: "flame", ОБЪЁМ: "layers", ДИСЦИПЛ: "shield", СТОЙКОСТЬ: "gem" };

/* ================= баффы: арсенал натурального атлета ================= */
// Только легальные, натуральные добавки. dose — доза по умолчанию при активации.
const BUFF_CATS = ["Сила и мощь", "Пампинг и выносливость", "Белок и рост", "Восстановление и здоровье"];
const BUFFS = [
  { id: "creatine",  name: "Эликсир Силы",       real: "Креатин моногидрат",   icon: "flask",   dose: "5 г",       effect: "АТФ, сила, объём мышц", cat: "Сила и мощь" },
  { id: "betaala",   name: "Ярость Карнозина",   real: "Бета-аланин",          icon: "flame",   dose: "4 г",       effect: "буфер кислоты, многоповтор", cat: "Сила и мощь" },
  { id: "caffeine",  name: "Искра Ярости",       real: "Кофеин",               icon: "bolt",    dose: "150 мг",    effect: "фокус, сила, бодрость (до трен.)", cat: "Сила и мощь" },
  { id: "arginine",  name: "Дыхание Пампа",      real: "L-Аргинин",            icon: "droplet", dose: "7 г",       effect: "оксид азота, пампинг", cat: "Пампинг и выносливость" },
  { id: "citrulline",name: "Кровь Титана",       real: "Цитруллин малат",      icon: "heart",   dose: "6 г",       effect: "кровоток, выносливость, пампинг", cat: "Пампинг и выносливость" },
  { id: "electro",   name: "Соли Странника",     real: "Электролиты (Na/K)",   icon: "potion",  dose: "по нужде",  effect: "гидратация, судороги", cat: "Пампинг и выносливость" },
  { id: "whey",      name: "Нектар Роста",       real: "Сывороточный протеин", icon: "flask",   dose: "30 г",      effect: "белок, синтез мышц", cat: "Белок и рост" },
  { id: "omega3",    name: "Масло Левиафана",    real: "Омега-3 (рыбий жир)",  icon: "droplet", dose: "2 г EPA/DHA", effect: "суставы, сердце, восстановление", cat: "Восстановление и здоровье" },
  { id: "vitd",      name: "Свет Солнца",        real: "Витамин D3",           icon: "sun",     dose: "3000 МЕ",   effect: "гормоны, кости, иммунитет", cat: "Восстановление и здоровье" },
  { id: "mag",       name: "Камень Покоя",       real: "Магний (глицинат)",    icon: "moon",    dose: "350 мг",    effect: "сон, мышцы, нервы", cat: "Восстановление и здоровье" },
  { id: "zinc",      name: "Печать Тестостерона",real: "Цинк",                 icon: "gem",     dose: "25 мг",     effect: "гормоны, иммунитет", cat: "Восстановление и здоровье" },
  { id: "vitc",      name: "Щит Аскорбия",       real: "Витамин C",            icon: "shield",  dose: "1000 мг",   effect: "антиоксидант, иммунитет", cat: "Восстановление и здоровье" },
  { id: "multi",     name: "Венец Изобилия",     real: "Мультивитамины",       icon: "capsule", dose: "1 порция",  effect: "база микронутриентов", cat: "Восстановление и здоровье" },
  { id: "ashwa",     name: "Корень Спокойствия", real: "Ашваганда",            icon: "leaf",    dose: "500 мг",    effect: "кортизол, стресс, сон", cat: "Восстановление и здоровье" },
];
const BUFF_BY_ID = Object.fromEntries(BUFFS.map((b) => [b.id, b]));
const BUFF_CHECK_DAYS = 30; // раз в месяц — напоминание «Проверить баффы!»

/* ================= состояние (БД = localStorage + экспорт в JSON-файл) ================= */
const DB_KEY = "bodyupgrade.v1";

const defaultState = () => ({
  hero: { name: "Всеволод", title: "Кузнец Собственного Тела", bodyweight: 93 },
  xp: 0,
  sessions: [], // { id, workoutId, date, verdict, score, xp, entries: { exId: [{w, r}] } }
  drafts: {},   // workoutId -> entries (незавершённые)
  buffs: {
    active: { creatine: "10 г", arginine: "7 г" }, // id -> доза
    checkedAt: null,                                // ISO даты последней проверки арсенала
  },
  nutrition: {
    log: {},     // date -> { dayType: "training"|"rest", items: [{n,g,k,p,f,cb,fb,src}], water: 0 }
    recent: [],  // недавно использованные продукты (макс. 12)
  },
});

let S = load();
function load() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return Object.assign(defaultState(), JSON.parse(raw));
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
  if (score >= 85) { verdict = "Испытание пройдено"; cls = "verdict-gold"; flavor = "Кузница приняла твою работу. Сталь стала крепче."; }
  else if (score >= 60) { verdict = "Достойно, но не всё"; cls = "verdict-mid"; flavor = "Огонь горел, но не все угли прогорели. В следующий раз — до конца."; }
  else { verdict = "Схалтурил, странник"; cls = "verdict-fail"; flavor = "Молот едва коснулся наковальни. Кузница помнит всё."; }
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

  return { level, lvlProgress, lifts, stats: { СИЛА: str, МОЩЬ: pow, ВЫНОСЛ: endr, ОБЪЁМ: vol, ДИСЦИПЛ: disc, СТОЙКОСТЬ: grit } };
}

function nextWorkoutId() {
  const done = new Set();
  S.sessions.forEach((s) => done.add(s.workoutId));
  // следующая по порядку с наименьшим числом прохождений
  const counts = ORDER.map((id) => S.sessions.filter((s) => s.workoutId === id).length);
  const min = Math.min(...counts);
  const idx = counts.indexOf(min);
  return ORDER[idx];
}

/* ================= роутинг ================= */
const app = document.getElementById("app");
const overlayRoot = document.getElementById("overlay-root");
const VIEWS = ["profile", "cycle", "buffs", "resources", "progress"];
let view = VIEWS.includes((location.hash || "").slice(1)) ? location.hash.slice(1) : "profile";

document.querySelectorAll(".tab").forEach((t) =>
  t.addEventListener("click", () => { view = t.dataset.view; render(); })
);

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

  app.innerHTML = `
    <div class="hero-head">
      <div class="eyebrow">Кузница Тела · ${PROGRAM.cycleName}</div>
      <h1 class="display hero-name">${S.hero.name}</h1>
      <div class="hero-title">«${S.hero.title}»</div>
      <div class="level-ring">
        <svg viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(201,169,97,.15)" stroke-width="5"/>
          <circle cx="60" cy="60" r="52" fill="none" stroke="#c9a961" stroke-width="5"
            stroke-linecap="round" stroke-dasharray="${ring}" stroke-dashoffset="${ring * (1 - h.lvlProgress)}"/>
        </svg>
        <div class="lvl"><b>${h.level}</b><span>уровень</span></div>
      </div>
      <div class="dim small mono">${S.xp} XP · походов в кузницу: ${S.sessions.length}</div>
    </div>

    <div class="rune-divider">${runeSVG}</div>

    <div class="panel panel--ornate">
      <div class="eyebrow" style="margin-bottom:12px">Характеристики</div>
      <div class="statgrid">
        ${Object.entries(h.stats).map(([k, v]) => `
          <div class="stat">
            <span class="stat-ico">${icon(STAT_ICONS[k] || "gem")}</span>
            <span class="label">${k}</span>
            <span class="bar"><i style="width:${v}%"></i></span>
            <span class="val mono">${v}</span>
          </div>`).join("")}
      </div>
    </div>

    <div class="panel">
      <div class="eyebrow" style="margin-bottom:8px">Оружие героя · расчётный 1ПМ</div>
      ${Object.entries(h.lifts).map(([k, v]) => {
        const d = v.cur - v.base;
        return `<div class="kv"><span>${LIFT_NAMES[k]}</span>
          <span class="mono">${fmt(v.cur)} кг ${d > 0.5 ? `<span class="verdict-gold">+${fmt(d)}</span>` : `<span class="dim">база</span>`}</span></div>`;
      }).join("")}
      <div class="kv"><span>Вес героя</span><span class="mono">${bw} кг</span></div>
    </div>

    <div class="panel">
      <div class="eyebrow" style="margin-bottom:10px">Свиток данных</div>
      <div class="grid2">
        <button class="btn-ghost" id="btn-export">Экспорт JSON</button>
        <button class="btn-ghost" id="btn-import">Импорт JSON</button>
      </div>
      <input type="file" id="file-import" accept="application/json" hidden />
    </div>`;

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

/* ================= КУЗНИЦА (цикл) ================= */
function renderCycle() {
  const nextId = nextWorkoutId();
  app.innerHTML = `
    <div class="eyebrow">Кузница · план-факт</div>
    <h1 class="display">Путь цикла</h1>
    <p class="dim small" style="margin-top:4px">3 похода в неделю. Порядок 1→12 не ломать — чередование верх/низ хранит само себя.</p>
    ${PROGRAM.weeks.map((wk) => `
      <div class="week-block">
        <div class="week-tag ${wk.type === "объёмная" ? "vol" : ""}">
          <span class="dot"></span> Неделя ${wk.n} — ${wk.type} · ${wk.pattern}
        </div>
        ${wk.saga ? `<div class="saga display">${wk.saga}</div>` : ""}
        ${wk.workouts.map((w) => {
          const done = S.sessions.filter((s) => s.workoutId === w.id);
          const last = done[done.length - 1];
          const isNext = w.id === nextId;
          return `
          <button class="wcard ${last ? "done" : ""} ${isNext ? "next" : ""}" data-w="${w.id}">
            <span class="medallion">${icon(w.icon || "anvil")}</span>
            <span class="wcard-body">
              <span class="row1">
                <span class="boss">${w.boss}${isNext ? ' <span class="verdict-gold small">◈ след.</span>' : ""}</span>
                ${last ? `<span class="verdict-chip ${last.cls}">${last.score}%</span>` : `<span class="dim small">—</span>`}
              </span>
              <span class="sub">${w.title} · ${w.exercises.length} упражнений${last ? ` · был ${fmtDate(last.date)}` : ""}</span>
            </span>
          </button>`;
        }).join("")}
      </div>`).join("")}`;

  app.querySelectorAll(".wcard").forEach((c) => c.addEventListener("click", () => renderWorkout(c.dataset.w)));
}

/* ================= ЭКРАН ТРЕНИРОВКИ ================= */
function renderWorkout(wid) {
  const w = WORKOUTS[wid];
  const entries = S.drafts[wid] || {};
  // предзаполнение из последней сессии этого workout
  const lastSession = [...S.sessions].reverse().find((s) => s.workoutId === wid);

  app.innerHTML = `
    <div class="topbar">
      <button class="back-btn" id="back"><svg viewBox="0 0 24 24"><path d="M15 4l-8 8 8 8V4z"/></svg></button>
      <span class="medallion medallion--lg">${icon(w.icon || "anvil")}</span>
      <div>
        <div class="eyebrow">${WEEK_OF[wid].type === "объёмная" ? "объёмная" : "силовая"} · неделя ${WEEK_OF[wid].n}</div>
        <h2 class="display">${w.boss}</h2>
        <div class="dim small">${w.title}</div>
      </div>
    </div>
    <div id="ex-list"></div>
    <button class="finish-btn" id="finish">Завершить испытание</button>`;

  document.getElementById("back").onclick = () => { view = "cycle"; render(); };

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
        row.querySelector(".del").onclick = () => { arr.splice(si, 1); save(); drawSets(); upd(); };
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
    if (!anySets) { alert("Кузница пуста: запиши хотя бы один подход."); return; }
    const res = scoreSession(w, e);
    S.sessions.push({ id: crypto.randomUUID(), workoutId: wid, date: today(), verdict: res.verdict, cls: res.cls, score: res.score, xp: res.xp, entries: e });
    S.xp += res.xp;
    delete S.drafts[wid];
    save();
    showVerdict(res);
  };
}

function showVerdict(res) {
  const o = document.createElement("div");
  o.className = "overlay";
  o.innerHTML = `
    <div>
      <div class="seal"><svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="44" fill="none" stroke="${res.cls === "verdict-fail" ? "#b4543a" : "#c9a961"}" stroke-width="1.5"/>
        <path d="M50 14l9 18 20 3-14.5 14 3.5 20-18-9.5L32 69l3.5-20L21 35l20-3z"
          fill="none" stroke="${res.cls === "verdict-fail" ? "#b4543a" : "#e8cd82"}" stroke-width="1.5"/>
      </svg></div>
      <div class="v-title ${res.cls}">${res.verdict}</div>
      <div class="v-sub">${res.flavor}</div>
      <div class="v-xp">Счёт ${res.score}% · подходы ${res.doneSets}/${res.plannedSets} · +${res.xp} XP</div>
      <button class="v-close">Вернуться на путь</button>
    </div>`;
  overlayRoot.appendChild(o);
  o.querySelector(".v-close").onclick = () => { o.remove(); view = "cycle"; render(); };
}

/* ================= БАФФЫ (арсенал добавок) ================= */
function renderBuffs() {
  const active = S.buffs?.active || {};
  const activeIds = BUFFS.filter((b) => active[b.id]).map((b) => b.id);
  const days = buffsDaysSince();
  const due = buffsDue();

  const reminder = due
    ? `<div class="buff-reminder due">
         <div class="br-ico">${icon("hourglass")}</div>
         <div class="br-body">
           <b>Проверить баффы!</b>
           <span class="dim small">${days === null ? "Арсенал ещё не сверялся." : `Прошло ${days} дн. с последней сверки.`} Что заканчивается, что обновить, что добавить?</span>
         </div>
         <button class="br-ok" id="buff-check">Сверено</button>
       </div>`
    : `<div class="buff-reminder ok">
         <div class="br-ico">${icon("shield")}</div>
         <div class="br-body">
           <b>Арсенал сверен</b>
           <span class="dim small">Следующая проверка через ${BUFF_CHECK_DAYS - days} дн.</span>
         </div>
       </div>`;

  const activeCards = activeIds.length
    ? activeIds.map((id) => {
        const b = BUFF_BY_ID[id];
        return `<div class="buff active" data-id="${id}">
          <span class="medallion">${icon(b.icon)}</span>
          <span class="buff-body">
            <span class="buff-top"><b class="buff-name">${b.name}</b><span class="buff-dose mono">${active[id]}</span></span>
            <span class="buff-real dim small">${b.real} · ${b.effect}</span>
          </span>
          <button class="buff-toggle off" title="Снять бафф" aria-label="Снять бафф">✕</button>
        </div>`;
      }).join("")
    : `<div class="empty">Ни одного активного баффа. Загляни в Арсенал ниже.</div>`;

  const arsenal = BUFF_CATS.map((cat) => {
    const items = BUFFS.filter((b) => b.cat === cat);
    return `<div class="buff-cat">
      <div class="week-tag" style="margin:14px 0 4px"><span class="dot"></span> ${cat}</div>
      ${items.map((b) => {
        const on = !!active[b.id];
        return `<div class="buff arsenal ${on ? "on" : ""}" data-id="${b.id}">
          <span class="medallion">${icon(b.icon)}</span>
          <span class="buff-body">
            <span class="buff-top"><b class="buff-name">${b.name}</b><span class="buff-dose mono dim">${b.dose}</span></span>
            <span class="buff-real dim small">${b.real} · ${b.effect}</span>
          </span>
          <button class="buff-toggle ${on ? "off" : "add"}" aria-label="${on ? "Снять" : "Активировать"}">${on ? "✓" : "+"}</button>
        </div>`;
      }).join("")}
    </div>`;
  }).join("");

  app.innerHTML = `
    <div class="eyebrow">Баффы · арсенал натурального атлета</div>
    <h1 class="display">Зелья и печати</h1>
    <p class="dim small" style="margin-top:4px">Только натуральное и легальное. Раз в месяц — сверка арсенала.</p>

    ${reminder}

    <div class="rune-divider">${runeSVG}</div>
    <div class="eyebrow" style="margin-bottom:6px">Активные баффы · ${activeIds.length}</div>
    <div id="active-buffs">${activeCards}</div>

    <div class="rune-divider">${runeSVG}</div>
    <div class="eyebrow" style="margin-bottom:2px">Арсенал</div>
    <p class="dim small" style="margin-bottom:2px">Нажми, чтобы активировать или снять бафф.</p>
    ${arsenal}`;

  const check = document.getElementById("buff-check");
  if (check) check.onclick = () => { if (!S.buffs) S.buffs = { active: {}, checkedAt: null }; S.buffs.checkedAt = today(); save(); render(); };

  app.querySelectorAll(".buff[data-id]").forEach((el) => {
    const id = el.dataset.id;
    const toggle = el.querySelector(".buff-toggle");
    if (toggle) toggle.onclick = (e) => {
      e.stopPropagation();
      if (!S.buffs) S.buffs = { active: {}, checkedAt: null };
      if (S.buffs.active[id]) delete S.buffs.active[id];
      else S.buffs.active[id] = BUFF_BY_ID[id].dose;
      save(); render();
    };
  });
}

/* ================= РЕСУРСЫ (снабжение / питание) ================= */
const NUT_ICON = { kcal: "flame", protein: "drumstick", carbs: "wheat", fat: "avocado" };

function nutDay(date) {
  if (!S.nutrition) S.nutrition = { log: {}, recent: [] };
  if (!S.nutrition.log[date]) {
    const trainedToday = S.sessions.some((s) => s.date === date);
    S.nutrition.log[date] = { dayType: trainedToday ? "training" : "rest", items: [], water: 0 };
  }
  return S.nutrition.log[date];
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
}

// класс шкалы: недобор / в цель / перебор (для белка перебор — не беда)
function gaugeState(pct, kind) {
  if (pct < 0.9) return "lo";
  if (pct <= 1.1) return "ok";
  return kind === "protein" ? "ok" : "hi";
}

function renderResources() {
  const date = today();
  const day = nutDay(date);
  const T = NUTRITION.dayTypes[day.dayType];
  const tot = nutTotals(day);

  const macros = [
    { key: "kcal", name: "Калории", unit: "ккал", cur: tot.k, tgt: T.kcal },
    { key: "protein", name: "Белок", unit: "г", cur: tot.p, tgt: T.protein },
    { key: "carbs", name: "Углеводы", unit: "г", cur: tot.cb, tgt: T.carbs },
    { key: "fat", name: "Жиры", unit: "г", cur: tot.f, tgt: T.fat },
  ];
  // готовность пайка: среднее заполнение 4 шкал (перебор капается на 100%)
  const readiness = Math.round(100 * macros.reduce((a, m) => a + Math.min(1, m.cur / m.tgt), 0) / macros.length);
  const proteinOk = tot.p >= T.protein * 0.95;
  const kcalPct = tot.k / T.kcal;
  const kcalOk = kcalPct >= 0.9 && kcalPct <= 1.1;
  let vCls, vTxt;
  if (readiness >= 90 && proteinOk && kcalOk) { vCls = "verdict-gold"; vTxt = "Паёк собран"; }
  else if (readiness >= 55) { vCls = "verdict-mid"; vTxt = "Припасы копятся"; }
  else { vCls = "verdict-fail"; vTxt = "Кладовая пуста"; }

  const ring = 2 * Math.PI * 52;
  const gaugeHTML = macros.map((m) => {
    const pct = m.tgt ? m.cur / m.tgt : 0;
    const st = gaugeState(pct, m.key === "protein" ? "protein" : m.key);
    const left = Math.round(m.tgt - m.cur);
    return `
      <div class="gauge ${st}">
        <div class="g-top">
          <span class="g-name">${icon(NUT_ICON[m.key])}<b>${m.name}</b></span>
          <span class="g-val mono">${Math.round(m.cur)} / ${m.tgt} ${m.unit}</span>
        </div>
        <div class="g-bar"><i style="width:${Math.min(100, pct * 100).toFixed(0)}%"></i></div>
        <div class="g-sub mono">${left > 0 ? `осталось ${left} ${m.unit}` : `перебор ${Math.abs(left)} ${m.unit}`}</div>
      </div>`;
  }).join("");

  const waterCups = Math.round(day.water / 250);
  const waterPct = Math.min(100, (day.water / WATER_TARGET_ML) * 100);
  const fiberTgt = NUTRITION.constants.fiber[0];

  const itemsHTML = day.items.length
    ? day.items.map((it, i) => `
        <div class="meal-row">
          <span class="meal-name">${it.n}<span class="dim small"> · ${it.g} г</span></span>
          <span class="meal-kcal mono">${Math.round(it.k * it.g / 100)} ккал</span>
          <button class="meal-del" data-i="${i}" aria-label="Убрать">✕</button>
        </div>`).join("")
    : `<div class="empty">Провизии пока нет. Найди продукт и добавь порцию.</div>`;

  const tip = day.dayType === "training"
    ? `<div class="nut-tip"><span class="dim small">⚔ Тренировочный день · за 2 ч до похода: ${NUTRITION.timing.pre.carbs.join("–")} г углеводов + ${NUTRITION.timing.pre.protein.join("–")} г белка · после: ${NUTRITION.timing.post.carbs.join("–")} г углеводов + ${NUTRITION.timing.post.protein.join("–")} г белка.</span></div>`
    : `<div class="nut-tip"><span class="dim small">☾ День отдыха · углеводы ровнее по приёмам, ужин легче. Белок держим ${T.protein} г.</span></div>`;

  app.innerHTML = `
    <div class="eyebrow">Ресурсы · снабжение героя</div>
    <h1 class="display">Провизия дня</h1>

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
        <span class="g-name">${icon("droplet")}<b>Вода</b></span>
        <span class="g-val mono">${(day.water / 1000).toFixed(2)} / ${(WATER_TARGET_ML / 1000).toFixed(1)} л</span>
      </div>
      <div class="g-bar"><i class="water" style="width:${waterPct.toFixed(0)}%"></i></div>
      <div class="water-ctl">
        <button class="wbtn" id="water-minus" aria-label="Убрать стакан">−</button>
        <span class="mono dim small">${waterCups} × 250 мл</span>
        <button class="wbtn" id="water-plus" aria-label="Добавить стакан">+ стакан</button>
      </div>
      <div class="g-sub mono">≈ клетчатка ${Math.round(tot.fb)} / ${fiberTgt} г</div>
    </div>

    ${tip}

    <div class="rune-divider">${runeSVG}</div>

    <div class="eyebrow" style="margin-bottom:6px">Добавить провизию</div>
    <div class="food-search">
      <input id="food-q" type="search" inputmode="search" placeholder="Найди продукт — курица, рис, банан…" autocomplete="off" />
    </div>
    <div id="food-results"></div>

    <div class="rune-divider">${runeSVG}</div>
    <div class="eyebrow" style="margin-bottom:6px">Съедено сегодня · ${day.items.length}</div>
    <div id="meal-log">${itemsHTML}</div>`;

  // тип дня
  app.querySelectorAll(".dt").forEach((b) => b.onclick = () => {
    day.dayType = b.dataset.dt; save(); render();
  });
  // вода
  document.getElementById("water-plus").onclick = () => { day.water += 250; save(); render(); };
  document.getElementById("water-minus").onclick = () => { day.water = Math.max(0, day.water - 250); save(); render(); };
  // удаление приёма
  app.querySelectorAll(".meal-del").forEach((b) => b.onclick = () => {
    day.items.splice(+b.dataset.i, 1); save(); render();
  });

  wireFoodSearch(day);
}

/* ---------- поиск продуктов: локальный справочник + Open Food Facts ---------- */
let foodSearchTimer = null;
let foodSearchCtl = null;

function wireFoodSearch(day) {
  const input = document.getElementById("food-q");
  const box = document.getElementById("food-results");
  if (!input || !box) return;

  const renderList = (foods, note) => {
    box.innerHTML =
      (note ? `<div class="dim small" style="padding:4px 2px">${note}</div>` : "") +
      (foods.length ? foods.map((f) => `
        <div class="food-item" data-id="${f.id}">
          <span class="food-body">
            <span class="food-name">${f.n}</span>
            <span class="food-macros dim small mono">${f.k} ккал · Б ${fmt(f.p)} · Ж ${fmt(f.f)} · У ${fmt(f.cb)} <span class="per100">/ 100 г</span></span>
          </span>
          <button class="food-add" aria-label="Добавить">+</button>
        </div>`).join("") : `<div class="empty">Ничего не найдено. Попробуй другое слово.</div>`);
    // кэш найденных, чтобы открыть порцию
    box._foods = {};
    foods.forEach((f) => (box._foods[f.id] = f));
    box.querySelectorAll(".food-item").forEach((el) => {
      el.querySelector(".food-add").onclick = () => openPortion(box._foods[el.dataset.id], day);
    });
  };

  const showDefault = () => {
    const recent = (S.nutrition.recent || []);
    renderList(recent.length ? recent : FOODS.slice(0, 8), recent.length ? "Недавнее" : "Популярное");
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

function openPortion(food, day) {
  if (!food) return;
  const o = document.createElement("div");
  o.className = "overlay portion-overlay";
  const calc = (g) => Math.round(food.k * g / 100);
  o.innerHTML = `
    <div class="portion-card">
      <div class="eyebrow">Порция</div>
      <div class="portion-name display">${food.n}</div>
      <div class="dim small mono" style="margin-bottom:14px">${food.k} ккал · Б ${fmt(food.p)} · Ж ${fmt(food.f)} · У ${fmt(food.cb)} на 100 г</div>
      <div class="portion-chips">
        ${[50, 100, 150, 200, 250].map((g) => `<button class="pchip" data-g="${g}">${g} г</button>`).join("")}
      </div>
      <div class="portion-input">
        <input id="portion-g" inputmode="numeric" value="100" aria-label="граммы" /> <span class="dim">г</span>
        <span class="portion-kcal mono" id="portion-kcal">${calc(100)} ккал</span>
      </div>
      <div class="portion-actions">
        <button class="btn-ghost" id="portion-cancel">Отмена</button>
        <button class="finish-btn" id="portion-add" style="margin-top:0">Добавить</button>
      </div>
    </div>`;
  overlayRoot.appendChild(o);

  const gInput = o.querySelector("#portion-g");
  const kEl = o.querySelector("#portion-kcal");
  const upd = () => { kEl.textContent = calc(parseFloat(gInput.value.replace(",", ".")) || 0) + " ккал"; };
  gInput.oninput = upd;
  o.querySelectorAll(".pchip").forEach((c) => c.onclick = () => { gInput.value = c.dataset.g; upd(); gInput.focus(); });
  o.querySelector("#portion-cancel").onclick = () => o.remove();
  o.querySelector("#portion-add").onclick = () => {
    const g = parseFloat(gInput.value.replace(",", ".")) || 0;
    if (g <= 0) { gInput.focus(); return; }
    day.items.push({ n: food.n, g, k: food.k, p: food.p, f: food.f, cb: food.cb, fb: food.fb || 0, src: food.src });
    pushRecent({ id: food.id, src: food.src, n: food.n, k: food.k, p: food.p, f: food.f, cb: food.cb, fb: food.fb || 0 });
    save();
    o.remove();
    render();
  };
  setTimeout(() => gInput.select(), 50);
}

/* ================= ХРОНИКИ (прогресс) ================= */
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

  app.innerHTML = `
    <div class="eyebrow">Хроники · рост силовых</div>
    <h1 class="display">Летопись героя</h1>
    <svg width="0" height="0"><defs><linearGradient id="goldfade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c9a961" stop-opacity=".35"/><stop offset="1" stop-color="#c9a961" stop-opacity="0"/>
    </linearGradient></defs></svg>
    <div id="charts"></div>
    <div class="rune-divider">${runeSVG}</div>
    <div class="panel">
      <div class="eyebrow" style="margin-bottom:8px">Последние походы</div>
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
      ${arr.length ? sparkline(pts.map((p) => p.v)) : `<div class="empty">Пока пусто. Первый поход в кузницу впишет сюда строку.</div>`}`;
    charts.appendChild(card);
  });

  const log = document.getElementById("log");
  const rows = [...S.sessions].reverse().slice(0, 12);
  log.innerHTML = rows.length
    ? rows.map((s) => `<div class="log-row">
        <span>${WORKOUTS[s.workoutId]?.boss || s.workoutId}</span>
        <span class="dim mono small">${fmtDate(s.date)}</span>
        <span class="${s.cls} mono">${s.score}%</span></div>`).join("")
    : `<div class="empty">Летопись чиста, странник.</div>`;
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
