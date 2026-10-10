// Продукт «на 100 г»: пересчёт с порции и из кДж, клетчатка, вода, проверка на правдоподобие.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FOODS, kcalFromMacros, offProductToFood, per100 } from "../data/nutrition.js";
import { itemWaterMl } from "../js/model/nutrition.js";

test("на 100 г: значения как есть, калории по БЖУ, если не указаны", () => {
  const r = per100({ n: "Гречка варёная", k: 110, p: 4.2, f: 1.1, cb: 21.3, fb: 2.7 });
  assert.deepEqual(r, { ok: true, food: { n: "Гречка варёная", k: 110, p: 4.2, f: 1.1, cb: 21.3, fb: 2.7 }, warn: [] });
  const k = per100({ n: "Творог 5%", p: 17, f: 5, cb: 1.8, fb: 0 }).food.k;
  assert.equal(k, Math.round(kcalFromMacros({ p: 17, f: 5, cb: 1.8 })));   // 120
});

test("с этикетки «на порцию»: пересчёт на 100 г и порция запоминается", () => {
  // батончик: на 40 г — 160 ккал, Б 12, Ж 5, У 16, клетчатка 2
  const r = per100({ n: "Батончик", k: 160, p: 12, f: 5, cb: 16, fb: 2, per: 40 });
  assert.equal(r.ok, true);
  assert.deepEqual(r.food, { n: "Батончик", k: 400, p: 30, f: 12.5, cb: 40, fb: 5, sv: 40 });
});

test("клетчатка: указанная — как есть, ноль явно — ноль, не указанная — оценка по типу продукта", () => {
  assert.equal(per100({ n: "Овсянка", k: 370, p: 13, f: 7, cb: 60, fb: 10 }).food.fb, 10);
  assert.equal(per100({ n: "Рис белый", k: 340, p: 7, f: 1, cb: 77, fb: 0 }).food.fb, 0);
  const est = per100({ n: "Овсяные хлопья", k: 370, p: 13, f: 7, cb: 60 }).food;
  assert.ok(est.fb > 0 && est.fbEst === true, "оценка помечена");
  assert.equal(per100({ n: "Куриная грудка", k: 165, p: 31, f: 3.6, cb: 0 }).food.fb, 0);
});

test("напитки: признак и индекс гидратации — вода считается так же, как раньше", () => {
  const cola = per100({ n: "Кола", k: 42, p: 0, f: 0, cb: 10.6, fb: 0 }).food;
  assert.deepEqual([cola.drink, cola.hy], [true, 0.9]);
  assert.deepEqual([per100({ n: "Кофе латте", k: 50, p: 3, f: 2, cb: 5 }).food.hy], [0.95]);
  assert.equal(per100({ n: "Вода минеральная", k: 0, p: 0, f: 0, cb: 0 }).food.hy, 1);
  assert.equal(per100({ n: "Пюре", k: 80, p: 2, f: 3, cb: 12 }).food.drink, undefined);
  // старые ложные срабатывания по названию
  for (const n of ["Тёмный шоколад 70%", "Тунец в собственном соку", "Chocolate bar", "Steak", "Watermelon", "Колбаса"]) {
    assert.ok(!per100({ n, k: 300, p: 10, f: 10, cb: 30 }).food.drink, n);
    assert.equal(itemWaterMl({ n, k: 300, p: 10, f: 10, cb: 30, g: 100 }), 0, `${n}: воды нет`);
  }
  for (const n of ["Кола", "Coca-Cola", "Сок яблочный", "Минеральная вода", "Капучино", "Зелёный чай", "Кофе", "Ice tea"]) {
    assert.ok(per100({ n, k: 40, p: 0, f: 0, cb: 10 }).food.drink, n);
  }
  // «не напиток» вручную главнее названия
  const cake = per100({ n: "Кофе-торт", k: 350, p: 5, f: 20, cb: 40, drink: false }).food;
  assert.equal(cake.drink, false);
  assert.equal(itemWaterMl({ ...cake, g: 100 }), 0);
  // свой напиток, отмеченный вручную
  const smoothie = per100({ n: "Мой смузи", k: 60, p: 1, f: 0.5, cb: 13, drink: true }).food;
  assert.equal(smoothie.drink, true);
  // вода из 330 мл колы: доля воды 1 − 10.6/100, индекс 0.9
  assert.equal(Math.round(itemWaterMl({ ...cola, g: 330 })), Math.round(330 * (1 - 0.106) * 0.9));
});

test("неправдоподобное отклоняется, сомнительное — с предупреждением", () => {
  assert.equal(per100({ n: "Ошибка", k: 100, p: 80, f: 30, cb: 10 }).error, "macros_over_100");
  assert.equal(per100({ n: "Ошибка", k: 1200, p: 0, f: 100, cb: 0 }).error, "kcal_over_900");
  assert.equal(per100({ n: "Ошибка", k: -5, p: 1, f: 1, cb: 1 }).error, "bad_number");
  assert.equal(per100({ n: "Ошибка", k: "abc" }).error, "bad_number");
  assert.equal(per100({ n: "", k: 100 }).error, "no_name");
  assert.equal(per100({ n: "Пусто" }).error, "no_values");
  assert.equal(per100({ n: "Порция", k: 100, per: 0 }).error, "bad_portion");
  assert.deepEqual(per100({ n: "Спорно", k: 500, p: 10, f: 5, cb: 20 }).warn, ["kcal_mismatch"]);
});

test("Open Food Facts: ккал, иначе кДж, иначе по БЖУ; только «на порцию» — пересчёт", () => {
  const base = { code: "4600000000017", product_name: "Йогурт", brands: "Простоквашино, Danone", categories_tags: ["en:dairies"] };
  const a = offProductToFood({ ...base, nutriments: { "energy-kcal_100g": 72, proteins_100g: 5, fat_100g: 2.5, carbohydrates_100g: 7 } });
  assert.deepEqual([a.id, a.n, a.k, a.code], ["off4600000000017", "Йогурт · Простоквашино", 72, "4600000000017"]);
  const b = offProductToFood({ ...base, nutriments: { "energy-kj_100g": 301, proteins_100g: 5, fat_100g: 2.5, carbohydrates_100g: 7 } });
  assert.equal(b.k, Math.round(301 / 4.184));
  const c = offProductToFood({ ...base, nutriments: { energy_100g: 301 } });
  assert.equal(c.k, 72, "energy_100g в OFF — это кДж");
  const d = offProductToFood({ ...base, nutriments: { proteins_100g: 5, fat_100g: 2.5, carbohydrates_100g: 7 } });
  assert.equal(d.k, Math.round(4 * 5 + 9 * 2.5 + 4 * 7));
  const e = offProductToFood({ ...base, serving_quantity: 125, nutriments: { "energy-kcal_serving": 90, proteins_serving: 6.25, fat_serving: 3.1, carbohydrates_serving: 8.75 } });
  assert.deepEqual([e.k, e.p, e.sv], [72, 5, 125]);
  // порция сохраняется и для обычных продуктов
  assert.equal(offProductToFood({ ...base, serving_quantity: "125", nutriments: { "energy-kcal_100g": 72 } }).sv, 125);
});

test("Open Food Facts: мусор и неполные данные отсеиваются", () => {
  assert.equal(offProductToFood({ code: "1", product_name: "", nutriments: { "energy-kcal_100g": 10 } }), null);
  assert.equal(offProductToFood({ code: "12345", product_name: "Без данных", nutriments: {} }), null);
  assert.equal(offProductToFood({ code: "12345", product_name: "Ошибка ввода", nutriments: { "energy-kcal_100g": 5000 } }), null);
  assert.equal(offProductToFood({ code: "12345", product_name: "Ошибка", nutriments: { proteins_100g: 90, fat_100g: 90 } }), null);
  assert.equal(offProductToFood(null), null);
  // штрихкод только из цифр, иначе продукт не попадёт в общий каталог (не проверить)
  assert.equal(offProductToFood({ code: "abc", product_name: "X", nutriments: { "energy-kcal_100g": 10 } }).code, null);
});

test("Open Food Facts: напиток по категориям, клетчатка — из данных или оценкой", () => {
  const juice = offProductToFood({ code: "4600000000024", product_name: "Добрый апельсин", categories_tags: ["en:beverages", "en:juices"], nutriments: { "energy-kcal_100g": 45, carbohydrates_100g: 10, proteins_100g: 0.7, fat_100g: 0.2 } });
  assert.deepEqual([juice.drink, juice.hy], [true, 0.9]);
  const oats = offProductToFood({ code: "4600000000031", product_name: "Овсяные хлопья", categories_tags: ["en:cereals"], nutriments: { "energy-kcal_100g": 360, carbohydrates_100g: 60, proteins_100g: 12, fat_100g: 6 } });
  assert.ok(oats.fb > 0 && oats.fbEst);
});

test("встроенный справочник проходит ту же проверку — значения правдоподобны", () => {
  for (const f of FOODS) {
    const r = per100(f);
    assert.ok(r.ok, `${f.n}: ${r.error}`);
    assert.equal(r.food.k, Math.round(f.k), f.n);
    assert.equal(!!r.food.drink, !!f.drink, `${f.n}: напиток`);
  }
});
