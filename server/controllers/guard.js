// Общие проверки перед любой работой с базой: откуда запрос, не слишком ли часто,
// кто это и пускает ли его закрытая бета. Порядок важен: самое дешёвое — первым.
import { LIMITS, isAllowed } from "../config.js";
import { ensureSchema } from "../db/migrate.js";
import { fail } from "../http.js";
import * as rate from "../models/rateLimit.js";
import { AuthError, initDataFromRequest, verifyInitData } from "../security/telegram-auth.js";
import { clientIp, ipKey, sameOrigin } from "../security/net.js";

/** Код ошибки базы без подробностей: в журнал функции не попадают ни данные, ни SQL. */
export const logDbError = (where, e) => console.error(`${where}: db error ${e && e.code ? e.code : "unknown"}`);

/**
 * @returns {{ user } | { response }} — либо проверенный пользователь, либо готовый отказ
 */
export async function guard(request, { cfg, db, now = Date.now() }, { auth = true } = {}) {
  if (!cfg.configured || !db) return { response: fail(503, "not_configured") };
  if (!sameOrigin(request)) return { response: fail(403, "forbidden") };

  try { await ensureSchema(db); } catch (e) { logDbError("schema", e); return { response: fail(503, "db_unavailable") }; }

  const ip = ipKey(clientIp(request), cfg.botToken);
  const ipBucket = `ip:${ip}`, failBucket = `fail:${ip}`;
  let ipHits, failHits;
  try {
    const [[a], [b]] = await db.app([rate.hit(ipBucket, LIMITS.RATE_IP.windowSec), rate.peek(failBucket, LIMITS.RATE_FAIL.windowSec)]);
    ipHits = Number(a.hits); failHits = Number(b.hits);
    if (Math.random() < 0.01) await db.app([rate.sweep()]);
  } catch (e) { logDbError("rate", e); return { response: fail(503, "db_unavailable") }; }
  const retry = (sec) => ({ "retry-after": String(sec) });
  if (ipHits > LIMITS.RATE_IP.max) return { response: fail(429, "rate_limited", retry(LIMITS.RATE_IP.windowSec)) };
  if (failHits >= LIMITS.RATE_FAIL.max) return { response: fail(429, "rate_limited", retry(LIMITS.RATE_FAIL.windowSec)) };
  if (!auth) return { user: null };

  let user;
  try { user = verifyInitData(initDataFromRequest(request), cfg.botToken, { now }); } catch (e) {
    if (!(e instanceof AuthError)) throw e;
    // неудачный вход считаем: подбирать подпись перебором бессмысленно, но и даром не дадим
    try { await db.app([rate.hit(failBucket, LIMITS.RATE_FAIL.windowSec)]); } catch (err) { logDbError("rate", err); }
    return { response: fail(401, e.code === "expired" ? "expired" : "unauthorized") };
  }
  if (!isAllowed(user, cfg.allowed)) return { response: fail(403, "not_invited") };
  return { user };
}
