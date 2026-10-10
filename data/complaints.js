// Жалобы: «болело плечо», «ноет поясница» → тренировка облегчается сама.
// Чистые данные и функции, без DOM и без состояния приложения.
//
// Как это работает:
//  1. Заметку к упражнению разбирает parseComplaint(): находит зону (плечо, поясница…)
//     и силу (дискомфорт или боль). Быстрые кнопки дают то же самое без текста.
//  2. Для каждой зоны известно, какие движения её грузят: сильно (high) или заметно (mid).
//  3. easeFor() даёт коэффициент веса для движения: при боли сильно грузящее движение
//     идёт с весом −30% и с предложением заменить, при дискомфорте — −15%.
//     Остальное по зоне — −15% / −10%. Движения, которые зону не грузят, не трогаются.
//  4. Облегчённый подход прогрессия видит как «облегчено» и рабочий максимум не двигает:
//     неделя бережной работы не откатывает вес назад.
//  5. На следующей тренировке приложение спрашивает «как плечо?» — прошло, ещё беспокоит
//     или хуже. Без ответа жалоба сама гаснет через 21 день.
//
// Это не диагноз и не лечение: острая боль, онемение, отёк — повод к врачу, а не к замене
// упражнения. Об этом говорит и интерфейс.

export const LEVELS = {
  mild: { key: "mild", name: "Дискомфорт", note: "ноет, тянет, неприятно" },
  pain: { key: "pain", name: "Боль", note: "болит при движении" },
};

/** Насколько облегчать: [сильно грузящее, заметно грузящее] для каждой силы жалобы. */
export const EASE = { mild: [0.85, 0.9], pain: [0.7, 0.85] };

/** Сколько дней жалоба действует без подтверждения. */
export const COMPLAINT_TTL = 21;

const A = (key, name, nameAcc, re, high, mid) => ({ key, name, nameAcc, re, high: new Set(high), mid: new Set(mid) });

export const AREAS = {
  shoulder: A("shoulder", "Плечо", "плечо", /плеч|дельт|ротатор|ключиц|лопатк/,
    ["ohp", "push-press", "dips", "upright", "incline-bb", "db-ohp"],
    ["bench", "cg-bench", "flat-db", "incline-db", "machine-press", "lat-raise", "cable-lat-raise", "pullup", "lat", "pullover", "french-db", "cross-delt", "cross-mid", "pec-deck"]),
  lowback: A("lowback", "Поясница", "поясницу", /поясниц|низ[ау]?\s*спин|спин[аеуы]?\s*(внизу|снизу)|крестц|копчик|межпозв|грыж|протруз|радикул|прострел/,
    ["deadlift", "good-morning", "row", "rdl", "squat", "hyper", "back-ext-45"],
    ["front-squat", "push-press", "ohp", "bulgarian", "lunge", "hip-thrust", "shrug", "carry", "curl-bb", "curl-ez", "plank"]),
  knee: A("knee", "Колено", "колено", /колен|мениск|чашечк|связк[аиу]\s*колен/,
    ["squat", "front-squat", "hack", "bulgarian", "lunge", "legext", "legpress"],
    ["plie-squat", "legcurl-s", "legcurl-l", "deadlift"]),
  elbow: A("elbow", "Локоть", "локоть", /локт|локоть|локтев|эпикондил|теннисн/,
    ["french-bb", "french-db", "cg-bench", "dips", "preacher", "curl-bb"],
    ["curl-ez", "pushdown", "pullup", "hammer", "incline-curl", "cable-curl", "rev-curl", "bench", "ohp", "lat"]),
  wrist: A("wrist", "Запястье", "запястье", /запяст|кист[ьиеюя]|ладон|пальц/,
    ["front-squat", "curl-bb", "rev-curl", "push-press"],
    ["bench", "cg-bench", "ohp", "curl-ez", "preacher", "dips", "carry", "french-bb", "hanging-leg", "deadlift", "shrug"]),
  neck: A("neck", "Шея", "шею", /ше[яеиюй]\b|шею|шейн|затыл|трапеци/,
    ["shrug", "shrug-db", "upright", "squat"],
    ["deadlift", "ohp", "push-press", "carry", "cable-crunch", "row"]),
  hip: A("hip", "Тазобедренный", "тазобедренный", /тазобедр|\bтаз|пах|вертел|ягодиц/,
    ["squat", "front-squat", "bulgarian", "lunge", "plie-squat", "adduction"],
    ["deadlift", "rdl", "good-morning", "hip-thrust", "legpress", "hack", "hanging-leg"]),
};
export const AREA_ORDER = ["shoulder", "lowback", "knee", "elbow", "wrist", "neck", "hip"];

// «немного болит» — это дискомфорт: смягчающее слово главнее
const SOFT = /немного|слегка|чуть|чуточ|ноет|ныл|тянет|тянул|дискомфорт|неприятн|хруст|щ[её]лк|забит|скован|устал|затек|зат[её]к/;
const PAIN = /бол[иеья]|болел|болит|боль|острая|остро|прострел|травм|защем|не\s*могу|сильно|отдает|отда[её]т|онем/;

/**
 * Разобрать заметку: какие зоны и насколько.
 * @returns {Array<{ area, level }>} — пусто, если жалоб в тексте нет
 */
export function parseComplaint(text) {
  const t = String(text || "").toLowerCase().replace(/ё/g, "е");
  if (!t.trim()) return [];
  const level = SOFT.test(t) ? "mild" : PAIN.test(t) ? "pain" : "mild";
  return AREA_ORDER.filter((k) => AREAS[k].re.test(t)).map((area) => ({ area, level }));
}

/** Как сильно движение грузит зону: 2 — сильно, 1 — заметно, 0 — не грузит. */
export function stressOf(exId, area) {
  const a = AREAS[area];
  if (!a) return 0;
  return a.high.has(exId) ? 2 : a.mid.has(exId) ? 1 : 0;
}

/** Действующие жалобы на дату: не закрыты и не старше COMPLAINT_TTL дней с последнего подтверждения. */
export function activeComplaints(list = [], date) {
  const now = new Date(date + "T00:00:00Z").getTime();
  return (list || []).filter((c) => c && !c.resolvedAt && AREAS[c.area]
    && (now - new Date((c.checkedAt || c.date) + "T00:00:00Z").getTime()) / 864e5 < COMPLAINT_TTL);
}

/**
 * Облегчение для движения: { k, swap, reasons } или null.
 * k — доля веса, swap — стоит предложить замену (боль + сильно грузящее движение).
 */
export function easeFor(exId, complaints = []) {
  let k = 1, swap = false;
  const reasons = [];
  for (const c of complaints) {
    const st = stressOf(exId, c.area);
    if (!st) continue;
    const e = (EASE[c.level] || EASE.mild)[st === 2 ? 0 : 1];
    if (e < k) k = e;
    if (c.level === "pain" && st === 2) swap = true;
    reasons.push({ area: c.area, level: c.level, stress: st });
  }
  return reasons.length ? { k, swap, reasons } : null;
}

/** Чем заменить: похожие по задаче движения, которые зону не грузят (или грузят меньше). */
export function saferAlternatives(exId, complaints, candidates = []) {
  const load = (id) => Math.max(0, ...complaints.map((c) => stressOf(id, c.area)));
  const cur = load(exId);
  return candidates.filter((id) => id !== exId && load(id) < cur).sort((a, b) => load(a) - load(b));
}

/** «Плечо — боль», «поясница — дискомфорт». */
export const complaintLabel = (c) => `${AREAS[c.area].name} — ${LEVELS[c.level].name.toLowerCase()}`;
