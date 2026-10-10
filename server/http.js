// Ответы сервера: всегда JSON, всегда без кеша, без утечек внутренностей.
import { LIMITS } from "./config.js";

const BASE_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store, max-age=0",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "cross-origin-resource-policy": "same-origin",
  "x-frame-options": "DENY",
};

export function json(status, body, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...BASE_HEADERS, ...extra } });
}

/** Ошибка для клиента: только код, без стека, SQL и прочих подробностей. */
export const fail = (status, code, extra = {}) => json(status, { error: code }, extra);

export class BodyTooLarge extends Error {}

/**
 * Прочитать тело с ограничением размера. Не верим Content-Length на слово:
 * считаем байты по мере чтения и обрываем, как только превысили.
 */
export async function readBody(request, max = LIMITS.BODY_BYTES) {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) throw new BodyTooLarge();
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { try { await reader.cancel(); } catch { /* уже закрыт */ } throw new BodyTooLarge(); }
    chunks.push(value);
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
}
