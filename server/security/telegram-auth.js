// Проверка подписи данных Telegram Mini App (initData).
//
// Кто ты — сервер узнаёт ТОЛЬКО отсюда. Telegram подписывает данные запуска
// приложения токеном бота; подделать подпись без токена нельзя, а токен живёт
// только в окружении сервера. Никакой id из тела запроса на веру не берётся.
//
// Алгоритм — из документации Telegram (Validating data received via the Mini App):
//   secret = HMAC_SHA256(key = "WebAppData", msg = bot_token)
//   hash   = hex(HMAC_SHA256(key = secret, msg = data_check_string))
//   data_check_string — все поля, кроме hash, по алфавиту, «key=value» через \n
import { createHmac, timingSafeEqual } from "node:crypto";
import { LIMITS } from "../config.js";

const MAX_INIT_DATA = 4096;

export class AuthError extends Error {
  constructor(code) { super(code); this.code = code; }
}

/**
 * Проверить initData и вернуть пользователя.
 * @returns {{ id: string, username: string|null, authDate: number }}
 * @throws AuthError с кодом: no_init_data | malformed | bad_signature | expired | no_user
 */
export function verifyInitData(initData, botToken, { now = Date.now(), maxAgeSec = LIMITS.AUTH_MAX_AGE_SEC } = {}) {
  if (!botToken) throw new AuthError("not_configured");
  if (typeof initData !== "string" || !initData) throw new AuthError("no_init_data");
  if (initData.length > MAX_INIT_DATA) throw new AuthError("malformed");

  let params;
  try { params = new URLSearchParams(initData); } catch { throw new AuthError("malformed"); }
  const hash = params.get("hash");
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) throw new AuthError("malformed");

  // одинаковые ключи — признак подделки: в настоящих данных каждое поле одно
  const keys = [...params.keys()];
  if (new Set(keys).size !== keys.length) throw new AuthError("malformed");

  const check = keys.filter((k) => k !== "hash").sort().map((k) => `${k}=${params.get(k)}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(check).digest();
  const got = Buffer.from(hash, "hex");
  // сравнение за постоянное время: по скорости ответа подпись не подобрать
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) throw new AuthError("bad_signature");

  const authDate = Number(params.get("auth_date"));
  if (!Number.isInteger(authDate) || authDate <= 0) throw new AuthError("malformed");
  const nowSec = Math.floor(now / 1000);
  if (nowSec - authDate > maxAgeSec) throw new AuthError("expired");
  if (authDate - nowSec > LIMITS.AUTH_FUTURE_SKEW_SEC) throw new AuthError("expired");

  let user;
  try { user = JSON.parse(params.get("user") || "null"); } catch { throw new AuthError("malformed"); }
  if (!user || typeof user !== "object") throw new AuthError("no_user");
  // id храним строкой: в Telegram он до 52 бит, JS-числа его не портят, но bigint в БД — да
  const id = typeof user.id === "number" && Number.isSafeInteger(user.id) && user.id > 0 ? String(user.id) : null;
  if (!id) throw new AuthError("no_user");
  const username = typeof user.username === "string" && /^[A-Za-z0-9_]{1,64}$/.test(user.username) ? user.username : null;
  return { id, username, authDate };
}

/** Достать initData из заголовка Authorization: tma <initData>. */
export function initDataFromRequest(request) {
  const h = request.headers.get("authorization") || "";
  const m = h.match(/^tma (.+)$/s);
  return m ? m[1] : "";
}
