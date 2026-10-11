// Контроллер: фото профиля из Telegram.
//   GET /api/avatar → { photo: "data:image/jpeg;base64,…" } или { photo: null, reason }
// Только своё фото: пользователь берётся из подписанных данных запуска, параметров нет.
// Картинка нигде не хранится — сервер лишь передаёт её от Telegram приложению.
import { LIMITS } from "../config.js";
import { fail, json } from "../http.js";
import * as rate from "../models/rateLimit.js";
import { userPhotoInfo } from "../telegram.js";
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
    return json(200, await userPhotoInfo(deps.cfg.botToken, userId, deps.tg));
  } catch (e) {
    const code = e && Number.isInteger(e.code) ? e.code : 0;
    console.error(`avatar: telegram ${code || "error"}`);   // без токена и без адреса
    // наружу — только числовой код Telegram: по нему понятно, что сломалось, и ничего лишнего
    return json(502, { error: "telegram_unavailable", tg: code });
  }
}
