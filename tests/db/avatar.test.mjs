// Фото профиля через бота на живом Postgres: только своё, только с подписью,
// с лимитом частоты; токен бота не уходит ни в ответ, ни в журнал функции.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { freshDatabase, skip } from "./helpers.mjs";
import { fakeBotToken, signInitData } from "../helpers/telegram-sign.mjs";
import { config, LIMITS } from "../../server/config.js";
import { createDb, pgExecutor } from "../../server/db/client.js";
import { _resetSchemaCache } from "../../server/db/migrate.js";
import { handleAvatar } from "../../server/controllers/avatar.js";

const U = { id: 630000001, username: "lifter", first_name: "Атлет" };
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100, 1)]);
let base, exec, db, botToken;

function fakeTelegram({ fail = 0 } = {}) {
  const st = { asked: [] };
  st.fetchImpl = async (url, init = {}) => {
    if (fail) return { status: fail, json: async () => ({ ok: false, error_code: fail }), arrayBuffer: async () => Buffer.alloc(0) };
    if (url.includes("/file/bot")) return { status: 200, arrayBuffer: async () => JPEG };
    const body = JSON.parse(init.body);
    const reply = (obj) => ({ status: 200, json: async () => obj });
    if (url.endsWith("/getUserProfilePhotos")) { st.asked.push(body.user_id); return reply({ ok: true, result: { photos: [[{ file_id: `f${body.user_id}`, width: 160 }]] } }); }
    if (url.endsWith("/getFile")) return reply({ ok: true, result: { file_path: "profile_photos/file_1.jpg" } });
    return reply({ ok: false, error_code: 404 });
  };
  return st;
}

const deps = (tg, extra = {}) => ({ cfg: config({ DATABASE_URL: base.ownerUrl, BOT_TOKEN: botToken }), db, tg: { fetchImpl: tg.fetchImpl }, limits: LIMITS, ...extra });
let ipSeq = 0;
const req = ({ user = U, method = "GET", query = "", headers = {} } = {}) => new Request(`https://app.test/api/avatar${query}`, {
  method, headers: { origin: "https://app.test", "sec-fetch-site": "same-origin", "x-real-ip": `10.9.0.${++ipSeq % 250}`,
    ...(user ? { authorization: `tma ${signInitData({ botToken, user })}` } : {}), ...headers },
});
const call = async (r, d) => { const res = await handleAvatar(r, d); return { status: res.status, body: await res.json(), headers: res.headers }; };

before(async () => {
  if (skip) return;
  base = await freshDatabase();
  exec = await pgExecutor(base.ownerUrl);
  db = createDb(exec);
  botToken = fakeBotToken();
  _resetSchemaCache();
});
after(async () => { if (skip) return; if (exec) await exec.end(); if (base) await base.drop(); });

test("своё фото: data:URL, без кеша на промежуточных узлах", { skip }, async () => {
  const tg = fakeTelegram();
  const r = await call(req(), deps(tg));
  assert.equal(r.status, 200);
  assert.match(r.body.photo, /^data:image\/jpeg;base64,/);
  assert.deepEqual(tg.asked, [U.id], "спросили только про того, кто подписал запрос");
  assert.match(r.headers.get("cache-control"), /no-store/);
});

test("чужое фото не попросить: параметры запроса игнорируются", { skip }, async () => {
  const tg = fakeTelegram();
  await call(req({ query: "?user_id=1&id=1" }), deps(tg));
  assert.deepEqual(tg.asked, [U.id]);
});

test("без подписи, с чужого сайта и не GET — отказ, Telegram не трогаем", { skip }, async () => {
  const tg = fakeTelegram();
  assert.equal((await call(req({ user: null }), deps(tg))).status, 401);
  assert.equal((await call(req({ headers: { "sec-fetch-site": "cross-site", origin: "https://evil.example" } }), deps(tg))).status, 403);
  assert.equal((await call(req({ method: "POST" }), deps(tg))).status, 405);
  assert.deepEqual(tg.asked, []);
});

test("ошибка Telegram — 502 без подробностей и без токена в журнале", { skip }, async () => {
  const logs = []; const orig = console.error; console.error = (...a) => logs.push(a.join(" "));
  try {
    const r = await call(req(), deps(fakeTelegram({ fail: 500 })));
    assert.equal(r.status, 502);
    assert.deepEqual(r.body, { error: "telegram_unavailable", tg: 500 }, "наружу — только код Telegram");
  } finally { console.error = orig; }
  assert.ok(logs.length && logs.every((l) => !l.includes(botToken) && !l.includes(botToken.split(":")[1])), "токен не в журнале");
});

test("лимит частоты на пользователя", { skip }, async () => {
  const tg = fakeTelegram();
  const limits = { ...LIMITS, RATE_AVATAR: { windowSec: 3600, max: 2 } };
  const user = { ...U, id: U.id + 1 };
  const codes = [];
  for (let i = 0; i < 4; i++) codes.push((await call(req({ user }), deps(tg, { limits }))).status);
  assert.deepEqual(codes, [200, 200, 429, 429]);
  assert.equal(tg.asked.length, 2, "после лимита Telegram не дёргаем");
});
