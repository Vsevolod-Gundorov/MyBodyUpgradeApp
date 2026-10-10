// Модель: журнал атлета (S), его загрузка, сохранение и миграции формата.
import { DEFAULT_THEME } from "../../data/theme.js";
import { migrateLegacyStatuses } from "../../data/achievements.js";
import { tgUserId } from "../telegram.js";

/* ================= состояние (БД = localStorage + экспорт в JSON-файл) ================= */
export const DB_BASE = "bodyupgrade.v1";

// У каждого пользователя Телеграма свой журнал: на одном телефоне может быть
// несколько аккаунтов, и смешивать их прогресс нельзя.
export const DB_KEY = (() => {
  const uid = tgUserId();
  if (!uid) return DB_BASE;                       // обычный браузер — как раньше
  const key = `${DB_BASE}.u${uid}`;
  // первый вход этого аккаунта: забираем журнал, накопленный до появления аккаунтов
  try {
    if (!localStorage.getItem(key)) {
      const legacy = localStorage.getItem(DB_BASE);
      if (legacy) { localStorage.setItem(key, legacy); localStorage.removeItem(DB_BASE); }
    }
  } catch (e) { /* приватный режим — просто работаем без переноса */ }
  return key;
})();

export const defaultState = () => ({
  hero: { name: "Всеволод", title: "Одинокий Гриндер", bodyweight: 93 },
  xp: 0,
  sessions: [], // { id, workoutId, date, verdict, score, xp, entries: { exId: [{w, r}] } }
  drafts: {},   // workoutId -> entries (незавершённые)
  cycleStart: 0, // с какого квеста (индекс в ORDER) начинается цикл
  questStart: {}, // wid -> ts открытия квеста (справочно; длительность считается не по нему)
  questTicks: {}, // wid -> [ts] отметки активности: по ним и меряется длительность тренировки
  settings: { sound: true, haptics: true, offSearch: true, theme: DEFAULT_THEME }, // offSearch — искать ли продукты во внешней базе
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
  statuses: [],  // устарело: старые ситуационные статусы (переносятся в achievements при загрузке)
  achievements: {}, // id -> { count, first, last } — знаки отличия (см. data/achievements.js)
  plan: {},      // wid -> { swap: {origId:newId}, add: [id], hide: [id] } — правки состава квеста
  workReset: {}, // движение -> { date, one } — рабочий максимум, поправленный руками
  feel: null,    // { date, val } — самочувствие на сегодня: от него зависят вес, подходы и отдых
  meta: { exports: 0, imports: 0 }, // счётчики служебных действий (для достижений «Хроники»)
  rev: 0,        // ревизия журнала — растёт с каждым сохранением
  updatedAt: null,
  sync: { syncedRev: 0, at: null }, // что и когда уехало в облако Телеграма
});

export let S = load();

export function load() {
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
      // миграция: старые «статусы» → достижения (повторы схлопываются в счётчик)
      S2.achievements = (parsed.achievements && typeof parsed.achievements === "object")
        ? parsed.achievements : migrateLegacyStatuses(S2.statuses);
      S2.meta = Object.assign({}, base.meta, parsed.meta);
      S2.plan = (parsed.plan && typeof parsed.plan === "object") ? parsed.plan : {};
      S2.rev = Number.isFinite(parsed.rev) ? parsed.rev : 0;
      S2.sync = Object.assign({ syncedRev: 0, at: null }, parsed.sync);
      S2.settings = Object.assign({}, base.settings, parsed.settings);
      S2.cycleStart = Number.isInteger(parsed.cycleStart) ? parsed.cycleStart : 0;
      S2.questStart = (parsed.questStart && typeof parsed.questStart === "object") ? parsed.questStart : {};
      S2.questTicks = (parsed.questTicks && typeof parsed.questTicks === "object") ? parsed.questTicks : {};
      return S2;
    }
  } catch (e) { /* повреждённые данные — начинаем заново */ }
  return defaultState();
}

export function save() {
  S.rev = (S.rev || 0) + 1;                        // ревизия нужна, чтобы понять, чья копия свежее
  S.updatedAt = new Date().toISOString();
  localStorage.setItem(DB_KEY, JSON.stringify(S));
  savedListeners.forEach((f) => f(S));
}

/* ---- события модели ----
   Хранилище не знает, кто его слушает: синхронизация, отрисовка, что угодно ещё.
   Так модель не зависит ни от вида, ни от контроллеров. */
const savedListeners = new Set();
/** Подписаться на каждое сохранение журнала. Возвращает функцию отписки. */
export const onSaved = (f) => { savedListeners.add(f); return () => savedListeners.delete(f); };
/** Перечитать журнал из хранилища (после того как его заменили снаружи — облако, импорт). */
export function reloadState() { S = load(); return S; }

