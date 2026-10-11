// Модель: фото профиля. Сначала — то, что Telegram прислал в данных запуска
// (photo_url бывает только при запуске из меню вложений), иначе — через сервер,
// который берёт фото у бота. Фото хранится на устройстве сутки, «фото нет» —
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

/** Что показать прямо сейчас: адрес Телеграма, сохранённая картинка или null. */
export const avatarNow = () => tgAvatar() || (cached() && safeDataUrl(cached().photo)) || null;

/**
 * Итог запроса для человека: ok — фото есть; none — Telegram не показывает фото боту;
 * offline — сервер приложения недоступен; error — сбой (code — код Telegram или HTTP).
 */
export function avatarOutcome({ status, json }) {
  if (status === 200 && json && safeDataUrl(json.photo)) return { state: "ok", photo: json.photo };
  if (status === 200 && json && json.photo === null) return { state: "none", reason: String(json.reason || "none") };
  if (status === 0) return { state: "offline" };
  return { state: "error", code: (json && Number.isInteger(json.tg) && json.tg) || status };
}

let pending = null;
/**
 * Обновить фото с сервера. Без force — только если сохранённое устарело.
 * onChange(photo) — картинка поменялась; onResult(outcome) — чем закончилось (для «обновить фото»).
 * Сервер ещё не готов — без force дождёмся, пока синхронизация его включит.
 */
export function refreshAvatar({ force = false, onChange = () => {}, onResult = () => {} } = {}) {
  if (!tgUserId()) { onResult({ state: "offline" }); return; }
  if (!force && (tgAvatar() || fresh(cached()))) return;
  const run = () => {
    if (!pending) {
      pending = (async () => {
        const out = avatarOutcome(await avatarGet());
        if (out.state === "ok" || out.state === "none") {
          const before = avatarNow();
          try { localStorage.setItem(KEY, JSON.stringify({ uid: tgUserId(), at: Date.now(), photo: out.photo || null })); } catch (e) { /* нет места — без кэша */ }
          if (avatarNow() !== before) onChange(avatarNow());
        }
        return out;
      })().finally(() => { pending = null; });
    }
    return pending.then(onResult);
  };
  if (serverActive() || force) { run(); return; }
  const off = onServerState(() => { if (serverActive()) { off(); run(); } });
}
