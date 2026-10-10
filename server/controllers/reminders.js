// Контроллер: напоминания в Telegram.
//   PUT  /api/reminders  {supp, rest, tz, slots}       → настройки (что и когда напоминать)
//   POST /api/reminders  {action:"rest", sec, token, text?} → «пора подход» через sec секунд
//   POST /api/reminders  {action:"cancel"}              → отменить таймер отдыха (пропустил, начал раньше)
//   POST /api/reminders  {action:"test"}                → проверочное сообщение: бот может писать?
//   GET  /api/reminders?cron=1 + Authorization: Bearer CRON_SECRET → разослать добавки по расписанию
//
// Каждое сообщение висит минуту и удаляется. Ответ приложению — сразу, ожидание идёт в фоне.
import { timingSafeEqual } from "node:crypto";
import {
  DELETE_AFTER_SEC, REST_MAX_WAIT_SEC, cleanText, dueSlots, restMessage, slotKey, suppMessage, validateSettings,
} from "../../data/reminders.js";
import { LIMITS } from "../config.js";
import { ensureSchema } from "../db/migrate.js";
import { BodyTooLarge, fail, json, readBody } from "../http.js";
import * as R from "../models/reminders.js";
import * as rate from "../models/rateLimit.js";
import { background, deleteMessage, sendMessage, sleep } from "../telegram.js";
import { guard, logDbError } from "./guard.js";

const logTg = (where, e) => console.error(`${where}: telegram ${e && e.code ? e.code : "error"}`);

async function readJson(request, max = 4096) {
  const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (type !== "application/json") return { error: fail(415, "unsupported_media_type") };
  try {
    const body = JSON.parse(await readBody(request, max));
    return { body };
  } catch (e) {
    return { error: e instanceof BodyTooLarge ? fail(413, "too_large") : fail(400, "bad_json") };
  }
}

/** Удалить через минуту то, что отправили; заодно — всё просроченное у этого человека. */
async function deleteLater(deps, userId, key, messageId, { wait = DELETE_AFTER_SEC * 1000 } = {}) {
  await (deps.sleep || sleep)(wait);
  try {
    await deleteMessage(deps.cfg.botToken, userId, messageId, deps.tg);
    await deps.db.asUser(userId, [R.markDeleted(userId, key)]);
  } catch (e) { logTg("reminders.delete", e); }
}

async function sweepDeletes(deps, userId) {
  try {
    const [rows] = await deps.db.asUser(userId, [R.dueDeletes(userId)]);
    for (const r of rows) {
      try { await deleteMessage(deps.cfg.botToken, userId, r.message_id, deps.tg); await deps.db.asUser(userId, [R.markDeleted(userId, r.key)]); } catch (e) { logTg("reminders.sweep", e); }
    }
    await deps.db.asUser(userId, [R.sweepSent(userId)]);
  } catch (e) { logDbError("reminders.sweep", e); }
}

/* ---------------- конец отдыха ---------------- */
async function restJob(deps, userId, token, sec, text) {
  await (deps.sleep || sleep)(sec * 1000);
  let alive;
  try { [alive] = await deps.db.asUser(userId, [R.restAlive(userId, token)]); } catch (e) { logDbError("reminders.rest", e); return; }
  if (!alive.length) return;                        // отменили или начали новый отдых
  const key = `rest:${token}`;
  try {
    const [claimed] = await deps.db.asUser(userId, [R.claim(userId, key)]);
    if (!claimed.length) return;
    const mid = await sendMessage(deps.cfg.botToken, userId, restMessage(text), { ...deps.tg });
    await deps.db.asUser(userId, [R.markSent(userId, key, mid, DELETE_AFTER_SEC)]);
    await deleteLater(deps, userId, key, mid);
  } catch (e) { logTg("reminders.rest", e); }
}

/* ---------------- добавки по расписанию ---------------- */
export async function runCron(deps, now = Date.now()) {
  const stats = { users: 0, sent: 0, failed: 0 };
  let users;
  try { [users] = await deps.db.cron([R.suppUsers()], { readOnly: true }); } catch (e) { logDbError("reminders.cron", e); return { error: "db" }; }
  const sent = [];
  for (const u of users) {
    stats.users++;
    const userId = String(u.user_id);
    await sweepDeletes(deps, userId);
    const slotsDue = dueSlots({ tz_min: u.tz_min, slots: u.slots }, now);
    for (const s of slotsDue) {
      try {
        const [[t]] = await deps.db.asUser(userId, [R.takenOn(userId, s.day)]);
        const due = dueSlots({ tz_min: u.tz_min, slots: u.slots.filter((x) => x.slot === s.slot) }, now, (t && t.taken) || {});
        if (!due.length) continue;                  // всё уже отмечено в журнале
        const key = slotKey(s.day, s.slot);
        const [claimed] = await deps.db.asUser(userId, [R.claim(userId, key)]);
        if (!claimed.length) continue;              // этот слот сегодня уже напоминали
        try {
          const mid = await sendMessage(deps.cfg.botToken, userId, suppMessage(s.slot, due[0].items),
            { openUrl: deps.cfg.appUrl ? `${deps.cfg.appUrl.replace(/\/$/, "")}/#buffs` : "", openText: "Отметить приём", ...deps.tg });
          await deps.db.asUser(userId, [R.markSent(userId, key, mid, DELETE_AFTER_SEC)]);
          sent.push({ userId, key, mid });
          stats.sent++;
        } catch (e) {
          logTg("reminders.cron", e);
          stats.failed++;
          // 403 — человек заблокировал бота: не пытаемся снова сегодня; иначе — снимаем отметку и повторим позже
          if (e.code !== 403) await deps.db.asUser(userId, [R.unclaim(userId, key)]);
        }
      } catch (e) { logDbError("reminders.cron", e); stats.failed++; }
    }
  }
  // через минуту всё отправленное в этот запуск исчезает
  if (sent.length) {
    await (deps.sleep || sleep)(DELETE_AFTER_SEC * 1000);
    for (const m of sent) await deleteLater(deps, m.userId, m.key, m.mid, { wait: 0 });
  }
  return stats;
}

function cronAuthorized(request, secret) {
  if (!secret) return false;
  const got = Buffer.from(request.headers.get("authorization") || "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function handleReminders(request, deps) {
  const L = deps.limits || LIMITS;
  const { cfg, db } = deps;
  if (!["GET", "PUT", "POST"].includes(request.method)) return fail(405, "method_not_allowed", { allow: "GET, PUT, POST" });

  if (request.method === "GET") {
    // расписание: без секрета — 404, будто такого адреса нет
    if (!cfg.configured || !db || !cronAuthorized(request, cfg.cronSecret)) return fail(404, "not_found");
    try { await ensureSchema(db); } catch (e) { logDbError("schema", e); return fail(503, "db_unavailable"); }
    const stats = await runCron(deps);
    return stats.error ? fail(503, "db_unavailable") : json(200, stats);
  }

  const g = await guard(request, deps);
  if (g.response) return g.response;
  const { user } = g;
  const uid = String(user.id);
  try {
    const [[r]] = await db.app([rate.hit(`rm:${uid}`, L.RATE_REMIND.windowSec)]);
    if (Number(r.hits) > L.RATE_REMIND.max) return fail(429, "rate_limited", { "retry-after": String(L.RATE_REMIND.windowSec) });
  } catch (e) { logDbError("reminders.rate", e); return fail(503, "db_unavailable"); }

  const { body, error } = await readJson(request);
  if (error) return error;

  if (request.method === "PUT") {
    const v = validateSettings(body);
    if (!v.ok) return fail(400, v.error);
    try {
      const [[row]] = await db.asUser(uid, [R.putSettings(uid, v.value)]);
      return json(200, { supp: row.supp, rest: row.rest, cron: !!cfg.cronSecret });
    } catch (e) { logDbError("reminders.put", e); return fail(503, "db_unavailable"); }
  }

  // POST: действия
  if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.action !== "string") return fail(400, "bad_body");
  const allowed = { rest: ["action", "sec", "token", "text"], cancel: ["action"], test: ["action"] }[body.action];
  if (!allowed || Object.keys(body).some((k) => !allowed.includes(k))) return fail(400, "bad_body");

  if (body.action === "cancel") {
    try { await db.asUser(uid, [R.cancelRest(uid)]); return json(200, { ok: true }); } catch (e) { logDbError("reminders.cancel", e); return fail(503, "db_unavailable"); }
  }

  if (body.action === "test") {
    try {
      const key = `test:${Date.now()}`;
      await db.asUser(uid, [R.claim(uid, key)]);
      const mid = await sendMessage(cfg.botToken, uid, "✅ Напоминания включены. Это сообщение исчезнет через минуту.", { ...deps.tg });
      await db.asUser(uid, [R.markSent(uid, key, mid, DELETE_AFTER_SEC)]);
      const job = deleteLater(deps, uid, key, mid);
      const pending = background(job);
      if (pending) await pending;
      return json(200, { ok: true });
    } catch (e) {
      if (e && e.code === 403) return fail(409, "bot_blocked");     // человек не начал чат с ботом или заблокировал его
      logTg("reminders.test", e);
      return fail(502, "telegram_unavailable");
    }
  }

  // action: rest
  const sec = body.sec;
  if (!Number.isInteger(sec) || sec < 5 || sec > REST_MAX_WAIT_SEC) return fail(400, "bad_sec");
  if (typeof body.token !== "string" || !/^[A-Za-z0-9_-]{8,40}$/.test(body.token)) return fail(400, "bad_token");
  const text = body.text == null ? "" : cleanText(body.text, 80);
  try {
    const [[s]] = await db.asUser(uid, [R.getSettings(uid)]).then((r) => (r[0].length ? r : [[null]]));
    if (!s || !s.rest) return fail(409, "rest_off");
    await db.asUser(uid, [R.startRest(uid, body.token, sec)]);
  } catch (e) { logDbError("reminders.rest", e); return fail(503, "db_unavailable"); }
  const pending = background(restJob(deps, uid, body.token, sec, text));
  if (pending) await pending;                       // без Vercel (локально, в тестах) — ждём здесь
  return json(202, { ok: true });
}
