// Проверка журнала до того, как он попадёт в базу.
//
// Сервер не доверяет телу запроса: туда можно прислать что угодно, а не только
// то, что пишет наше приложение. Отсюда правила:
//   - только обычные объекты, массивы, строки, конечные числа, true/false/null;
//   - никаких ключей __proto__ / constructor / prototype (загрязнение прототипа);
//   - ограничения на глубину, число узлов, длину строк и ключей — чтобы один
//     запрос не съел память функции и не раздул базу;
//   - нулевой символ и «оборванные» суррогатные пары UTF-16 в строках запрещены:
//     Postgres jsonb их не принимает, а без проверки запрос упал бы с внутренней ошибкой.

export const SHAPE = Object.freeze({
  MAX_DEPTH: 14,
  MAX_NODES: 400_000,
  MAX_STRING: 20_000,
  MAX_KEY: 200,
  MAX_ARRAY: 100_000,
  MAX_TOP_KEYS: 64,
  MAX_REV: Number.MAX_SAFE_INTEGER,
});

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export class ValidationError extends Error {
  constructor(code, path = "") { super(`${code}${path ? " @ " + path : ""}`); this.code = code; this.path = path; }
}

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

/** Обойти значение и проверить все правила. Возвращает число узлов. */
export function checkTree(value) {
  let nodes = 0;
  const stack = [[value, 0, "$"]];
  while (stack.length) {
    const [v, depth, path] = stack.pop();
    if (++nodes > SHAPE.MAX_NODES) throw new ValidationError("too_many_nodes");
    if (depth > SHAPE.MAX_DEPTH) throw new ValidationError("too_deep", path);
    if (v === null || typeof v === "boolean") continue;
    if (typeof v === "number") { if (!Number.isFinite(v)) throw new ValidationError("bad_number", path); continue; }
    if (typeof v === "string") {
      if (v.length > SHAPE.MAX_STRING) throw new ValidationError("string_too_long", path);
      if (v.includes("\u0000")) throw new ValidationError("nul_in_string", path);
      if (!v.isWellFormed()) throw new ValidationError("bad_unicode", path);
      continue;
    }
    if (Array.isArray(v)) {
      if (v.length > SHAPE.MAX_ARRAY) throw new ValidationError("array_too_long", path);
      for (let i = v.length - 1; i >= 0; i--) stack.push([v[i], depth + 1, `${path}[${i}]`]);
      continue;
    }
    if (isPlainObject(v)) {
      for (const k of Object.keys(v)) {
        if (FORBIDDEN_KEYS.has(k)) throw new ValidationError("forbidden_key", `${path}.${k}`);
        if (k.length > SHAPE.MAX_KEY) throw new ValidationError("key_too_long", path);
        if (k.includes("\u0000") || !k.isWellFormed()) throw new ValidationError("bad_key", path);
        stack.push([v[k], depth + 1, `${path}.${k}`]);
      }
      continue;
    }
    throw new ValidationError("bad_type", path);
  }
  return nodes;
}

/**
 * Разобрать и проверить тело PUT /api/journal.
 * Ожидается: { rev: целое ≥ 0, baseRev: целое ≥ 0 | null, data: объект журнала }.
 * JSON.parse безопасен к __proto__ (создаёт обычное поле), а checkTree его запрещает.
 */
export function parseJournalBody(text) {
  let body;
  try { body = JSON.parse(text); } catch { throw new ValidationError("bad_json"); }
  if (!isPlainObject(body)) throw new ValidationError("bad_body");
  const extra = Object.keys(body).filter((k) => !["rev", "baseRev", "data", "reason"].includes(k));
  if (extra.length) throw new ValidationError("unknown_fields");

  const { rev, baseRev, data } = body;
  const reason = body.reason == null ? "save" : body.reason;
  if (!Number.isSafeInteger(rev) || rev < 0 || rev > SHAPE.MAX_REV) throw new ValidationError("bad_rev");
  if (baseRev !== null && (!Number.isSafeInteger(baseRev) || baseRev < 0)) throw new ValidationError("bad_base_rev");
  if (baseRev !== null && rev <= baseRev) throw new ValidationError("rev_not_increasing");
  if (!["save", "migrate"].includes(reason)) throw new ValidationError("bad_reason");

  if (!isPlainObject(data)) throw new ValidationError("bad_data");
  if (Object.keys(data).length > SHAPE.MAX_TOP_KEYS) throw new ValidationError("too_many_fields");
  checkTree(data);
  // минимальная проверка формы журнала: то, на что опирается приложение
  if (data.sessions !== undefined && !Array.isArray(data.sessions)) throw new ValidationError("bad_sessions");
  if (data.settings !== undefined && !isPlainObject(data.settings)) throw new ValidationError("bad_settings");
  if (data.hero !== undefined && !isPlainObject(data.hero)) throw new ValidationError("bad_hero");
  return { rev, baseRev, data, reason };
}
