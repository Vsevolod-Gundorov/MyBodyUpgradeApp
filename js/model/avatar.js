// Модель: фото профиля. Сначала — то, что Telegram прислал в данных запуска
// (photo_url бывает только при запуске из меню вложений), иначе — через сервер,
// который берёт фото у бота. Ответ сервера хранится на устройстве сутки:
// фото не тянется заново при каждом открытии профиля.
import { tgAvatar, tgUserId } from "../telegram.js";
import { avatarGet, onServerState, serverActive } from "./server.js";

const KEY = "bodyupgrade.avatar";
const TTL = 24 * 3600 * 1000;
const DATA_URL = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/** Картинка от сервера — только data:URL известного типа и разумного размера. */
export const safeDataUrl = (v) => (typeof v === "string" && v.length < 300000 && DATA_URL.test(v) ? v : null);

function cached() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || "null");
    return c && c.uid === tgUserId() ? c : null;   // другой аккаунт — чужое фото не показываем
  } catch (e) { return null; }
}

/** Что показать прямо сейчас: адрес Телеграма, сохранённая картинка или null. */
export const avatarNow = () => tgAvatar() || (cached() && safeDataUrl(cached().photo)) || null;

let pending = null;
/**
 * Обновить фото с сервера, если сохранённое старше суток. onChange — когда картинка
 * поменялась. Сервер ещё не готов — дождёмся, пока синхронизация его включит.
 */
export function refreshAvatar(onChange = () => {}) {
  if (tgAvatar() || !tgUserId()) return;
  const c = cached();
  if (c && Date.now() - c.at < TTL) return;
  const run = async () => {
    if (pending) return pending;
    pending = (async () => {
      const got = await avatarGet();
      if (got === undefined) return;                 // сервер не ответил — попробуем в следующий раз
      const photo = safeDataUrl(got);
      const before = avatarNow();
      try { localStorage.setItem(KEY, JSON.stringify({ uid: tgUserId(), at: Date.now(), photo })); } catch (e) { /* нет места — без кэша */ }
      if (photo !== before) onChange(photo);
    })().finally(() => { pending = null; });
    return pending;
  };
  if (serverActive()) { run(); return; }
  const off = onServerState(() => { if (serverActive()) { off(); run(); } });
}
