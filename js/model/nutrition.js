// Модель: дни питания, вода и итоги по макросам.
import { DRINK_RE, hydrationByName } from "../../data/nutrition.js";
import { S } from "./store.js";

export function nutDay(date) { // создаёт и сохраняет запись дня (для записи)
  if (!S.nutrition) S.nutrition = { log: {}, recent: [] };
  if (!S.nutrition.log[date]) {
    const trained = S.sessions.some((s) => s.date === date);
    S.nutrition.log[date] = { dayType: trained ? "training" : "rest", items: [], water: 0 };
  }
  return S.nutrition.log[date];
}

export function nutRead(date) { // читает без создания (для отображения прошлых пустых дней)
  return (S.nutrition && S.nutrition.log[date]) ||
    { dayType: S.sessions.some((s) => s.date === date) ? "training" : "rest", items: [], water: 0 };
}

export function nutTotals(day) {
  const t = { k: 0, p: 0, f: 0, cb: 0, fb: 0 };
  day.items.forEach((it) => {
    const m = it.g / 100;
    t.k += it.k * m; t.p += it.p * m; t.f += it.f * m; t.cb += it.cb * m; t.fb += (it.fb || 0) * m;
  });
  return t;
}

/**
 * Запомнить, что продукт съели: недавнее, частота и порция «как в прошлый раз».
 * Храним до 200 продуктов — по ним мгновенный поиск без сети.
 */
export function pushRecent(food, portion = null) {
  if (!S.nutrition.recent) S.nutrition.recent = [];
  S.nutrition.recent = [food, ...S.nutrition.recent.filter((r) => r.id !== food.id)].slice(0, 12);
  if (!S.nutrition.foodStats) S.nutrition.foodStats = {};
  const cur = S.nutrition.foodStats[food.id];
  const rec = { food, count: (cur ? cur.count : 0) + 1, last: Date.now() };
  const amt = portion ? portion.amt : cur && cur.amt;
  if (amt > 0) { rec.amt = amt; rec.unit = (portion && portion.unit) || (cur && cur.unit); }
  S.nutrition.foodStats[food.id] = rec;
  // не даём словарю расти бесконечно — держим 200 самых свежих
  const ids = Object.keys(S.nutrition.foodStats);
  if (ids.length > 200) {
    ids.sort((a, b) => S.nutrition.foodStats[a].last - S.nutrition.foodStats[b].last)
      .slice(0, ids.length - 200).forEach((id) => delete S.nutrition.foodStats[id]);
  }
}

/* ---- гидратация: сколько воды даёт напиток (кофе/чай/кола/энергетик и т.п.) ---- */
// правила общие с данными продуктов: data/nutrition.js
export { DRINK_RE };

// признак продукта главнее названия; у старых записей признака нет — судим по названию
export const itemIsDrink = (it) => it.drink === true || (it.drink !== false && DRINK_RE.test(it.n || ""));

export const itemHy = (it) => it.hy || hydrationByName(it.n);   // индекс гидратации

export function itemWaterMl(it) { // вода из напитка = масса × доля воды × индекс гидратации
  if (!itemIsDrink(it)) return 0;
  const frac = Math.max(0, Math.min(1, 1 - ((it.p + it.f + it.cb) / 100)));
  return it.g * frac * itemHy(it);
}

export const drinkWaterOf = (day) => day.items.reduce((a, it) => a + itemWaterMl(it), 0);

// класс шкалы: недобор / в цель / перебор (для белка перебор — не беда)
export function gaugeState(pct, kind) {
  if (pct < 0.9) return "lo";
  if (pct <= 1.1) return "ok";
  return kind === "protein" ? "ok" : "hi";
}
