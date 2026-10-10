// Bot API Telegram: отправить и удалить сообщение. Токен — только из окружения
// и никогда не попадает ни в ответы, ни в журналы функции (в логах — лишь код ошибки).
const API = "https://api.telegram.org";

async function call(token, method, body, { timeoutMs = 6000, fetchImpl = fetch } = {}) {
  if (!/^\d{5,16}:[A-Za-z0-9_-]{30,64}$/.test(token || "")) throw new Error("bad_token");
  const res = await fetchImpl(`${API}/bot${token}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs), redirect: "error",
  });
  let json = null;
  try { json = await res.json(); } catch { /* не JSON — ниже ошибка */ }
  if (!json || json.ok !== true) {
    const e = new Error(`tg_${method}`);
    e.code = json && json.error_code ? json.error_code : res.status;   // 403 — бот заблокирован или не начат
    throw e;
  }
  return json.result;
}

/**
 * Сообщение в личный чат. Без parse_mode: текст уходит как есть, никакой разметки —
 * значит, и подсунуть в него ссылку-ловушку через название добавки нельзя.
 * openUrl — кнопка «Открыть приложение» (web_app), только https.
 */
export async function sendMessage(token, chatId, text, { openUrl = "", openText = "Открыть", ...opts } = {}) {
  const body = { chat_id: String(chatId), "text": String(text).slice(0, 1000), disable_notification: false, protect_content: true };
  if (/^https:\/\/[^\s]+$/.test(openUrl)) body.reply_markup = { inline_keyboard: [[{ "text": openText, web_app: { url: openUrl } }]] };
  const r = await call(token, "sendMessage", body, opts);
  return r && r.message_id;
}

export async function deleteMessage(token, chatId, messageId, opts = {}) {
  try { await call(token, "deleteMessage", { chat_id: String(chatId), message_id: Number(messageId) }, opts); return true; } catch (e) {
    // сообщение уже удалено человеком или старше 48 часов — удалять нечего, это не ошибка
    if (e.code === 400) return true;
    throw e;
  }
}

/** Фоновая работа после ответа (Vercel: waitUntil). Без Vercel — просто ждём её до ответа. */
export function background(promise) {
  const ctx = globalThis[Symbol.for("@vercel/request-context")];
  const c = ctx && typeof ctx.get === "function" ? ctx.get() : null;
  if (c && typeof c.waitUntil === "function") { c.waitUntil(promise); return null; }
  return promise;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
