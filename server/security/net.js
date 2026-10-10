// Сеть: откуда пришёл запрос и можно ли ему верить.
import { createHmac } from "node:crypto";

/**
 * Запрос пришёл со страницы нашего же сайта?
 * Браузер сам ставит Origin и Sec-Fetch-Site — страница не может их подделать.
 * Чужой сайт не сможет ни прочитать ответ (нет CORS), ни отправить запись
 * от имени пользователя: подписанные данные Telegram у него неоткуда взять,
 * а cookies мы не используем вовсе. Проверка — ещё один слой поверх этого.
 */
export function sameOrigin(request) {
  const site = request.headers.get("sec-fetch-site");
  if (site && !["same-origin", "none"].includes(site)) return false;
  const origin = request.headers.get("origin");
  if (!origin) return request.method === "GET" || request.method === "HEAD";
  let host;
  try { host = new URL(origin).host; } catch { return false; }
  const own = request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).host;
  return host === own;
}

/** Адрес клиента. На Vercel его выставляет сама платформа, клиент подменить не может. */
export function clientIp(request) {
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  const fwd = request.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "unknown";
}

/**
 * Хэш адреса для ограничения частоты. Сам адрес в базе не хранится:
 * для лимитов достаточно знать, что запросы с одного места, но не с какого.
 */
export function ipKey(ip, secret) {
  return createHmac("sha256", `rate:${secret}`).update(String(ip)).digest("hex").slice(0, 32);
}
