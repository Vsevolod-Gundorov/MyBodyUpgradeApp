// Модель продуктов: поиск по своему, свои продукты, обычная порция, приёмы пищи,
// бережный поиск в Open Food Facts (пауза, 8 в минуту, запоминание ответов).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const mem = new Map(), ses = new Map();
const storage = (m) => ({ getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) });
globalThis.localStorage = storage(mem);
globalThis.sessionStorage = storage(ses);
let offRequests = [];
globalThis.fetch = async (url) => {
  offRequests.push(String(url));
  return { json: async () => ({ products: [{ code: "4600000000123", product_name: "Куриная грудка", brands: "Петелинка", nutriments: { "energy-kcal_100g": 113, proteins_100g: 23.6, fat_100g: 1.9, carbohydrates_100g: 0 } }] }) };
};

const F = await import("../js/model/foods.js");
const store = await import("../js/model/store.js");   // S переприсваивается при загрузке — читаем через модуль
const { nutTotals, drinkWaterOf } = await import("../js/model/nutrition.js");

beforeEach(() => { mem.clear(); ses.clear(); store.reloadState(); offRequests = []; });

test("приём пищи по времени суток", () => {
  const at = (h) => F.mealByTime(new Date(2026, 9, 10, h));
  assert.deepEqual([at(7), at(13), at(19), at(23), at(2)], ["breakfast", "lunch", "dinner", "snack", "snack"]);
});

test("свой продукт: с этикетки «на порцию» — в справочник на 100 г, ищется первым", () => {
  const r = F.saveCustomFood({ n: "сырники мамины", k: 260, p: 18, f: 12, cb: 20, per: 130 });
  assert.equal(r.ok, true);
  assert.deepEqual([r.food.n, r.food.k, r.food.p, r.food.sv, r.food.src], ["Сырники мамины", 200, 13.8, 130, "my"]);
  assert.equal(F.localSearch("сырн")[0].id, r.food.id);
  assert.equal(F.usualPortion(r.food).amt, 130, "обычная порция — с этикетки");
  // правка того же продукта не плодит копии
  F.saveCustomFood({ n: "Сырники мамины", k: 200, p: 14, f: 9, cb: 15 }, r.food.id);
  assert.equal(F.myFoods().length, 1);
  F.deleteCustomFood(r.food.id);
  assert.equal(F.myFoods().length, 0);
  assert.equal(F.saveCustomFood({ n: "Ошибка", p: 90, f: 90 }).ok, false);
});

test("поиск по своему: слова в любом порядке, ё = е, уже съеденное — выше справочника", () => {
  assert.ok(F.localSearch("грудка кур").some((f) => f.n.startsWith("Куриная грудка")));
  F.saveCustomFood({ n: "Ёжики домашние", k: 180, p: 12, f: 10, cb: 9 });
  assert.equal(F.localSearch("ежики")[0].n, "Ёжики домашние");
  const egg = F.localSearch("яйцо")[0];
  const other = F.localSearch("курин").find((f) => f.id !== egg.id);
  F.addFood("2026-10-10", other, { amt: 150, unit: "г", meal: "lunch" });
  assert.equal(F.localSearch("курин")[0].id, other.id);
  assert.deepEqual(F.localSearch(""), []);
});

test("запись: порция, приём пищи, «как в прошлый раз», клетчатка и вода не ломаются", () => {
  const cola = F.localSearch("кола")[0];
  assert.equal(F.usualPortion(cola).unit, "мл");
  assert.equal(F.usualPortion(cola).amt, 250);
  F.addFood("2026-10-10", cola, { amt: 330, unit: "мл", meal: "lunch" });
  const oats = F.localSearch("овсян")[0];
  F.addFood("2026-10-10", oats, { amt: 80, unit: "г", meal: "breakfast" });
  const day = store.S.nutrition.log["2026-10-10"];
  assert.deepEqual(day.items.map((i) => i.meal), ["lunch", "breakfast"]);
  assert.equal(F.usualPortion(cola).amt, 330, "в следующий раз — та же порция");
  const t = nutTotals(day);
  assert.ok(Math.abs(t.fb - oats.fb * 0.8) < 1e-9, "клетчатка считается от записи");
  assert.equal(Math.round(drinkWaterOf(day)), Math.round(330 * (1 - (cola.p + cola.f + cola.cb) / 100) * cola.hy), "вода из напитка");
  // запись → продукт → та же запись
  const back = F.itemOf(F.foodOfItem(day.items[0]), { amt: 330, unit: "мл", meal: "lunch" });
  assert.deepEqual(back, day.items[0]);
  // неизвестный приём пищи — по времени
  F.addFood("2026-10-10", oats, { amt: 50, unit: "г", meal: "elevenses" });
  assert.ok(F.MEAL_IDS.includes(day.items[2].meal));
});

test("Open Food Facts: от 3 символов, ответы запоминаются, не больше 8 поисков в минуту", async () => {
  assert.deepEqual(await F.searchOff("ку"), { short: true });
  const r = await F.searchOff("куриная грудка", undefined, 1_000_000);
  assert.equal(r.foods[0].n, "Куриная грудка · Петелинка");
  await F.searchOff("Куриная  грудка", undefined, 1_000_001);
  assert.equal(offRequests.length, 1, "повтор — из памяти");
  for (let i = 0; i < 7; i++) await F.searchOff(`запрос ${i}`, undefined, 1_000_000 + i);
  assert.equal(offRequests.length, 8);
  const lim = await F.searchOff("ещё один", undefined, 1_010_000);
  assert.equal(lim.limited, true);
  assert.ok(lim.waitSec > 0 && lim.waitSec <= 60);
  assert.equal(offRequests.length, 8, "девятый за минуту не ушёл");
  assert.ok((await F.searchOff("ещё один", undefined, 1_061_000)).foods, "через минуту — снова можно");
  store.S.settings.offSearch = false;
  assert.deepEqual(await F.searchOff("творог"), { disabled: true });
});

test("склейка выдачи: без повторов по id и по названию", () => {
  const a = { id: "1", n: "Творог" }, b = { id: "2", n: "творог" }, c = { id: "1", n: "Другое" }, d = { id: "3", n: "Кефир" };
  assert.deepEqual(F.mergeFoods([a], [b, c, d]).map((f) => f.id), ["1", "3"]);
});
