// Отдых между подходами: длинный, а не короткий. Короткий отдых срезает повторы
// в следующих подходах (Willardson & Burkett 2005–2006), а с ними — рост
// (Schoenfeld 2016: 3 минуты против 1; Singer 2024).
import { test } from "node:test";
import assert from "node:assert/strict";

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { smartRest } = await import("../js/model/training.js");
const { exById } = await import("../data/exercises.js");

const ex = (id) => ({ ...exById(id), id });

test("база в силовой зоне — от четырёх минут, на пятёрках пять", () => {
  assert.ok(smartRest(ex("bench"), { w: 100, r: 5 }, { target: 100 }) >= 300);
  assert.ok(smartRest(ex("squat"), { w: 140, r: 8 }, { target: 140 }) >= 240);
});

test("любой рабочий подход — не меньше двух минут, даже изоляция на 15", () => {
  for (const id of ["lat-raise", "pushdown", "curl-ez", "legext", "lat", "row"]) {
    for (const r of [8, 12, 15, 20]) {
      const s = smartRest(ex(id), { w: 20, r }, { target: 20 });
      assert.ok(s >= 120, `${id} × ${r}: ${s} с — короче двух минут рабочий подход не отдыхает`);
    }
  }
});

test("разминке хватает до двух минут, а взявшему тяжелее плана — дольше", () => {
  assert.ok(smartRest(ex("bench"), { w: 40, r: 5 }, { target: 100 }) <= 120, "разминка не держит пять минут");
  const plan = smartRest(ex("row"), { w: 80, r: 8 }, { target: 80 });
  const heavy = smartRest(ex("row"), { w: 90, r: 8 }, { target: 80 });
  assert.ok(heavy > plan, `${heavy} должно быть больше ${plan}`);
});
