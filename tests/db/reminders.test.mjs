// Напоминания в Telegram на живом Postgres: изоляция, расписание, повторы, атаки.
// Telegram подменён: настоящие сообщения в тестах не уходят.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { freshDatabase, skip } from "./helpers.mjs";
import { fakeBotToken, signInitData } from "../helpers/telegram-sign.mjs";
import { config, LIMITS } from "../../server/config.js";
import { createDb, pgExecutor } from "../../server/db/client.js";
import { _resetSchemaCache } from "../../server/db/migrate.js";
import { handleReminders, runCron } from "../../server/controllers/reminders.js";
import { handleJournal } from "../../server/controllers/journal.js";
import { handleHealth } from "../../server/controllers/health.js";

const U = { id: 620000001, username: "lifter", first_name: "Атлет" };
const V = { id: 620000002, username: "other", first_name: "Другой" };
const SECRET = "s".repeat(40);
let base, exec, db, botToken, tg;

// подставной Bot API: запоминает, что отправили и что удалили
function fakeTelegram() {
  const state = { sent: [], deleted: [], blocked: new Set(), nextId: 100 };
  state.fetchImpl = async (url, init) => {
    const method = url.split("/").pop();
    const body = JSON.parse(init.body);
    const reply = (obj) => ({ status: 200, json: async () => obj });
    if (state.blocked.has(String(body.chat_id))) return { status: 403, json: async () => ({ ok: false, error_code: 403 }) };
    if (method === "sendMessage") { const id = state.nextId++; state.sent.push({ ...body, id }); return reply({ ok: true, result: { message_id: id } }); }
    if (method === "deleteMessage") { state.deleted.push(body.message_id); return reply({ ok: true, result: true }); }
    return reply({ ok: false, error_code: 404 });
  };
  return state;
}

const deps = (extra = {}) => ({
  cfg: config({ DATABASE_URL: base.ownerUrl, BOT_TOKEN: botToken, CRON_SECRET: SECRET, APP_URL: "https://app.test" }), db,
  tg: { fetchImpl: tg.fetchImpl }, sleep: async () => {}, limits: LIMITS, ...extra,
});

before(async () => {
  if (skip) return;
  base = await freshDatabase();
  exec = await pgExecutor(base.ownerUrl);
  db = createDb(exec);
  botToken = fakeBotToken();
  _resetSchemaCache();
});
after(async () => { if (skip) return; if (exec) await exec.end(); if (base) await base.drop(); });

let ipSeq = 0;
function req(method, { user = U, body, query = "", headers = {}, path = "/api/reminders" } = {}) {
  const h = {
    origin: "https://app.test", "sec-fetch-site": "same-origin", "x-real-ip": `10.7.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`,
    ...(user ? { authorization: `tma ${signInitData({ botToken, user })}` } : {}),
    ...(body !== undefined ? { "content-type": "application/json" } : {}),
    ...headers,
  };
  return new Request(`https://app.test${path}${query}`, { method, headers: h, body: body === undefined ? undefined : (typeof body === "string" ? body : JSON.stringify(body)) });
}
const call = async (r, d = deps()) => { const res = await handleReminders(r, d); return { status: res.status, body: await res.json() }; };
const settings = (o = {}) => ({ supp: true, rest: true, tz: 180, slots: [{ slot: "Утро", at: 480, items: [{ id: "creatine", text: "Креатин 5 г" }, { id: "omega3", text: "Омега-3 2 капс" }] }], ...o });
// 08:20 по Москве (UTC+3) — утренний слот наступил 20 минут назад
const MORNING = Date.UTC(2026, 9, 10, 5, 20);

test("схема 4: таблицы напоминаний под RLS, health это видит", { skip }, async () => {
  tg = fakeTelegram();
  const res = await handleHealth(new Request("https://app.test/api/health", { headers: { origin: "https://app.test", "sec-fetch-site": "same-origin", "x-real-ip": "10.7.0.1" } }), deps());
  const h = await res.json();
  assert.equal(h.schema, 4); assert.equal(h.rls, true);
});

test("настройки: только свои, строгая проверка тела", { skip }, async () => {
  tg = fakeTelegram();
  assert.equal((await call(req("PUT", { body: settings() }))).status, 200);
  assert.equal((await call(req("PUT", { user: V, body: settings({ supp: false }) }))).status, 200);
  // лишние поля, чужие типы, длинные тексты, неизвестный слот — отказ
  for (const bad of [{ ...settings(), admin: true }, settings({ tz: 5000 }), settings({ supp: "yes" }),
    settings({ slots: [{ slot: "Полночь", at: 0, items: [{ id: "x", text: "y" }] }] }),
    settings({ slots: [{ slot: "Утро", at: 480, items: [{ id: "../../etc", text: "y" }] }] }),
    settings({ slots: Array.from({ length: 9 }, () => ({ slot: "Утро", at: 1, items: [{ id: "a", text: "b" }] })) })]) {
    const r = await call(req("PUT", { body: bad }));
    assert.equal(r.status, 400, JSON.stringify(bad).slice(0, 80));
  }
  assert.equal((await call(req("PUT", { body: "{not json" }))).status, 400);
  assert.equal((await call(req("PUT", { body: settings(), user: null }))).status, 401);
  // строки других людей роль приложения не видит даже без WHERE
  const c = new pg.Client({ connectionString: base.ownerUrl });
  await c.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT set_config('app.user_id', $1, true)", [String(U.id)]);
    await c.query("SET LOCAL ROLE bu_app");
    const { rows } = await c.query("SELECT user_id FROM reminder_settings");
    assert.deepEqual(rows.map((r) => String(r.user_id)), [String(U.id)]);
    await c.query("ROLLBACK");
    // расписание видит только включивших добавки и не может писать
    await c.query("BEGIN");
    await c.query("SELECT set_config('app.cron', 'reminders', true)");
    await c.query("SET LOCAL ROLE bu_app");
    const all = await c.query("SELECT user_id FROM reminder_settings");
    assert.deepEqual(all.rows.map((r) => String(r.user_id)), [String(U.id)], "V выключил добавки — его не видно");
    const upd = await c.query("UPDATE reminder_settings SET supp = false RETURNING user_id");
    assert.equal(upd.rowCount, 0, "расписание ничего не меняет");
    const j = await c.query("SELECT count(*)::int AS n FROM journals");
    assert.equal(j.rows[0].n, 0, "журналы расписанию не видны");
    await c.query("ROLLBACK");
  } finally { await c.end(); }
});

test("расписание: без секрета — 404, с секретом — напоминание, один раз, удаляется через минуту", { skip }, async () => {
  tg = fakeTelegram();
  assert.equal((await call(req("GET", { user: null, query: "?cron=1" }))).status, 404);
  assert.equal((await call(req("GET", { user: null, query: "?cron=1", headers: { authorization: "Bearer wrong" } }))).status, 404);
  assert.equal((await call(req("GET", { user: null, query: "?cron=1", headers: { authorization: `Bearer ${SECRET}` } }), deps({ cfg: config({ DATABASE_URL: base.ownerUrl, BOT_TOKEN: botToken }) }))).status, 404, "без CRON_SECRET в окружении расписание выключено");
  const stats = await runCron(deps(), MORNING);
  assert.deepEqual(stats, { users: 1, sent: 1, failed: 0 });
  assert.equal(tg.sent.length, 1);
  assert.equal(tg.sent[0].chat_id, String(U.id));
  assert.match(tg.sent[0].text, /Креатин 5 г/); assert.match(tg.sent[0].text, /Омега-3/);
  assert.equal(tg.sent[0].parse_mode, undefined, "без разметки");
  assert.equal(tg.sent[0].reply_markup.inline_keyboard[0][0].web_app.url, "https://app.test/#buffs");
  assert.deepEqual(tg.deleted, [tg.sent[0].id], "через минуту удалено");
  // второй запуск в тот же час — не повторяет
  await runCron(deps(), MORNING + 10 * 60000);
  assert.equal(tg.sent.length, 1);
  // через два часа окно прошло — тоже тишина
  assert.equal((await runCron(deps(), MORNING + 2 * 3600000)).sent, 0);
});

test("расписание: отмеченное в журнале не напоминаем", { skip }, async () => {
  tg = fakeTelegram();
  const day = "2026-10-11";
  const morning = Date.UTC(2026, 9, 11, 5, 20);
  const data = { buffs: { log: { [day]: { "creatine@Утро": true } } } };
  const put = await handleJournal(req("PUT", { path: "/api/journal", body: { rev: 1, baseRev: 0, data, reason: "save" } }), deps());
  assert.equal(put.status, 200, await put.text());
  await runCron(deps(), morning);
  assert.equal(tg.sent.length, 1);
  assert.doesNotMatch(tg.sent[0].text, /Креатин/, "креатин уже принят");
  assert.match(tg.sent[0].text, /Омега-3/);
  // всё отмечено — сообщения нет
  tg = fakeTelegram();
  data.buffs.log[day]["omega3@Утро"] = true;
  const put2 = await handleJournal(req("PUT", { path: "/api/journal", body: { rev: 2, baseRev: 1, data, reason: "save" } }), deps());
  assert.equal(put2.status, 200);
  const evening = Date.UTC(2026, 9, 12, 5, 20);
  data.buffs.log["2026-10-12"] = { "creatine@Утро": true, "omega3@Утро": true };
  await handleJournal(req("PUT", { path: "/api/journal", body: { rev: 3, baseRev: 2, data, reason: "save" } }), deps());
  await runCron(deps(), evening);
  assert.equal(tg.sent.length, 0);
});

test("расписание: заблокировавший бота не ломает рассылку остальным", { skip }, async () => {
  tg = fakeTelegram();
  await call(req("PUT", { user: V, body: settings() }));
  tg.blocked.add(String(U.id));
  const stats = await runCron(deps(), Date.UTC(2026, 9, 13, 5, 20));
  assert.equal(stats.sent, 1); assert.equal(stats.failed, 1);
  assert.equal(tg.sent[0].chat_id, String(V.id));
});

test("отдых: напоминание с текстом подхода, отмена, проверки", { skip }, async () => {
  tg = fakeTelegram();
  const r = await call(req("POST", { body: { action: "rest", sec: 90, token: "tok12345678", text: "Жим лёжа · 105 кг × 4–6‮" } }));
  assert.equal(r.status, 202);
  assert.equal(tg.sent.length, 1);
  assert.match(tg.sent[0].text, /пора подход/); assert.match(tg.sent[0].text, /Жим лёжа · 105 кг/);
  assert.doesNotMatch(tg.sent[0].text, /‮/, "управляющие символы вычищены");
  assert.deepEqual(tg.deleted, [tg.sent[0].id]);
  // отменённый таймер не срабатывает: отмена приходит, пока «спим»
  tg = fakeTelegram();
  const d = deps({ sleep: async () => { await handleReminders(req("POST", { body: { action: "cancel" } }), deps()); } });
  assert.equal((await call(req("POST", { body: { action: "rest", sec: 60, token: "tok22222222" } }), d)).status, 202);
  assert.equal(tg.sent.length, 0, "отменили — сообщения нет");
  // плохие значения
  for (const body of [{ action: "rest", sec: 1000, token: "tok12345678" }, { action: "rest", sec: 60, token: "x" },
    { action: "rest", sec: 60, token: "tok12345678", chat_id: 1 }, { action: "nope" }, { action: "rest", sec: "60", token: "tok12345678" }]) {
    assert.equal((await call(req("POST", { body }))).status, 400, JSON.stringify(body));
  }
  // напоминания об отдыхе выключены — сервер не шлёт
  await call(req("PUT", { body: settings({ rest: false }) }));
  assert.equal((await call(req("POST", { body: { action: "rest", sec: 60, token: "tok33333333" } }))).status, 409);
});

test("проверочное сообщение: бот может писать или честно говорит, что нет", { skip }, async () => {
  tg = fakeTelegram();
  assert.equal((await call(req("POST", { body: { action: "test" } }))).status, 200);
  assert.equal(tg.sent.length, 1); assert.deepEqual(tg.deleted, [tg.sent[0].id]);
  tg.blocked.add(String(U.id));
  assert.deepEqual(await call(req("POST", { body: { action: "test" } })), { status: 409, body: { error: "bot_blocked" } });
});
