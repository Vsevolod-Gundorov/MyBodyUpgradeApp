// Модель: фото профиля. Главное — фото через сервер: он берёт его у бота и отдаёт
// картинкой data:, без сторонних запросов с телефона. Ссылка photo_url из данных
// запуска — только запасной вариант, пока сервер не ответил: её картинка лежит
// на CDN Телеграма и может не загрузиться. Фото хранится на устройстве сутки, «фото нет» —
// четверть часа: поставил фото в Telegram — оно появится, не дожидаясь завтра.
import { tgAvatar, tgUserId } from "../telegram.js";
import { avatarGet, onServerState, serverActive } from "./server.js";

const KEY = "bodyupgrade.avatar";
const TTL_PHOTO = 24 * 3600 * 1000;
const TTL_NONE = 15 * 60 * 1000;
const DATA_URL = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/** Картинка от сервера — только data:URL известного типа и разумного размера. */
export const safeDataUrl = (v) => (typeof v === "string" && v.length < 300000 && DATA_URL.test(v) ? v : null);

function cached() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || "null");
    return c && c.uid === tgUserId() ? c : null;   // другой аккаунт — чужое фото не показываем
  } catch (e) { return null; }
}
const fresh = (c) => !!c && Date.now() - c.at < (c.photo ? TTL_PHOTO : TTL_NONE);

/** Что показать прямо сейчас: фото от сервера, иначе ссылка Телеграма, иначе null (инициалы). */
export const avatarNow = () => (cached() && safeDataUrl(cached().photo)) || tgAvatar() || null;

/** Ответ сервера: ok — фото есть; none — Telegram не показывает фото боту; иначе — сбой, спросим позже. */
export function avatarOutcome({ status, json }) {
  if (status === 200 && json && safeDataUrl(json.photo)) return { state: "ok", photo: json.photo };
  if (status === 200 && json && json.photo === null) return { state: "none" };
  return { state: "error" };
}

let pending = null;
/**
 * Обновить фото с сервера, если сохранённое устарело. onChange(photo) — картинка
 * поменялась. Сервер ещё не готов — дождёмся, пока синхронизация его включит.
 */
export function refreshAvatar({ onChange = () => {} } = {}) {
  if (!tgUserId() || fresh(cached())) return;
  const run = async () => {
    if (pending) return;
    pending = true;
    try {
      const out = avatarOutcome(await avatarGet());
      if (out.state === "error") return;
      const before = avatarNow();
      try { localStorage.setItem(KEY, JSON.stringify({ uid: tgUserId(), at: Date.now(), photo: out.photo || null })); } catch (e) { /* нет места — без кэша */ }
      if (avatarNow() !== before) onChange(avatarNow());
    } finally { pending = null; }
  };
  if (serverActive()) { run(); return; }
  const off = onServerState(() => { if (serverActive()) { off(); run(); } });
}
