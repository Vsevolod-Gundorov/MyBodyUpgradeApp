// Перенос журнала между браузером и Telegram.
//
// Зачем отдельный модуль: память браузера привязана к конкретному браузеру и домену,
// а мини-приложение Telegram открывается в своём вебвью — это другое хранилище.
// Файл туда тоже не всегда донесёшь: на iOS вебвью Telegram не даёт скачать и открыть
// файл. Поэтому переносим текстом: строку можно отправить самому себе в «Избранное».
//
// Две части:
//   encodeTransfer/decodeTransfer — упаковка журнала в строку и обратно;
//   mergeState — слияние двух журналов без потерь, чтобы перенос не затирал уже набранное.

const PREFIX_GZIP = "BU1.";
const PREFIX_PLAIN = "BU0.";
const hasCompression = () => typeof CompressionStream !== "undefined";

/* ---------- строка переноса ---------- */

const bytesToB64 = (bytes) => {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const b64ToBytes = (s) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
};
const pipe = async (bytes, stream) => new Uint8Array(
  await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

/** Журнал → строка переноса. Без сжатия строка тоже валидна, просто длиннее. */
export async function encodeTransfer(json) {
  const raw = new TextEncoder().encode(json);
  if (!hasCompression()) return PREFIX_PLAIN + bytesToB64(raw);
  const gz = await pipe(raw, new CompressionStream("gzip"));
  return PREFIX_GZIP + bytesToB64(gz);
}

/** Строка переноса → журнал. Пробелы и переносы строк из мессенджера игнорируются. */
export async function decodeTransfer(code) {
  const s = String(code || "").replace(/\s+/g, "");
  if (s.startsWith(PREFIX_PLAIN)) return new TextDecoder().decode(b64ToBytes(s.slice(4)));
  if (!s.startsWith(PREFIX_GZIP)) throw new Error("Это не код переноса: он начинается с BU1. или BU0.");
  if (!hasCompression()) throw new Error("Этот браузер не умеет распаковывать код");
  const gz = b64ToBytes(s.slice(4));
  return new TextDecoder().decode(await pipe(gz, new DecompressionStream("gzip")));
}

/* ---------- слияние журналов ---------- */

const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const arr = (v) => (Array.isArray(v) ? v : []);
const num = (v) => (Number.isFinite(v) ? v : 0);
const when = (s) => String((s && (s.at || s.date)) || "");
const filled = (s) => Object.values(obj(s && s.entries)).reduce((n, sets) => n + arr(sets).length, 0);

/**
 * Слить два журнала. Приоритет у local во всём, что описывает «сейчас» (настройки, планы,
 * остатки баффов), у incoming — только то, чего в local нет. История не теряется никогда.
 * @returns { state, stats } — новый журнал и что именно добавилось
 */
export function mergeState(local, incoming) {
  const L = obj(local), I = obj(incoming);
  const stats = { sessions: 0, achievements: 0, nutritionDays: 0, buffDays: 0 };

  // --- тренировки: объединяем по id, при совпадении берём более заполненную запись
  const byId = new Map();
  for (const s of arr(L.sessions)) if (s && s.id) byId.set(s.id, s);
  for (const s of arr(I.sessions)) {
    if (!s || !s.id) continue;
    const cur = byId.get(s.id);
    if (!cur) { byId.set(s.id, s); stats.sessions++; }
    else if (filled(s) > filled(cur)) byId.set(s.id, s);
  }
  const sessions = [...byId.values()].sort((a, b) => when(a).localeCompare(when(b)));
  const empty = arr(L.sessions).length === 0;   // в этом журнале ещё ничего не проходили

  // --- знаки отличия: счётчик не складываем (одни и те же тренировки дали бы задвоение),
  //     берём больший, даты — крайние, причины повторов — объединяем по дате и тексту
  const achievements = {};
  const ids = new Set([...Object.keys(obj(L.achievements)), ...Object.keys(obj(I.achievements))]);
  for (const id of ids) {
    const a = obj(obj(L.achievements)[id]), b = obj(obj(I.achievements)[id]);
    if (!Object.keys(a).length) stats.achievements++;
    const log = [...arr(a.log), ...arr(b.log)];
    const seen = new Set();
    achievements[id] = {
      count: Math.max(num(a.count), num(b.count)) || 1,
      first: [a.first, b.first].filter(Boolean).sort()[0] || null,
      last: [a.last, b.last].filter(Boolean).sort().pop() || null,
      log: log.filter((e) => {
        const k = `${(e && e.date) || ""}|${(e && e.note) || ""}`;
        if (seen.has(k)) return false;
        seen.add(k); return true;
      }).sort((x, y) => String(x.date).localeCompare(String(y.date))).slice(-400),
    };
  }

  // --- питание: день целиком берём оттуда, где он подробнее
  const nutLog = { ...obj(obj(I.nutrition).log) };
  for (const [d, v] of Object.entries(obj(obj(L.nutrition).log))) {
    const inc = obj(nutLog[d]);
    const mine = arr(v && v.items).length, theirs = arr(inc.items).length;
    nutLog[d] = mine >= theirs ? v : inc;
  }
  stats.nutritionDays = Object.keys(nutLog).length - Object.keys(obj(obj(L.nutrition).log)).length;

  const foodStats = { ...obj(obj(I.nutrition).foodStats) };
  for (const [k, v] of Object.entries(obj(obj(L.nutrition).foodStats))) {
    const b = obj(foodStats[k]);
    foodStats[k] = {
      food: (v && v.food) || b.food,
      count: Math.max(num(v && v.count), num(b.count)),
      last: [v && v.last, b.last].filter(Boolean).sort().pop() || null,
    };
  }

  // --- приём баффов: по дням, внутри дня — объединение отметок
  const buffLog = { ...obj(obj(I.buffs).log) };
  const lBuffLog = obj(obj(L.buffs).log);
  for (const [d, v] of Object.entries(lBuffLog)) buffLog[d] = { ...obj(buffLog[d]), ...obj(v) };
  stats.buffDays = Object.keys(buffLog).length - Object.keys(lBuffLog).length;

  const custom = [...arr(obj(L.buffs).custom)];
  for (const c of arr(obj(I.buffs).custom)) if (!custom.some((x) => x && c && x.id === c.id)) custom.push(c);

  const state = {
    ...I, ...L,                                   // общее правило: local важнее
    hero: empty ? { ...obj(L.hero), ...obj(I.hero) } : { ...obj(I.hero), ...obj(L.hero) },
    sessions,
    xp: sessions.reduce((n, s) => n + num(s && s.xp), 0),   // опыт всегда равен сумме по квестам
    achievements,
    statuses: [...new Set([...arr(L.statuses), ...arr(I.statuses)])],
    drafts: { ...obj(I.drafts), ...obj(L.drafts) },
    plan: { ...obj(I.plan), ...obj(L.plan) },
    questStart: { ...obj(I.questStart), ...obj(L.questStart) },
    settings: { ...obj(I.settings), ...obj(L.settings) },
    cycleStart: empty ? num(I.cycleStart) : num(L.cycleStart),
    nutrition: {
      ...obj(I.nutrition), ...obj(L.nutrition),
      log: nutLog,
      foodStats,
      recent: [...arr(obj(L.nutrition).recent), ...arr(obj(I.nutrition).recent)].slice(0, 12),
    },
    buffs: {
      ...obj(I.buffs), ...obj(L.buffs),
      log: buffLog,
      custom,
      active: empty ? obj(obj(I.buffs).active) : obj(obj(L.buffs).active),
      stock: { ...obj(obj(I.buffs).stock), ...obj(obj(L.buffs).stock) },
    },
    meta: {
      exports: num(obj(L.meta).exports) + num(obj(I.meta).exports),
      imports: num(obj(L.meta).imports) + num(obj(I.meta).imports) + 1,
    },
    rev: Math.max(num(L.rev), num(I.rev)),
    sync: obj(L.sync),
  };
  return { state, stats };
}
