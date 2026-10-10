// Модель: продукты — поиск, свои продукты, приёмы пищи и «обычная порция».
//
// Поиск идёт слоями, от быстрого к медленному:
//   1. своё — мои продукты, всё, что уже ел, и встроенный справочник: мгновенно, без сети;
//   2. общий каталог сервера: десятки миллисекунд, если сервер доступен;
//   3. Open Food Facts — только по паузе в наборе или по кнопке, не чаще 8 раз в минуту
//      с устройства, с запоминанием ответов: так просят в их правилах, а за перебор банят адрес.
import { FOODS, offSearch, per100 } from "../../data/nutrition.js";
import { nutDay, pushRecent } from "./nutrition.js";
import { catalogAdd, catalogSearch } from "./server.js";
import { S } from "./store.js";

/* ---------------- приёмы пищи ---------------- */
export const MEALS = [
  { id: "breakfast", name: "Завтрак" },
  { id: "lunch", name: "Обед" },
  { id: "dinner", name: "Ужин" },
  { id: "snack", name: "Перекус" },
];
export const MEAL_IDS = MEALS.map((m) => m.id);

/** Приём пищи по времени: утро — завтрак, день — обед, вечер — ужин, ночь — перекус. */
export function mealByTime(d = new Date()) {
  const h = d.getHours();
  if (h >= 4 && h < 11) return "breakfast";
  if (h >= 11 && h < 16) return "lunch";
  if (h >= 16 && h < 21) return "dinner";
  return "snack";
}

/* ---------------- текст ---------------- */
export const norm = (s) => String(s || "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
const words = (q) => norm(q).split(" ").filter(Boolean);

/* ---------------- свои продукты ---------------- */
const customList = () => (S.nutrition.custom ||= []);

/**
 * Сохранить свой продукт. Значения можно ввести с этикетки «на 100 г» или «на порцию»:
 * пересчёт на 100 г, калории по БЖУ, если не указаны, клетчатка и признак напитка — в per100.
 * @returns {{ ok: true, food, warn } | { ok: false, error }}
 */
export function saveCustomFood(input, id = null) {
  const name = String(input.n || "").trim();
  const res = per100({ ...input, n: name.charAt(0).toUpperCase() + name.slice(1) });   // «сырники» → «Сырники»
  if (!res.ok) return res;
  const food = { ...res.food, id: id || `my${Date.now().toString(36)}`, src: "my" };
  const list = customList();
  const i = list.findIndex((f) => f.id === food.id);
  if (i >= 0) list[i] = food; else list.unshift(food);
  if (list.length > 500) list.length = 500;
  return { ok: true, food, warn: res.warn };
}

export function deleteCustomFood(id) {
  S.nutrition.custom = customList().filter((f) => f.id !== id);
}

/* ---------------- своё: недавнее, частое, мои ---------------- */
const stats = () => S.nutrition.foodStats || {};

export function recentFoods(limit = 30) {
  return Object.values(stats()).sort((a, b) => b.last - a.last).slice(0, limit).map((x) => x.food);
}
export function frequentFoods(limit = 30) {
  return Object.values(stats()).filter((x) => x.count >= 2)
    .sort((a, b) => b.count - a.count || b.last - a.last).slice(0, limit).map((x) => x.food);
}
export const myFoods = () => customList();

/** Всё, что есть на устройстве: мои продукты, уже съеденное, встроенный справочник. */
function localPool() {
  const seen = new Map();
  const put = (f) => { if (f && f.id && !seen.has(f.id)) seen.set(f.id, f); };
  customList().forEach(put);
  recentFoods(1000).forEach(put);
  (S.nutrition.recent || []).forEach(put);
  FOODS.forEach(put);
  return [...seen.values()];
}

/** Мгновенный поиск по своему: все слова запроса в названии; свои и частые — выше. */
export function localSearch(q, limit = 20) {
  const ws = words(q);
  if (!ws.length) return [];
  const st = stats();
  return localPool()
    .map((f) => {
      const n = norm(f.n);
      if (!ws.every((w) => n.includes(w))) return null;
      const score = (f.src === "my" ? 1000 : 0) + (st[f.id] ? 100 + st[f.id].count : 0) + (n.startsWith(ws[0]) ? 10 : 0);
      return { f, score };
    })
    .filter(Boolean).sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.f);
}

/** Склеить списки без повторов: по id и по одинаковому названию. */
export function mergeFoods(...lists) {
  const ids = new Set(), names = new Set(), out = [];
  for (const list of lists) for (const f of list || []) {
    const key = norm(f.n);
    if (ids.has(f.id) || names.has(key)) continue;
    ids.add(f.id); names.add(key); out.push(f);
  }
  return out;
}

/* ---------------- общий каталог ---------------- */
export async function serverSearch(q, signal) {
  if (norm(q).length < 2) return [];
  try { return await catalogSearch(q, signal); } catch (e) {
    if (e && e.name === "AbortError") throw e;
    return [];
  }
}

/* ---------------- Open Food Facts: бережно ---------------- */
export const OFF_MIN_CHARS = 3;
export const OFF_PAUSE_MS = 900;          // ждём паузу в наборе, а не каждую букву
export const OFF_PER_MINUTE = 8;          // у OFF 10 поисков в минуту с адреса — держимся ниже
const OFF_KEY = "bodyupgrade.offtimes";
const offCache = new Map();               // запрос → ответ: повторный поиск без сети

function offTimes(now) {
  let t = [];
  try { t = JSON.parse(sessionStorage.getItem(OFF_KEY) || "[]"); } catch (e) { t = []; }
  return (Array.isArray(t) ? t : []).filter((x) => now - x < 60_000);
}

/** Сколько поисков в OFF ещё можно в этой минуте и через сколько секунд освободится. */
export function offBudget(now = Date.now()) {
  const t = offTimes(now);
  return { left: Math.max(0, OFF_PER_MINUTE - t.length), waitSec: t.length ? Math.ceil((60_000 - (now - t[0])) / 1000) : 0 };
}

export const offEnabled = () => !!(S.settings && S.settings.offSearch);

/**
 * Поиск в Open Food Facts с предохранителем.
 * @returns {{ foods } | { limited: true, waitSec } | { disabled: true } | { short: true }}
 */
export async function searchOff(q, signal, now = Date.now()) {
  if (!offEnabled()) return { disabled: true };
  const key = norm(q);
  if (key.length < OFF_MIN_CHARS) return { short: true };
  if (offCache.has(key)) return { foods: offCache.get(key) };
  const b = offBudget(now);
  if (!b.left) return { limited: true, waitSec: b.waitSec };
  const t = offTimes(now); t.push(now);
  try { sessionStorage.setItem(OFF_KEY, JSON.stringify(t)); } catch (e) { /* приватный режим */ }
  const foods = await offSearch(key, signal);
  offCache.set(key, foods);
  if (offCache.size > 50) offCache.delete(offCache.keys().next().value);
  return { foods };
}

/* ---------------- порция и запись ---------------- */
/** Обычная порция продукта: как в прошлый раз, иначе порция с упаковки, иначе 100 г / 250 мл. */
export function usualPortion(food) {
  const st = stats()[food.id];
  if (st && st.amt > 0) return { amt: st.amt, unit: st.unit || (food.drink ? "мл" : "г") };
  const unit = food.drink ? "мл" : "г";
  if (food.sv > 0) return { amt: food.sv, unit };
  return { amt: food.drink ? 250 : 100, unit };
}

/** Запись в дневник: значения на 100 г из продукта, масса — из порции. */
export function itemOf(food, { amt, unit, meal }) {
  const rec = { n: food.n, g: amt, amt, unit, k: food.k, p: food.p, f: food.f, cb: food.cb, fb: food.fb || 0, src: food.src, meal };
  if (food.id) rec.id = food.id;
  if (food.code) rec.code = food.code;
  if (food.drink !== undefined) rec.drink = food.drink;
  if (food.drink) rec.hy = food.hy;
  if (food.fbEst) rec.fbEst = true;
  if (food.sv) rec.sv = food.sv;
  return rec;
}

/**
 * Добавить продукт в день. Запоминает порцию для «в одно касание» и, если продукт
 * из Open Food Facts, просит сервер перепроверить его и положить в общий каталог.
 * @returns индекс записи в дне
 */
export function addFood(date, food, portion) {
  const meal = MEAL_IDS.includes(portion.meal) ? portion.meal : mealByTime();
  const day = nutDay(date);
  day.items.push(itemOf(food, { ...portion, meal }));
  pushRecent(food, portion);
  if (food.code) catalogAdd(food.code);   // не ждём: дневник от этого не зависит
  return day.items.length - 1;
}

/** Продукт из записи дневника — чтобы изменить порцию или добавить снова. */
export function foodOfItem(it) {
  const food = { id: it.id || `man${it.n}`, src: it.src, n: it.n, k: it.k, p: it.p, f: it.f, cb: it.cb, fb: it.fb || 0 };
  ["code", "drink", "hy", "fbEst", "sv"].forEach((k) => { if (it[k] !== undefined) food[k] = it[k]; });
  return food;
}
