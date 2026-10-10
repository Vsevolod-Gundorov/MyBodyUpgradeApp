// Контроллер: общий каталог продуктов.
//   GET  /api/foods?q=…   → { foods: [...] } — поиск по каталогу (значения на 100 г)
//   POST /api/foods {code} → { food } — «человек выбрал этот продукт Open Food Facts»:
//        сервер сам берёт его из OFF по штрихкоду, проверяет и кладёт в каталог.
//        Значениям с телефона сервер не верит — иначе любой мог бы испортить каталог для всех.
import { offProductToFood } from "../../data/nutrition.js";
import { LIMITS } from "../config.js";
import { BodyTooLarge, fail, json, readBody } from "../http.js";
import { bumpFood, getFood, searchFoods, upsertFood } from "../models/foods.js";
import * as rate from "../models/rateLimit.js";
import { fetchOffProduct } from "../off.js";
import { foodView } from "../views/foods.js";
import { guard, logDbError } from "./guard.js";

/** Запрос → слова: нижний регистр, без управляющих символов, до 5 слов. null — искать нечего. */
export function queryWords(q) {
  const clean = String(q || "").normalize("NFC").toLowerCase().replace(/[\u0000-\u001f\u007f]/g, " ").replace(/ё/g, "е").trim();
  if (clean.length < 2 || clean.length > 60) return null;
  const words = clean.split(/\s+/).filter(Boolean).slice(0, 5);
  return words.length ? words : null;
}

async function limited(db, bucket, { windowSec, max }) {
  const [[r]] = await db.app([rate.hit(bucket, windowSec)]);
  return Number(r.hits) > max;
}

export async function handleFoods(request, deps) {
  const L = deps.limits || LIMITS;
  if (request.method !== "GET" && request.method !== "POST") return fail(405, "method_not_allowed", { allow: "GET, POST" });
  const g = await guard(request, deps);
  if (g.response) return g.response;
  const { user } = g;
  const { db } = deps;

  if (request.method === "GET") {
    const words = queryWords(new URL(request.url).searchParams.get("q"));
    if (!words) return json(200, { foods: [] });
    try {
      if (await limited(db, `fs:${user.id}`, L.RATE_FOOD_SEARCH)) return fail(429, "rate_limited", { "retry-after": String(L.RATE_FOOD_SEARCH.windowSec) });
      const [rows] = await db.app([searchFoods(words, L.FOOD_RESULTS)]);
      return json(200, { foods: rows.map(foodView) });
    } catch (e) { logDbError("foods.search", e); return fail(503, "db_unavailable"); }
  }

  // POST: только JSON и только штрихкод
  const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (type !== "application/json") return fail(415, "unsupported_media_type");
  let code;
  try {
    const body = JSON.parse(await readBody(request, 1024));
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((k) => k !== "code")) return fail(400, "bad_body");
    code = String(body.code || "");
  } catch (e) {
    if (e instanceof BodyTooLarge) return fail(413, "too_large");
    return fail(400, "bad_json");
  }
  if (!/^\d{4,32}$/.test(code)) return fail(400, "bad_code");

  try {
    if (await limited(db, `fa:${user.id}`, L.RATE_FOOD_ADD)) return fail(429, "rate_limited", { "retry-after": String(L.RATE_FOOD_ADD.windowSec) });
    const [[known]] = await db.app([getFood(code)]);
    if (known && known.fresh) {                       // проверен в последние 30 дней — OFF не трогаем
      await db.app([bumpFood(code)]);
      return json(200, { food: foodView(known) });
    }
    if (await limited(db, "off:all", L.RATE_OFF_ALL)) {
      return known ? json(200, { food: foodView(known) }) : fail(503, "busy", { "retry-after": "60" });
    }
  } catch (e) { logDbError("foods.add", e); return fail(503, "db_unavailable"); }

  let product;
  try { product = await (deps.offFetch || fetchOffProduct)(code); } catch {
    return fail(502, "off_unavailable");
  }
  const food = product && offProductToFood({ ...product, code });
  if (!food || food.code !== code) return fail(422, "not_usable");
  try {
    const [[row]] = await db.app([upsertFood(code, food)]);
    return json(200, { food: foodView(row) });
  } catch (e) { logDbError("foods.add", e); return fail(503, "db_unavailable"); }
}
