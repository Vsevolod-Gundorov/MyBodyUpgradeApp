// Питание: штрихкоды, «как вчера», свои блюда.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { gtinValid, normalizeBarcode, upcEtoA } from "../data/barcode.js";

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { S } = await import("../js/model/store.js");
const F = await import("../js/model/foods.js");
const { addDays, today } = await import("../js/core/format.js");

test("штрихкод: контрольная цифра, UPC → EAN-13, мусор отбрасывается", () => {
  assert.ok(gtinValid("5449000000996"));      // Coca-Cola EAN-13
  assert.ok(gtinValid("96385074"));           // EAN-8
  assert.ok(!gtinValid("5449000000997"), "одна цифра не та — не принимаем");
  assert.ok(!gtinValid("12345"));
  assert.equal(normalizeBarcode("036000291452"), "0036000291452", "UPC-A дополняется до EAN-13");
  assert.equal(normalizeBarcode(" 5449 0000 0099 6 "), "5449000000996");
  assert.equal(normalizeBarcode("abc"), null);
  assert.equal(upcEtoA("04252614"), "042100005264");
  assert.equal(normalizeBarcode("04252614", "upc_e"), "0042100005264");
});

beforeEach(() => { S.nutrition = { log: {}, recent: [], custom: [], foodStats: {} }; });

const egg = { id: "egg", n: "Яйцо", k: 155, p: 13, f: 11, cb: 1.1, fb: 0 };
const oats = { id: "oats", n: "Овсянка", k: 370, p: 13, f: 7, cb: 60, fb: 10 };

test("«как вчера»: находит прошлый приём, повторяет и отменяет", () => {
  const t = today(), y = addDays(t, -1), d3 = addDays(t, -3);
  S.nutrition.log[d3] = { dayType: "rest", water: 0, items: [{ ...egg, g: 120, meal: "dinner" }] };
  S.nutrition.log[y] = { dayType: "rest", water: 0, items: [{ ...oats, g: 80, meal: "breakfast" }, { ...egg, g: 100, meal: "breakfast" }, { ...egg, g: 50, meal: "lunch" }] };
  const b = F.lastMeal(t, "breakfast");
  assert.equal(b.date, y); assert.equal(b.daysAgo, 1); assert.equal(b.items.length, 2);
  assert.equal(b.kcal, Math.round(370 * 0.8 + 155));
  assert.equal(F.lastMeal(t, "dinner").daysAgo, 3, "ищет до недели назад");
  assert.equal(F.lastMeal(t, "snack"), null);
  const res = F.repeatMeal(t, "breakfast", y);
  assert.equal(res.count, 2);
  assert.equal(S.nutrition.log[t].items.length, 2);
  assert.ok(S.nutrition.log[t].items.every((it) => it.meal === "breakfast"));
  F.undoRepeat(t, res);
  assert.equal(S.nutrition.log[t].items.length, 0);
});

test("своё блюдо: на 100 г готового, вода при варке, клетчатка по составу", () => {
  const items = [{ ...oats, g: 100 }, { ...egg, g: 100 }];
  const raw = F.dishOf({ n: "Каша с яйцом", items });
  assert.ok(raw.ok);
  assert.equal(raw.food.k, Math.round((370 + 155) / 2));        // 200 г сырого → на 100 г
  assert.equal(raw.food.fb, 5);
  // сварили — стало 400 г: на 100 г вдвое меньше
  const cooked = F.dishOf({ n: "Каша с яйцом", items, total: 400 });
  assert.equal(cooked.food.k, Math.round(525 / 4));
  assert.equal(cooked.food.fb, 2.5);
  assert.equal(cooked.totals.weight, 400);
  // ошибки: без названия, без состава, вес готового не сходится с составом
  assert.equal(F.dishOf({ n: "", items }).error, "no_name");
  assert.equal(F.dishOf({ n: "x", items: [] }).error, "no_items");
  assert.equal(F.dishOf({ n: "x", items, total: 10 }).error, "bad_total");
  // сохраняется своим продуктом с составом и порцией
  const s = F.saveDish({ n: "каша с яйцом", items, total: 400, sv: 300 });
  assert.ok(s.ok);
  assert.equal(s.food.src, "my"); assert.equal(s.food.n, "Каша с яйцом"); assert.equal(s.food.sv, 300);
  assert.equal(s.food.recipe.items.length, 2); assert.equal(s.food.recipe.total, 400);
  assert.ok(!s.food.drink, "блюдо — не напиток, воду не считает");
  // правка рецепта — тот же продукт
  const s2 = F.saveDish({ n: "Каша с яйцом", items: [{ ...oats, g: 100 }], total: 300 }, s.food.id);
  assert.equal(s2.food.id, s.food.id);
  assert.equal(S.nutrition.custom.length, 1);
});

test("штрихкод: свой продукт с кодом находится без сети", async () => {
  const r = F.saveCustomFood({ n: "Протеин", k: 380, p: 75, f: 5, cb: 8, code: "4607001770015" });
  assert.ok(r.ok);
  assert.equal(r.food.code, "4607001770015");
  const found = await F.lookupBarcode("4607 0017 7001 5");
  assert.equal(found.from, "local"); assert.equal(found.food.n, "Протеин");
  assert.deepEqual(await F.lookupBarcode("123"), { error: "bad_code" });
  // неверная контрольная цифра — код не сохраняется, чтобы не путать товары
  assert.equal(F.saveCustomFood({ n: "Х", k: 100, code: "4607001770016" }).food.code, undefined);
});
