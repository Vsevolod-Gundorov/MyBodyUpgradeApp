// Общий каталог продуктов на живом Postgres: поиск, пополнение с перепроверкой в OFF, атаки.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { SCHEMA_VERSION } from "../../server/db/migrations.js";
import { freshDatabase, skip } from "./helpers.mjs";
import { fakeBotToken, signInitData } from "../helpers/telegram-sign.mjs";
import { config, LIMITS } from "../../server/config.js";
import { createDb, pgExecutor } from "../../server/db/client.js";
import { ensureSchema, _resetSchemaCache } from "../../server/db/migrate.js";
import { handleFoods, queryWords } from "../../server/controllers/foods.js";
import { handleHealth } from "../../server/controllers/health.js";

const U = { id: 610000001, username: "eater", first_name: "Едок" };
const V = { id: 610000002, username: "other", first_name: "Другой" };
let base, exec, db, botToken, offCalls, offProducts;

// подставной Open Food Facts: настоящие запросы в тестах не уходят
const offFetch = async (code) => {
  offCalls.push(code);
  if (code === "5000000000000") throw new Error("network");
  return offProducts[code] || null;
};
const deps = (limits) => ({
  cfg: config({ DATABASE_URL: base.ownerUrl, BOT_TOKEN: botToken }), db, offFetch,
  limits: limits ? { ...LIMITS, ...limits } : LIMITS,
});

before(async () => {
  if (skip) return;
  base = await freshDatabase();
  exec = await pgExecutor(base.ownerUrl);
  db = createDb(exec);
  botToken = fakeBotToken();
  _resetSchemaCache();
  offCalls = [];
  offProducts = {
    "4607001771234": { product_name: "Творог 5%", brands: "Простоквашино", nutriments: { "energy-kcal_100g": 121, proteins_100g: 17, fat_100g: 5, carbohydrates_100g: 1.8 } },
    "4600000000123": { product_name: "Куриная грудка филе", brands: "Петелинка", nutriments: { "energy-kcal_100g": 113, proteins_100g: 23.6, fat_100g: 1.9, carbohydrates_100g: 0 } },
    "4600000000222": { product_name: "Сок яблочный", brands: "Добрый", categories_tags: ["en:beverages", "en:juices"], serving_quantity: 200, nutriments: { "energy-kcal_100g": 46, proteins_100g: 0.5, fat_100g: 0, carbohydrates_100g: 10.9 } },
    "4600000000333": { product_name: "Ёжики мясные", nutriments: { "energy-kj_100g": 900, proteins_100g: 12, fat_100g: 14, carbohydrates_100g: 8 } },
    "4600000000999": { product_name: "Ошибка ввода", nutriments: { "energy-kcal_100g": 9999 } },
    "4600000000555": { product_name: "<img src=x onerror=alert(1)>", nutriments: { "energy-kcal_100g": 100, proteins_100g: 5, fat_100g: 5, carbohydrates_100g: 8 } },
  };
});
after(async () => { if (skip) return; if (exec) await exec.end(); if (base) await base.drop(); });

let ipSeq = 0;
function req(method, { user = U, body, query = "", headers = {} } = {}) {
  const h = {
    origin: "https://app.test", "sec-fetch-site": "same-origin", "x-real-ip": `10.9.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`,
    ...(user ? { authorization: `tma ${signInitData({ botToken, user })}` } : {}),
    ...(body !== undefined ? { "content-type": "application/json" } : {}),
    ...headers,
  };
  return new Request(`https://app.test/api/foods${query}`, { method, headers: h, body });
}
const call = async (r, d = deps()) => { const res = await handleFoods(r, d); return { status: res.status, body: await res.json() }; };
const add = (code, opts = {}) => call(req("POST", { ...opts, body: JSON.stringify({ code }) }), opts.deps);
const search = (q, opts = {}) => call(req("GET", { ...opts, query: `?q=${encodeURIComponent(q)}` }), opts.deps);

test("слова запроса: регистр, ё, мусор и длина", () => {
  assert.deepEqual(queryWords("  Куриная   ГРУДКА "), ["куриная", "грудка"]);
  assert.deepEqual(queryWords("Ёжики"), ["ежики"]);
  assert.equal(queryWords("к"), null);
  assert.equal(queryWords("x".repeat(61)), null);
  assert.deepEqual(queryWords("a\u0000b c"), ["a", "b", "c"]);
  assert.equal(queryWords("1 2 3 4 5 6 7").length, 5);
});

test("пополнение: сервер сам берёт продукт из OFF по штрихкоду и считает на 100 г", { skip }, async () => {
  const r = await add("4607001771234");
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.food, { id: "off4607001771234", src: "off", code: "4607001771234", n: "Творог 5% · Простоквашино", k: 121, p: 17, f: 5, cb: 1.8, fb: 0 });
  assert.deepEqual(offCalls, ["4607001771234"]);
  // напиток: признак, гидратация и порция сохраняются — вода считается так же
  const juice = await add("4600000000222");
  assert.deepEqual([juice.body.food.drink, juice.body.food.hy, juice.body.food.sv], [true, 0.9, 200]);
  // кДж → ккал
  assert.equal((await add("4600000000333")).body.food.k, Math.round(900 / 4.184));
  assert.equal((await add("4600000000123")).status, 200);
});

test("пополнение: повтор в течение месяца — без обращения в OFF, продукт поднимается в поиске", { skip }, async () => {
  offCalls = [];
  const before = await search("творог");
  await add("4607001771234", { user: V });
  await add("4607001771234", { user: V });
  assert.deepEqual(offCalls, [], "OFF не трогали");
  const [n] = await su("SELECT uses FROM foods WHERE code = '4607001771234'");
  assert.equal(n.uses, 3);
  assert.equal(before.body.foods[0].code, "4607001771234");
  // через месяц — перепроверка
  await su("UPDATE foods SET checked_at = now() - interval '31 days' WHERE code = '4607001771234'");
  await add("4607001771234");
  assert.deepEqual(offCalls, ["4607001771234"]);
});

test("пополнение: значения с телефона не принимаются, мусор из OFF — тоже", { skip }, async () => {
  // попытка «подсунуть» свои калории
  const forged = await call(req("POST", { body: JSON.stringify({ code: "4600000000123", k: 1, p: 0 }) }));
  assert.deepEqual([forged.status, forged.body.error], [400, "bad_body"]);
  for (const bad of ["", "abc", "1' OR '1'='1", "123", "9".repeat(33), "../../etc/passwd"]) {
    assert.equal((await add(bad)).status, 400, bad);
  }
  assert.deepEqual([(await add("4600000000999")).status], [422], "9999 ккал на 100 г в каталог не попадают");
  assert.equal((await add("4699999999999")).status, 422, "нет такого продукта в OFF");
  assert.equal((await add("5000000000000")).status, 502, "OFF недоступен — честный отказ, каталог цел");
  const [c] = await su("SELECT count(*)::int AS n FROM foods WHERE code IN ('4600000000999', '4699999999999', '5000000000000')");
  assert.equal(c.n, 0);
  assert.equal((await call(req("POST", { body: "{ не json" }))).status, 400);
  assert.equal((await call(req("POST", { body: JSON.stringify({ code: "4600000000123" }), headers: { "content-type": "text/plain" } }))).status, 415);
  assert.equal((await call(req("POST", { body: JSON.stringify({ code: "4600000000123", pad: "x".repeat(2000) }) }))).status, 413);
});

test("поиск: часть слова, слова в любом порядке, опечатка, ё = е", { skip }, async () => {
  const names = async (q) => (await search(q)).body.foods.map((f) => f.n);
  assert.deepEqual(await names("твор"), ["Творог 5% · Простоквашино"]);
  assert.deepEqual(await names("грудка кур"), ["Куриная грудка филе · Петелинка"]);
  assert.ok((await names("курина грутка")).includes("Куриная грудка филе · Петелинка"), "опечатки");
  assert.deepEqual(await names("ежики"), ["Ёжики мясные"]);
  assert.deepEqual(await names("ЁЖИКИ"), ["Ёжики мясные"]);
  const juice = (await search("сок")).body.foods[0];
  assert.deepEqual([juice.drink, juice.hy, juice.sv], [true, 0.9, 200]);
});

test("поиск: спецсимволы LIKE и SQL ищутся как текст, а не как шаблон", { skip }, async () => {
  for (const q of ["%%", "__", "%' OR 1=1 --", "\\\\", "'); DROP TABLE foods; --"]) {
    const r = await search(q);
    assert.equal(r.status, 200, q);
    assert.deepEqual(r.body.foods, [], `${q}: ничего лишнего`);
  }
  const [t] = await su("SELECT count(*)::int AS n FROM foods");
  assert.ok(t.n >= 4, "каталог цел");
});

test("название из OFF с HTML хранится как текст (экранирует интерфейс)", { skip }, async () => {
  const r = await add("4600000000555");
  assert.equal(r.body.food.n, "<img src=x onerror=alert(1)>");
});

test("каталог: только с подписью Telegram, со своего сайта, в пределах лимитов", { skip }, async () => {
  assert.equal((await search("творог", { user: null })).status, 401);
  assert.equal((await call(req("GET", { query: "?q=творог", headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" } }))).status, 403);
  assert.equal((await call(req("DELETE"))).status, 405);
  const tight = deps({ RATE_FOOD_SEARCH: { windowSec: 60, max: 2 } });
  const codes = [];
  for (let i = 0; i < 4; i++) codes.push((await search("творог", { user: V, deps: tight })).status);
  assert.deepEqual(codes.slice(-2), [429, 429]);
  // общий предохранитель обращений сервера в OFF
  await su("UPDATE foods SET checked_at = now() - interval '40 days'");
  const offTight = deps({ RATE_OFF_ALL: { windowSec: 60, max: 0 } });
  offCalls = [];
  const known = await add("4600000000123", { deps: offTight });
  assert.equal(known.status, 200, "известный продукт отдаём из каталога");
  assert.deepEqual(offCalls, []);
  assert.equal((await add("4600000000777", { deps: offTight })).status, 503);
});

test("роль приложения не может удалить или подменить каталог мимо сервера", { skip }, async () => {
  await assert.rejects(db.app([{ text: "DELETE FROM foods" }]), (e) => e.code === "42501");
  await assert.rejects(db.app([{ text: "TRUNCATE foods" }]), (e) => e.code === "42501");
  await assert.rejects(db.app([{ text: "UPDATE foods SET k = 1000" }]), (e) => e.code === "23514", "проверки в базе");
  await assert.rejects(db.app([{ text: "UPDATE foods SET search = 'x'" }]), (e) => ["428C9", "42601"].includes(e.code));
  const res = await handleHealth(req("GET", { user: null }), deps());
  assert.equal((await res.json()).schema, SCHEMA_VERSION);
});

async function su(text, params = []) {
  const c = new pg.Client({ connectionString: base.adminUrl });
  await c.connect();
  try { return (await c.query(text, params)).rows; } finally { await c.end(); }
}
