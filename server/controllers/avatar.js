// Контроллер: фото профиля из Telegram.
//   GET /api/avatar → { photo: "data:image/jpeg;base64,…" } или { photo: null }
// Только своё фото: пользователь берётся из подписанных данных запуска, параметров нет.
// Картинка нигде не хранится — сервер лишь передаёт её от Telegram приложению.
import { LIMITS } from "../config.js";
import { fail, json } from "../http.js";
import * as rate from "../models/rateLimit.js";
import { userPhoto } from "../telegram.js";
import { guard, logDbError } from "./guard.js";

export async function handleAvatar(request, deps) {
  if (request.method !== "GET") return fail(405, "method_not_allowed", { allow: "GET" });
  const L = deps.limits || LIMITS;
  const g = await guard(request, deps);
  if (g.response) return g.response;
  const userId = String(g.user.id);
  try {
    const [[r]] = await deps.db.app([rate.hit(`avatar:${userId}`, L.RATE_AVATAR.windowSec)]);
    if (Number(r.hits) > L.RATE_AVATAR.max) return fail(429, "rate_limited", { "retry-after": String(L.RATE_AVATAR.windowSec) });
  } catch (e) { logDbError("avatar.rate", e); return fail(503, "db_unavailable"); }
  try {
    return json(200, { photo: await userPhoto(deps.cfg.botToken, userId, deps.tg) });
  } catch (e) {
    console.error(`avatar: telegram ${e && e.code ? e.code : "error"}`);   // без токена и без адреса
    return fail(502, "telegram_unavailable");
  }
}
