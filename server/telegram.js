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

/* ---------------- фото профиля ---------------- */
// Telegram кладёт photo_url в данные запуска только для приложений из меню вложений.
// Поэтому фото берём сами: getUserProfilePhotos → getFile → файл. Токен остаётся на
// сервере: приложению уходит готовая картинка data:, а не ссылка с токеном внутри.
export const AVATAR_MAX_BYTES = 200 * 1024;
const FILE_PATH = /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_.-]+)*$/;

/** Тип картинки по первым байтам: присланному заголовку не верим. */
export function imageType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") return "image/webp";
  return null;
}

/** Самый маленький размер не меньше 160 px — на кружок 72 px хватает с запасом для ретины. */
export function pickSize(sizes = []) {
  const ok = sizes.filter((x) => x && typeof x.file_id === "string" && x.width > 0).sort((a, b) => a.width - b.width);
  return ok.find((x) => x.width >= 160 && !(x.file_size > AVATAR_MAX_BYTES)) || ok.filter((x) => !(x.file_size > AVATAR_MAX_BYTES)).pop() || null;
}

/**
 * Фото профиля: { photo: data:URL } или { photo: null, reason } — почему фото нет:
 *   none — Telegram не показывает боту ни одного фото (нет фото или скрыто приватностью);
 *   path / big / type — файл не прошёл проверку.
 */
export async function userPhotoInfo(token, userId, { timeoutMs = 6000, fetchImpl = fetch } = {}) {
  const opts = { timeoutMs, fetchImpl };
  const r = await call(token, "getUserProfilePhotos", { user_id: Number(userId), limit: 1 }, opts);
  const size = pickSize(r && Array.isArray(r.photos) ? r.photos[0] : []);
  if (!size) return { photo: null, reason: "none" };
  const f = await call(token, "getFile", { file_id: size.file_id }, opts);
  const path = f && f.file_path;
  if (typeof path !== "string" || path.length > 200 || !FILE_PATH.test(path) || path.includes("..")) return { photo: null, reason: "path" };
  const res = await fetchImpl(`${API}/file/bot${token}/${path}`, { signal: AbortSignal.timeout(timeoutMs), redirect: "error" });
  if (!res || res.status !== 200) { const e = new Error("tg_file"); e.code = res ? res.status : 0; throw e; }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > AVATAR_MAX_BYTES) return { photo: null, reason: "big" };
  const type = imageType(buf);
  return type ? { photo: `data:${type};base64,${buf.toString("base64")}` } : { photo: null, reason: "type" };
}

/** Фото профиля как data:URL или null. */
export const userPhoto = async (token, userId, opts) => (await userPhotoInfo(token, userId, opts)).photo;

/** Фоновая работа после ответа (Vercel: waitUntil). Без Vercel — просто ждём её до ответа. */
export function background(promise) {
  const ctx = globalThis[Symbol.for("@vercel/request-context")];
  const c = ctx && typeof ctx.get === "function" ? ctx.get() : null;
  if (c && typeof c.waitUntil === "function") { c.waitUntil(promise); return null; }
  return promise;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
