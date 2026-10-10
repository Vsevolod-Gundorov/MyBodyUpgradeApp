// Сервер на живом Postgres: схема, RLS, гонки записей, атаки на API.
// Запуск: TEST_PG_ADMIN_URL=postgres://… npm run test:db
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import pg from "pg";
import { ADMIN_URL, freshDatabase, skip } from "./helpers.mjs";
import { fakeBotToken, signInitData } from "../helpers/telegram-sign.mjs";
import { config, LIMITS } from "../../server/config.js";
import { createDb, pgExecutor } from "../../server/db/client.js";
import { ensureSchema, _resetSchemaCache } from "../../server/db/migrate.js";
import { getJournal, pruneVersions, saveJournal } from "../../server/models/journal.js";
import { touchUser } from "../../server/models/user.js";
import { handleJournal } from "../../server/controllers/journal.js";
import { handleHealth } from "../../server/controllers/health.js";

const A = { id: 111111111, username: "vsevolod214", first_name: "Всеволод" };
const B = { id: 222222222, username: "friend_b", first_name: "Друг" };
const C = { id: 333333333, username: "stranger_c", first_name: "Чужой" };

let base, exec, db, deps, botToken;

before(async () => {
  if (skip) return;
  base = await freshDatabase();
  exec = await pgExecutor(base.ownerUrl);
  db = createDb(exec);
  botToken = fakeBotToken();
  deps = {
    cfg: config({ DATABASE_URL: base.ownerUrl, BOT_TOKEN: botToken, ALLOWED_USERS: "@VseVolod214, 222222222" }),
    db,
  };
});

after(async () => {
  if (skip) return;
  if (exec) await exec.end();
  if (base) await base.drop();
});

/* ---------- помощники ---------- */
let ipSeq = 0;
const freshIp = () => `10.0.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`;
function req(method, { user = A, initData, body, headers = {}, ip = freshIp(), path = "/api/journal" } = {}) {
  const auth = initData !== undefined ? initData : (user ? signInitData({ botToken, user }) : null);
  const h = {
    origin: "https://app.test", "sec-fetch-site": "same-origin", "x-real-ip": ip,
    ...(auth ? { authorization: `tma ${auth}` } : {}),
    ...(body !== undefined ? { "content-type": "application/json" } : {}),
    ...headers,
  };
  return new Request(`https://app.test${path}`, { method, headers: h, body });
}
const call = async (r) => { const res = await handleJournal(r, deps); return { status: res.status, body: await res.json(), res }; };
const put = (payload, opts = {}) => call(req("PUT", { ...opts, body: typeof payload === "string" ? payload : JSON.stringify(payload) }));
const journal = (n = 1) => ({ hero: { name: "Всеволод", bodyweight: 93 }, sessions: Array.from({ length: n }, (_, i) => ({ id: `s${i}`, date: "2026-10-01" })), settings: { theme: "plain" }, rev: n });

/* ================= схема и права ================= */
test("миграции: применяются один раз и переживают одновременный старт", { skip }, async () => {
  _resetSchemaCache();
  const exec2 = await pgExecutor(base.ownerUrl);
  const [v1, v2] = await Promise.all([ensureSchema(db), (async () => { _resetSchemaCache(); return ensureSchema(createDb(exec2)); })()]);
  assert.equal(v1, 1); assert.equal(v2, 1);
  _resetSchemaCache();
  assert.equal(await ensureSchema(db), 1);
  const [[n]] = await db.owner([{ text: "SELECT count(*)::int AS n FROM schema_migrations" }]);
  assert.equal(n.n, 1);
  await exec2.end();
});

test("роль приложения: не обходит RLS, не входит сама, не меняет схему", { skip }, async () => {
  await ensureSchema(db);
  const [[r]] = await db.owner([{ text: "SELECT rolbypassrls, rolcanlogin, rolsuper, rolcreaterole, rolcreatedb FROM pg_roles WHERE rolname = 'bu_app'" }]);
  assert.deepEqual(r, { rolbypassrls: false, rolcanlogin: false, rolsuper: false, rolcreaterole: false, rolcreatedb: false });
  // а владелец базы может обходить RLS (худший случай, его и проверяем) — поэтому всё пользовательское идёт через bu_app
  const [[o]] = await db.owner([{ text: "SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user" }]);
  assert.equal(o.rolbypassrls, !process.env.TEST_OWNER_NOBYPASS, "режим владельца — как задан в прогоне");

  for (const text of [
    "DROP TABLE journals", "TRUNCATE journals", "CREATE TABLE evil (x int)", "ALTER TABLE users DISABLE ROW LEVEL SECURITY",
    "SELECT * FROM schema_migrations", "DELETE FROM journals", "DELETE FROM users", "UPDATE journal_versions SET data = '{}'",
    "CREATE FUNCTION evil() RETURNS int LANGUAGE sql AS 'select 1'", "GRANT bu_app TO bu_stranger", "ALTER ROLE bu_app BYPASSRLS",
  ]) {
    await assert.rejects(db.asUser(A.id, [{ text }]), (e) => ["42501", "42P01"].includes(e.code), text);
  }
});

test("посторонняя роль базы не видит таблиц приложения", { skip }, async () => {
  const c = new pg.Client({ connectionString: base.strangerUrl });
  await c.connect();
  for (const t of ["users", "journals", "journal_versions", "rate_limits", "schema_migrations"]) {
    await assert.rejects(c.query(`SELECT * FROM ${t}`), (e) => e.code === "42501", t);
  }
  await assert.rejects(c.query("SET ROLE bu_app"), (e) => e.code === "42501");
  await c.end();
});

/* ================= RLS: каждый видит только себя ================= */
test("RLS: чужой журнал не прочитать, не изменить и не подделать даже прямым запросом", { skip }, async () => {
  await ensureSchema(db);
  const data = JSON.stringify(journal(2));
  await db.asUser(A.id, [touchUser(A.id, A.username), saveJournal({ userId: A.id, dataJson: data, rev: 2, baseRev: null, sizeBytes: data.length, reason: "save" })]);
  await db.asUser(B.id, [touchUser(B.id, B.username)]);

  // B спрашивает журнал A прямо по id — база молчит
  const [rows] = await db.asUser(B.id, [getJournal(A.id)]);
  assert.deepEqual(rows, []);
  const [all, users, vers] = await db.asUser(B.id, [
    { text: "SELECT user_id FROM journals" }, { text: "SELECT id FROM users" }, { text: "SELECT user_id FROM journal_versions" }]);
  assert.deepEqual(all, []);
  assert.deepEqual(users.map((u) => Number(u.id)), [B.id]);
  assert.deepEqual(vers, []);

  // обновить чужое — 0 строк; вставить строку от чужого имени — отказ политики
  const [upd] = await db.asUser(B.id, [{ text: "UPDATE journals SET data = '{\"pwned\":true}' WHERE user_id = $1::bigint RETURNING user_id", params: [String(A.id)] }]);
  assert.deepEqual(upd, []);
  await assert.rejects(db.asUser(B.id, [{ text: "INSERT INTO journal_versions (user_id, rev, data, reason) VALUES ($1::bigint, 1, '{}', 'save')", params: [String(A.id)] }]), (e) => e.code === "42501");
  await assert.rejects(db.asUser(B.id, [{ text: "INSERT INTO users (id) VALUES ($1::bigint)", params: [String(C.id)] }]), (e) => e.code === "42501");
  // перезаписать чужой журнал через upsert — тоже отказ
  await assert.rejects(db.asUser(B.id, [saveJournal({ userId: A.id, dataJson: "{}", rev: 3, baseRev: 2, sizeBytes: 2, reason: "save" })]), (e) => e.code === "42501");

  // приложение без пользователя (лимиты, здоровье) не видит ничьих журналов
  const [none] = await db.app([{ text: "SELECT user_id FROM journals" }]);
  assert.deepEqual(none, []);
  // и подменить app.user_id «на лету» внутри запроса нельзя без доступа к SQL; а сам id проверяется
  await assert.rejects(db.asUser("1 OR 1=1", []), /bad user id/);
  await assert.rejects(db.asUser("-5", []), /bad user id/);

  // журнал A цел
  const [[mine]] = await db.asUser(A.id, [getJournal(A.id)]);
  assert.equal(Number(mine.rev), 2);
  assert.equal(mine.data.sessions.length, 2);
});

/* ================= инъекции ================= */
test("SQL-инъекции: опасные строки сохраняются как данные, таблицы целы", { skip }, async () => {
  const evil = ["'; DROP TABLE journals; --", "\"); DELETE FROM users; --", "$1 $2 ::bigint", "' OR '1'='1", "\\x00 \\'"];
  const data = JSON.stringify({ hero: { name: evil[0] }, notes: evil, [evil[1]]: evil[2] });
  await db.asUser(B.id, [saveJournal({ userId: B.id, dataJson: data, rev: 1, baseRev: null, sizeBytes: data.length, reason: "save" })]);
  const [[row]] = await db.asUser(B.id, [getJournal(B.id)]);
  assert.deepEqual(row.data.notes, evil);
  assert.equal(row.data[evil[1]], evil[2]);
  const [[t]] = await db.owner([{ text: "SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'" }]);
  assert.equal(t.n, 5);
  // имя пользователя с SQL до базы не доходит (проверка подписи его отбрасывает), а если бы дошло — CHECK
  await assert.rejects(db.asUser(B.id, [touchUser(B.id, "x'; DROP TABLE users; --")]), (e) => e.code === "23514");
});

/* ================= гонки и версии ================= */
test("оптимистичная блокировка: устаревшая запись не затирает свежую, гонка — один победитель", { skip }, async () => {
  const id = 444444444;
  const s = (rev, baseRev) => { const d = JSON.stringify(journal(rev)); return saveJournal({ userId: id, dataJson: d, rev, baseRev, sizeBytes: d.length, reason: "save" }); };
  await db.asUser(id, [touchUser(id, null)]);
  let [[r]] = await db.asUser(id, [s(1, null)]);
  assert.equal(Number(r.saved_rev), 1);
  [[r]] = await db.asUser(id, [s(5, null)]);                 // второй «переезд» поверх существующего — нельзя
  assert.equal(r.saved_rev, null); assert.equal(Number(r.server_rev), 1);
  [[r]] = await db.asUser(id, [s(2, 1)]);
  assert.equal(Number(r.saved_rev), 2);
  [[r]] = await db.asUser(id, [s(3, 1)]);                    // от устаревшей базы
  assert.equal(r.saved_rev, null); assert.equal(Number(r.server_rev), 2);

  const racers = await Promise.all(Array.from({ length: 6 }, (_, i) => db.asUser(id, [s(10 + i, 2)])));
  const winners = racers.filter(([[x]]) => x.saved_rev != null);
  assert.equal(winners.length, 1, "ровно одна запись из одновременных");
  const [[fin]] = await db.asUser(id, [getJournal(id)]);
  assert.equal(Number(fin.rev), Number(winners[0][0][0].saved_rev));
});

test("версии: хранятся последние 30, переезд помечен отдельно", { skip }, async () => {
  const id = 555555555;
  await db.asUser(id, [touchUser(id, null)]);
  const d0 = JSON.stringify(journal(1));
  await db.asUser(id, [saveJournal({ userId: id, dataJson: d0, rev: 1, baseRev: null, sizeBytes: d0.length, reason: "migrate" })]);
  const [[first]] = await db.asUser(id, [{ text: "SELECT rev, reason FROM journal_versions" }]);
  assert.deepEqual({ rev: Number(first.rev), reason: first.reason }, { rev: 1, reason: "migrate" }, "переезд записан в историю отдельной пометкой");
  for (let rev = 2; rev <= 40; rev++) {
    const d = JSON.stringify(journal(rev));
    await db.asUser(id, [saveJournal({ userId: id, dataJson: d, rev, baseRev: rev - 1, sizeBytes: d.length, reason: "save" }), pruneVersions(id, LIMITS.VERSIONS_KEPT)]);
  }
  const [v] = await db.asUser(id, [{ text: "SELECT rev, reason FROM journal_versions ORDER BY id" }]);
  assert.equal(v.length, 30);
  assert.equal(Number(v[0].rev), 11); assert.equal(Number(v.at(-1).rev), 40);
});

/* ================= API: вход ================= */
test("API: без подписи, с поддельной, с чужим токеном и просроченной — отказ", { skip }, async () => {
  assert.equal((await call(req("GET", { user: null }))).status, 401);
  const good = signInitData({ botToken, user: A });
  const tampered = good.replace(encodeURIComponent("vsevolod214"), encodeURIComponent("friend_b"));
  assert.notEqual(tampered, good);
  assert.equal((await call(req("GET", { initData: tampered }))).status, 401);
  assert.equal((await call(req("GET", { initData: signInitData({ botToken: fakeBotToken(), user: A }) }))).status, 401);
  const old = await call(req("GET", { initData: signInitData({ botToken, user: A, authDate: Math.floor(Date.now() / 1000) - 2 * 86400 }) }));
  assert.deepEqual([old.status, old.body.error], [401, "expired"]);
  const future = await call(req("GET", { initData: signInitData({ botToken, user: A, authDate: Math.floor(Date.now() / 1000) + 3600 }) }));
  assert.equal(future.status, 401);
  // подпись верная, но id подменён на строку с SQL — отказ ещё до базы
  assert.equal((await call(req("GET", { initData: signInitData({ botToken, user: { id: "1 OR 1=1" } }) }))).status, 401);
  // дубликат поля — признак склейки
  assert.equal((await call(req("GET", { initData: `${good}&user=${encodeURIComponent(JSON.stringify(B))}` }))).status, 401);
  // ответ на ошибку — только код, никаких подробностей
  const r = await call(req("GET", { initData: tampered }));
  assert.deepEqual(Object.keys(r.body), ["error"]);
});

test("API: закрытая бета пускает только приглашённых (по @username без учёта регистра и по id)", { skip }, async () => {
  assert.equal((await call(req("GET", { user: A }))).status, 200);
  assert.equal((await call(req("GET", { user: B }))).status, 200);
  const c = await call(req("GET", { user: C }));
  assert.deepEqual([c.status, c.body.error], [403, "not_invited"]);
  // пустой список — не пускаем никого
  const closed = { ...deps, cfg: config({ DATABASE_URL: base.ownerUrl, BOT_TOKEN: botToken, ALLOWED_USERS: "" }) };
  assert.equal((await handleJournal(req("GET", { user: A }), closed)).status, 403);
});

test("API: чужие сайты, методы и типы содержимого отклоняются", { skip }, async () => {
  assert.equal((await call(req("GET", { headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" } }))).status, 403);
  assert.equal((await call(req("PUT", { body: "{}", headers: { origin: "https://evil.example" } }))).status, 403);
  assert.equal((await call(req("PUT", { body: "{}", headers: { origin: "", "sec-fetch-site": "" } }))).status, 403, "запись без Origin");
  assert.equal((await call(req("DELETE"))).status, 405);
  assert.equal((await call(req("POST", { body: "{}" }))).status, 405);
  assert.equal((await put(JSON.stringify({ rev: 1, baseRev: null, data: {} }), { headers: { "content-type": "text/plain" } })).status, 415);
  const notConf = await handleJournal(req("GET"), { cfg: config({}), db: null });
  assert.equal(notConf.status, 503);
});

/* ================= API: журнал ================= */
test("API: переезд журнала, чтение, обновление, конфликт двух устройств", { skip }, async () => {
  const user = { id: 666666666, username: "vsevolod214" };
  let g = await call(req("GET", { user }));
  assert.deepEqual(g.body, { exists: false });

  const original = journal(7);
  let p = await put({ rev: 7, baseRev: null, reason: "migrate", data: original }, { user });
  assert.equal(p.status, 200); assert.equal(p.body.rev, 7);
  g = await call(req("GET", { user }));
  assert.equal(g.body.exists, true); assert.equal(g.body.rev, 7);
  assert.deepEqual(g.body.data, original, "журнал переехал байт в байт");
  assert.equal(g.res.headers.get("cache-control"), "no-store, max-age=0");

  // повторный переезд не затирает уже переехавшее
  p = await put({ rev: 1, baseRev: null, reason: "migrate", data: journal(1) }, { user });
  assert.deepEqual([p.status, p.body], [409, { error: "conflict", serverRev: 7 }]);

  p = await put({ rev: 8, baseRev: 7, data: journal(8) }, { user });
  assert.equal(p.status, 200);
  p = await put({ rev: 8, baseRev: 7, data: journal(8) }, { user });     // второе устройство со старой базой
  assert.deepEqual([p.status, p.body.serverRev], [409, 8]);

  // соседний пользователь своего журнала не имеет и чужой не видит
  const other = await call(req("GET", { user: B }));
  assert.equal(other.status, 200);
  assert.notEqual(other.body.rev, 8);
  assert.notDeepEqual(other.body.data, journal(8));
});

test("API: тело запроса проверяется до базы", { skip }, async () => {
  const user = { id: 777777777, username: "friend_b" };
  const deny = { ...deps, cfg: config({ DATABASE_URL: base.ownerUrl, BOT_TOKEN: botToken, ALLOWED_USERS: "777777777" }) };
  const p = async (payload, extra = {}) => { const r = await handleJournal(req("PUT", { user, body: payload, ...extra }), deny); return { status: r.status, body: await r.json() }; };
  assert.deepEqual(await p("не json"), { status: 400, body: { error: "bad_json" } });
  assert.equal((await p(JSON.stringify({ rev: 1, baseRev: null, data: [] }))).status, 400);
  assert.equal((await p('{"rev":1,"baseRev":null,"data":{"__proto__":{"admin":true}}}')).body.error, "forbidden_key");
  assert.equal((await p(JSON.stringify({ rev: 1, baseRev: null, data: { a: "x\u0000y" } }))).body.error, "nul_in_string");
  assert.equal((await p('{"rev":1,"baseRev":null,"data":{"a":"\\ud800"}}')).body.error, "bad_unicode");
  assert.equal((await p(JSON.stringify({ rev: 1, baseRev: null, data: {}, userId: 1 }))).body.error, "unknown_fields");
  assert.equal((await p(JSON.stringify({ rev: 1, baseRev: null, data: {}, reason: "admin" }))).body.error, "bad_reason");
  assert.equal((await p(JSON.stringify({ rev: 1e300, baseRev: null, data: {} }))).body.error, "bad_rev");
  assert.equal((await p(JSON.stringify({ rev: 2, baseRev: 5, data: {} }))).body.error, "rev_not_increasing");
  let deep = {}; const root = deep; for (let i = 0; i < 40; i++) { deep.x = {}; deep = deep.x; }
  assert.equal((await p(JSON.stringify({ rev: 1, baseRev: null, data: root }))).body.error, "too_deep");
  // больше 3 МБ — 413, даже если Content-Length врёт
  const big = JSON.stringify({ rev: 1, baseRev: null, data: { s: Array.from({ length: 200 }, () => "x".repeat(19_000)) } });
  assert.equal((await p(big)).status, 413);
  const lying = new Request("https://app.test/api/journal", {
    method: "PUT", duplex: "half",
    headers: { origin: "https://app.test", "sec-fetch-site": "same-origin", "content-type": "application/json", "x-real-ip": freshIp(), authorization: `tma ${signInitData({ botToken, user })}` },
    body: new ReadableStream({ start(c) { for (let i = 0; i < 5; i++) c.enqueue(new TextEncoder().encode("x".repeat(1024 * 1024))); c.close(); } }),
  });
  assert.equal((await handleJournal(lying, deny)).status, 413);
  // не UTF-8
  const bin = new Request("https://app.test/api/journal", {
    method: "PUT", body: new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]),
    headers: { origin: "https://app.test", "sec-fetch-site": "same-origin", "content-type": "application/json", "x-real-ip": freshIp(), authorization: `tma ${signInitData({ botToken, user })}` },
  });
  assert.equal((await handleJournal(bin, deny)).status, 400);
  // ничего из этого в базу не попало
  const [[n]] = await db.owner([{ text: "SELECT count(*)::int AS n FROM journals WHERE user_id = 777777777" }]);
  assert.equal(n.n, 0);
});

/* ================= API: лимиты ================= */
test("лимиты: перебор подписей с одного адреса и поток записей упираются в 429", { skip }, async () => {
  const ip = "203.0.113.7";
  const bad = signInitData({ botToken: fakeBotToken(), user: A });
  for (let i = 0; i < LIMITS.RATE_FAIL.max; i++) assert.equal((await call(req("GET", { initData: bad, ip }))).status, 401);
  const blocked = await call(req("GET", { user: A, ip }));    // даже с верной подписью — адрес уже заблокирован
  assert.equal(blocked.status, 429);
  assert.equal(blocked.res.headers.get("retry-after"), String(LIMITS.RATE_FAIL.windowSec));
  // в базе — только хэш адреса, не сам адрес
  const [rows] = await db.owner([{ text: "SELECT bucket FROM rate_limits" }]);
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => !r.bucket.includes("203.0.113.7")));

  const user = { id: 888888888, username: "vsevolod214" };
  let last;
  for (let i = 0; i <= LIMITS.RATE_WRITE.max; i++) last = await put("{}", { user });   // невалидные, но считаются
  assert.equal(last.status, 429);
});

/* ================= здоровье ================= */
test("/api/health: база отвечает, схема на месте, роль приложения под RLS", { skip }, async () => {
  const res = await handleHealth(req("GET", { user: null, path: "/api/health" }), deps);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, configured: true, db: "ok", schema: 1, rls: true, isolation: "role" });
  const off = await handleHealth(req("GET", { user: null, path: "/api/health" }), { cfg: config({}), db: null });
  assert.deepEqual(await off.json(), { ok: false, configured: false });
});

/* ================= жёсткая граница: отдельный логин приложения ================= */
test("DATABASE_URL_APP: даже произвольный SQL с RESET ROLE не выходит за RLS", { skip }, async () => {
  // режим по умолчанию: SET ROLE откатывается — поэтому там защита от инъекций держится на параметрах
  await assert.doesNotReject(db.asUser(A.id, [{ text: "RESET ROLE" }]));

  // отдельный логин, как в SETUP.md: состоит только в bu_app
  const pw = randomBytes(16).toString("hex");
  const admin = new pg.Client({ connectionString: base.ownerUrl });
  await admin.connect();
  await admin.query(`CREATE ROLE bu_web LOGIN PASSWORD ${admin.escapeLiteral(pw)} IN ROLE bu_app`);
  await admin.end();
  const u = new URL(base.ownerUrl); u.username = "bu_web"; u.password = pw;
  const appExec = await pgExecutor(u.toString());
  const hard = createDb(exec, appExec);
  try {
    assert.equal(hard.isolation, "login");
    // атакующий выполнил что угодно от имени B: сбросил роль и читает всё подряд
    const [, , theirs] = await hard.asUser(B.id, [{ text: "RESET ROLE" }, { text: "SELECT set_config('app.user_id', $1, true)", params: [String(B.id)] }, { text: "SELECT user_id FROM journals" }]);
    assert.deepEqual(theirs.map((r) => Number(r.user_id)), [B.id], "видит только свой журнал");
    for (const text of ["SET ROLE bu_owner", "DROP TABLE journals", "SELECT * FROM schema_migrations", "ALTER TABLE journals NO FORCE ROW LEVEL SECURITY"]) {
      await assert.rejects(hard.asUser(B.id, [{ text: "RESET ROLE" }, { text }]), (e) => ["42501"].includes(e.code), text);
    }
    // API в этом режиме работает так же
    const res = await handleJournal(req("GET", { user: A }), { ...deps, db: hard });
    assert.equal(res.status, 200);
    const h = await handleHealth(req("GET", { user: null, path: "/api/health" }), { ...deps, db: hard });
    assert.equal((await h.json()).isolation, "login");
  } finally { await appExec.end(); }
});

test("адрес админа базы задан только окружением", { skip }, () => {
  assert.ok(ADMIN_URL.startsWith("postgres"));
});
