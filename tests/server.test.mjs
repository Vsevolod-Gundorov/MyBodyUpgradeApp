// Сервер без базы: подпись Telegram, проверка тела, источник запроса и статические
// запреты (SQL только с параметрами, секреты только из окружения).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fakeBotToken, signInitData } from "./helpers/telegram-sign.mjs";
import { config, isAllowed } from "../server/config.js";
import { AuthError, initDataFromRequest, verifyInitData } from "../server/security/telegram-auth.js";
import { ValidationError, parseJournalBody } from "../server/security/validate.js";
import { ipKey, sameOrigin } from "../server/security/net.js";
import { createDb } from "../server/db/client.js";
import { MIGRATIONS } from "../server/db/migrations.js";

const ROOT = new URL("..", import.meta.url).pathname;
const walk = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const SERVER = [...walk(join(ROOT, "server")), ...walk(join(ROOT, "api"))].filter((f) => f.endsWith(".js"));
const src = (f) => readFileSync(f, "utf8");
const rel = (f) => f.slice(ROOT.length);

/* ================= подпись Telegram ================= */
const TOKEN = fakeBotToken();
const USER = { id: 123456789, username: "vsevolod214", first_name: "Всеволод" };
const NOW = Date.UTC(2026, 9, 10, 12) ;
const nowSec = Math.floor(NOW / 1000);
const code = (fn) => { try { fn(); return "ok"; } catch (e) { assert.ok(e instanceof AuthError, e.message); return e.code; } };

test("подпись: настоящая принимается, id — строкой", () => {
  const u = verifyInitData(signInitData({ botToken: TOKEN, user: USER, authDate: nowSec - 60 }), TOKEN, { now: NOW });
  assert.deepEqual(u, { id: "123456789", username: "vsevolod214", authDate: nowSec - 60 });
});

test("подпись: любая подмена, чужой токен, старая или «из будущего» — отказ", () => {
  const good = signInitData({ botToken: TOKEN, user: USER, authDate: nowSec });
  const p = new URLSearchParams(good);
  p.set("user", JSON.stringify({ ...USER, id: 1 }));
  assert.equal(code(() => verifyInitData(p.toString(), TOKEN, { now: NOW })), "bad_signature");
  const p2 = new URLSearchParams(good); p2.set("auth_date", String(nowSec + 1));
  assert.equal(code(() => verifyInitData(p2.toString(), TOKEN, { now: NOW })), "bad_signature");
  assert.equal(code(() => verifyInitData(good, fakeBotToken(), { now: NOW })), "bad_signature");
  assert.equal(code(() => verifyInitData(signInitData({ botToken: TOKEN, user: USER, authDate: nowSec - 86401 }), TOKEN, { now: NOW })), "expired");
  assert.equal(code(() => verifyInitData(signInitData({ botToken: TOKEN, user: USER, authDate: nowSec + 600 }), TOKEN, { now: NOW })), "expired");
  assert.equal(code(() => verifyInitData(good.replace(/hash=[0-9a-f]+/, "hash=" + "0".repeat(64)), TOKEN, { now: NOW })), "bad_signature");
  assert.equal(code(() => verifyInitData(good.replace(/hash=[0-9a-f]+/, "hash=zz"), TOKEN, { now: NOW })), "malformed");
  assert.equal(code(() => verifyInitData(`${good}&user=x`, TOKEN, { now: NOW })), "malformed");
  assert.equal(code(() => verifyInitData("", TOKEN, { now: NOW })), "no_init_data");
  assert.equal(code(() => verifyInitData(good, "", { now: NOW })), "not_configured");
  assert.equal(code(() => verifyInitData("a=" + "x".repeat(5000), TOKEN, { now: NOW })), "malformed");
});

test("подпись: без пользователя или с кривым id — отказ; кривое имя просто отбрасывается", () => {
  assert.equal(code(() => verifyInitData(signInitData({ botToken: TOKEN, authDate: nowSec }), TOKEN, { now: NOW })), "no_user");
  for (const id of ["123", -5, 0, 1.5, 2 ** 60, null]) {
    assert.equal(code(() => verifyInitData(signInitData({ botToken: TOKEN, user: { id }, authDate: nowSec }), TOKEN, { now: NOW })), "no_user", String(id));
  }
  const u = verifyInitData(signInitData({ botToken: TOKEN, user: { id: 5, username: "x'; DROP TABLE users;--" }, authDate: nowSec }), TOKEN, { now: NOW });
  assert.equal(u.username, null);
});

test("подпись берётся только из заголовка Authorization: tma …", () => {
  const r = (h) => new Request("https://a.test/api/journal", { headers: h });
  assert.equal(initDataFromRequest(r({ authorization: "tma abc=1" })), "abc=1");
  assert.equal(initDataFromRequest(r({ authorization: "Bearer abc" })), "");
  assert.equal(initDataFromRequest(r({})), "");
});

/* ================= закрытая бета ================= */
test("закрытая бета: по умолчанию никого; @username без учёта регистра; id числом", () => {
  const none = config({}).allowed;
  assert.equal(isAllowed({ id: "1", username: "vsevolod214" }, none), false);
  const al = config({ ALLOWED_USERS: " @Vsevolod214 , 42,, friend " }).allowed;
  assert.equal(isAllowed({ id: "9", username: "VSEVOLOD214" }, al), true);
  assert.equal(isAllowed({ id: "42", username: null }, al), true);
  assert.equal(isAllowed({ id: "43", username: null }, al), false);
  assert.equal(isAllowed({ id: "43", username: "friend" }, al), true);
  assert.equal(isAllowed(null, al), false);
  assert.equal(config({ DATABASE_URL: "x" }).configured, false, "без токена бота сервер не настроен");
});

/* ================= тело запроса ================= */
const vcode = (text) => { try { parseJournalBody(text); return "ok"; } catch (e) { assert.ok(e instanceof ValidationError); return e.code; } };
test("тело: принимается обычный журнал; reason по умолчанию — save", () => {
  const b = parseJournalBody(JSON.stringify({ rev: 3, baseRev: 2, data: { sessions: [], hero: { name: "x" }, settings: {} } }));
  assert.equal(b.reason, "save");
  assert.equal(parseJournalBody(JSON.stringify({ rev: 1, baseRev: null, reason: "migrate", data: {} })).reason, "migrate");
});

test("тело: загрязнение прототипа, мусор и раздувание — отказ", () => {
  assert.equal(vcode('{"rev":1,"baseRev":null,"data":{"a":{"constructor":{"prototype":{}}}}}'), "forbidden_key");
  assert.equal(vcode('{"rev":1,"baseRev":null,"data":{"__proto__":1}}'), "forbidden_key");
  assert.equal(vcode('{"rev":1,"data":{}}'), "bad_base_rev");
  assert.equal(vcode('{"rev":-1,"baseRev":null,"data":{}}'), "bad_rev");
  assert.equal(vcode('{"rev":"1","baseRev":null,"data":{}}'), "bad_rev");
  assert.equal(vcode('{"rev":1,"baseRev":null,"data":{"sessions":{}}}'), "bad_sessions");
  assert.equal(vcode('{"rev":1,"baseRev":null,"data":{"hero":[]}}'), "bad_hero");
  assert.equal(vcode('{"rev":1,"baseRev":null,"data":null}'), "bad_data");
  assert.equal(vcode("[]"), "bad_body");
  assert.equal(vcode(JSON.stringify({ rev: 1, baseRev: null, data: { s: "x".repeat(20_001) } })), "string_too_long");
  assert.equal(vcode(JSON.stringify({ rev: 1, baseRev: null, data: { ["k".repeat(201)]: 1 } })), "key_too_long");
  assert.equal(vcode(JSON.stringify({ rev: 1, baseRev: null, data: Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`k${i}`, 1])) })), "too_many_fields");
  assert.equal(vcode(JSON.stringify({ rev: 1, baseRev: null, data: { a: Array.from({ length: 500_001 }, () => 0) } })), "array_too_long");
  assert.equal(vcode(JSON.stringify({ rev: 1, baseRev: null, data: { a: Array.from({ length: 5 }, () => Array.from({ length: 90_000 }, () => 0)) } })), "too_many_nodes");
  assert.equal(vcode('{"rev":1,"baseRev":null,"data":{"a":1e999}}'), "bad_number", "Infinity из JSON");
});

/* ================= источник запроса ================= */
test("запросы только со своего сайта: чужой Origin, cross-site и запись без Origin — нет", () => {
  const r = (method, h) => new Request("https://app.test/api/journal", { method, headers: h });
  assert.equal(sameOrigin(r("PUT", { origin: "https://app.test", "sec-fetch-site": "same-origin" })), true);
  assert.equal(sameOrigin(r("GET", {})), true, "чтение без Origin (старые WebView) допустимо: без подписи оно ничего не даст");
  assert.equal(sameOrigin(r("PUT", {})), false);
  assert.equal(sameOrigin(r("PUT", { origin: "https://evil.test" })), false);
  assert.equal(sameOrigin(r("PUT", { origin: "https://app.test.evil.test" })), false);
  assert.equal(sameOrigin(r("GET", { "sec-fetch-site": "cross-site" })), false);
  assert.equal(sameOrigin(r("GET", { "sec-fetch-site": "same-site" })), false);
  assert.equal(sameOrigin(r("PUT", { origin: "null" })), false);
});

test("адрес клиента хранится только хэшем", () => {
  const k = ipKey("203.0.113.7", "secret");
  assert.match(k, /^[0-9a-f]{32}$/);
  assert.notEqual(k, ipKey("203.0.113.7", "other"));
});

/* ================= статические запреты ================= */
test("SQL: ни одного запроса, собранного из строк; выполнять SQL умеет только db/client.js", () => {
  for (const f of SERVER) {
    const s = src(f);
    // текст запроса — только литерал без подстановок
    const sqlTemplates = [...s.matchAll(/text:\s*`([^`]*)`/g)].map((m) => m[1]);
    for (const t of sqlTemplates) assert.ok(!t.includes("${"), `${rel(f)}: подстановка в SQL`);
    assert.ok(!/text:\s*[^`"'\s{]/.test(s.replace(/text:\s*(SET_(USER|ROLE)|m\.sql)\b/g, "")), `${rel(f)}: текст запроса не литерал`);
    // и не склейка литерала с чем-то: "SELECT " + id, `…`.concat(x)
    assert.ok(!/text:\s*("[^"]*"|'[^']*'|`[^`]*`)\s*(\+|\.concat\b)/.test(s), `${rel(f)}: склейка строк в SQL`);
    assert.ok(!/\b(unsafe|escapeLiteral|escapeIdentifier)\s*\(/.test(s), `${rel(f)}: запрещённые обходы параметров`);
    if (!f.endsWith("db/client.js")) assert.ok(!/\.query\s*\(|from "pg"|@neondatabase/.test(s), `${rel(f)}: SQL выполняется в обход db/client.js`);
  }
  for (const m of MIGRATIONS) assert.ok(!/\$\{/.test(m.sql) && !/EXECUTE\s/i.test(m.sql), "миграции без динамического SQL");
});

test("секреты: окружение читает только config.js, в ответы и журналы функции они не попадают", () => {
  for (const f of SERVER) {
    const s = src(f);
    if (!/server\/(config|deps)\.js$/.test(f) && !/^api\//.test(rel(f))) assert.ok(!/process\.env/.test(s), `${rel(f)}: process.env`);
    assert.ok(!/console\.log/.test(s), `${rel(f)}: console.log`);
    // в журнал ошибок — только коды, без тел запросов, данных и токенов
    for (const m of s.matchAll(/console\.error\(([^;]*)\);/g)) assert.ok(!/(body|data|token|initData|request|params|url)\b/i.test(m[1].replace(/db (pool|error)/g, "")), `${rel(f)}: ${m[1]}`);
  }
});

test("маршруты api/ — тонкие: только вызов контроллера", () => {
  for (const f of SERVER.filter((x) => rel(x).startsWith("api/"))) {
    const s = src(f);
    assert.match(s, /from "\.\.\/server\/controllers\//);
    assert.ok(!/SELECT|INSERT|UPDATE|DELETE/.test(s), `${rel(f)}: SQL в маршруте`);
  }
});

test("db: id пользователя проверяется до запроса", async () => {
  const db = createDb(async (q) => q.map(() => []));
  await assert.rejects(db.asUser("1; DROP TABLE users", []), /bad user id/);
  await assert.rejects(db.asUser("", []), /bad user id/);
  assert.deepEqual(await db.asUser("42", [{ text: "SELECT 1" }]), [[]]);
});
