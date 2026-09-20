// Интеграция с Telegram Mini Apps.
// Приложение остаётся обычной веб-страницей: вне Телеграма всё работает как раньше,
// внутри — подхватываются системная кнопка «Назад», хаптика, безопасные зоны и облако.
//
// SDK подключается в index.html скриптом с telegram.org — только так Телеграм
// отдаёт актуальную версию и initData.

const tg = (typeof window !== "undefined" && window.Telegram && window.Telegram.WebApp) || null;
// platform "unknown" означает, что страницу открыли не из Телеграма (SDK подключён, но хоста нет)
export const inTelegram = !!(tg && tg.platform && tg.platform !== "unknown");
export const TG = tg;

const verAtLeast = (v) => !!(tg && tg.isVersionAtLeast && tg.isVersionAtLeast(v));
const safe = (fn) => { try { return fn(); } catch (e) { return undefined; } };

/** Инициализация: раскрыть на весь экран, покрасить шапку, заблокировать свайп-закрытие. */
export function initTelegram({ onBack } = {}) {
  if (!inTelegram) return false;
  safe(() => tg.ready());
  safe(() => tg.expand());
  // свайп вниз закрывает мини-приложение и рвёт заполнение подходов — выключаем
  if (verAtLeast("7.7")) safe(() => tg.disableVerticalSwipes());
  safe(() => tg.setHeaderColor("#06090b"));
  safe(() => tg.setBackgroundColor("#06090b"));
  // приложение вертикальное: фиксируем ориентацию, где это поддерживается
  if (verAtLeast("8.0") && tg.lockOrientation) safe(() => tg.lockOrientation());
  document.documentElement.classList.add("in-telegram");
  applyInsets();
  ["viewportChanged", "safeAreaChanged", "contentSafeAreaChanged"].forEach((ev) =>
    safe(() => tg.onEvent(ev, applyInsets)));
  if (onBack) safe(() => tg.onEvent("backButtonClicked", onBack));
  return true;
}

/** Безопасные зоны и высота вьюпорта Телеграма → CSS-переменные. */
function applyInsets() {
  if (!inTelegram) return;
  // Пока открыта клавиатура, Телеграм шлёт viewportChanged с другими отступами,
  // и экран прыгает прямо под пальцем. Переждём: как только клавиатура уедет,
  // придёт ещё одно событие, и отступы встанут на место.
  if (document.body.classList.contains("kbd")) return;
  const root = document.documentElement.style;
  const c = (tg.contentSafeAreaInset || {});
  const s = (tg.safeAreaInset || {});
  root.setProperty("--tg-top", `${(c.top || 0) + (s.top || 0)}px`);
  root.setProperty("--tg-bottom", `${(c.bottom || 0) + (s.bottom || 0)}px`);
  if (tg.viewportStableHeight) root.setProperty("--tg-vh", `${tg.viewportStableHeight}px`);
}

/** Системная кнопка «Назад»: показываем на вложенных экранах, прячем на корневых. */
export function setBackButton(visible) {
  if (!inTelegram || !tg.BackButton) return;
  safe(() => (visible ? tg.BackButton.show() : tg.BackButton.hide()));
}

/** Хаптика Телеграма вместо navigator.vibrate — на iOS вибрация иначе не работает. */
export function tgHaptic(pattern) {
  if (!inTelegram || !tg.HapticFeedback) return false;
  const h = tg.HapticFeedback;
  const total = Array.isArray(pattern) ? pattern.reduce((a, b) => a + b, 0) : (pattern || 0);
  return !!safe(() => {
    if (Array.isArray(pattern) && pattern.length > 1) h.notificationOccurred("success");
    else if (total >= 30) h.impactOccurred("heavy");
    else if (total >= 15) h.impactOccurred("medium");
    else h.impactOccurred("light");
    return true;
  });
}

/* ================= облако Телеграма: журнал переживает смену телефона ================= */
// CloudStorage хранит строки до 4096 символов на ключ, поэтому журнал режем на части.
const CHUNK = 3800;
const KEY_META = "bu_meta";
const keyPart = (i) => `bu_${i}`;
const cloud = () => (inTelegram && tg.CloudStorage && verAtLeast("6.9") ? tg.CloudStorage : null);
export const cloudAvailable = () => !!cloud();

const cloudGet = (keys) => new Promise((res, rej) => {
  const c = cloud(); if (!c) return rej(new Error("Облако недоступно"));
  c.getItems(keys, (err, val) => (err ? rej(new Error(err)) : res(val || {})));
});
const cloudSet = (key, value) => new Promise((res, rej) => {
  const c = cloud(); if (!c) return rej(new Error("Облако недоступно"));
  c.setItem(key, value, (err) => (err ? rej(new Error(err)) : res(true)));
});
const cloudRemove = (keys) => new Promise((res) => {
  const c = cloud(); if (!c || !keys.length) return res(true);
  c.removeItems(keys, () => res(true));
});

/** Сохранить состояние в облако. Возвращает { parts, bytes }. */
export async function cloudSave(stateJson, { rev = 0 } = {}) {
  if (!cloud()) throw new Error("Облако Telegram недоступно в этой версии");
  const parts = [];
  for (let i = 0; i < stateJson.length; i += CHUNK) parts.push(stateJson.slice(i, i + CHUNK));
  if (parts.length > 200) throw new Error("Журнал слишком большой для облака");
  // сначала данные, потом мета — если запись оборвётся, старая мета укажет на старые части
  for (let i = 0; i < parts.length; i++) await cloudSet(keyPart(i), parts[i]);
  const prev = await cloudGet([KEY_META]).catch(() => ({}));
  await cloudSet(KEY_META, JSON.stringify({ parts: parts.length, at: new Date().toISOString(), len: stateJson.length, rev }));
  // подчищаем хвост от прошлого, более длинного сохранения
  const prevParts = safe(() => JSON.parse(prev[KEY_META] || "{}").parts) || 0;
  const stale = [];
  for (let i = parts.length; i < prevParts; i++) stale.push(keyPart(i));
  await cloudRemove(stale);
  return { parts: parts.length, bytes: stateJson.length };
}

/** Прочитать состояние из облака. Возвращает { json, at } или null, если сохранения нет. */
export async function cloudLoad() {
  if (!cloud()) throw new Error("Облако Telegram недоступно в этой версии");
  const metaRaw = (await cloudGet([KEY_META]))[KEY_META];
  if (!metaRaw) return null;
  const meta = safe(() => JSON.parse(metaRaw));
  if (!meta || !meta.parts) return null;
  const keys = Array.from({ length: meta.parts }, (_, i) => keyPart(i));
  const got = await cloudGet(keys);
  let json = "";
  for (const k of keys) {
    if (got[k] == null) throw new Error("Облачная копия повреждена: не хватает части");
    json += got[k];
  }
  if (meta.len && json.length !== meta.len) throw new Error("Облачная копия повреждена: длина не совпадает");
  return { json, at: meta.at || null };
}

/** Когда последний раз сохраняли в облако. */
export async function cloudInfo() {
  if (!cloud()) return null;
  const metaRaw = (await cloudGet([KEY_META]).catch(() => ({})))[KEY_META];
  return metaRaw ? safe(() => JSON.parse(metaRaw)) || null : null;
}

/* ================= кто именно открыл приложение ================= */
// CloudStorage и так изолирован связкой «бот + пользователь», а локальный ключ
// разводим по id вручную: на одном телефоне могут сидеть несколько аккаунтов.
export function tgUser() {
  return (inTelegram && tg.initDataUnsafe && tg.initDataUnsafe.user) || null;
}
export function tgUserId() {
  const u = tgUser();
  return u && u.id != null ? String(u.id) : null;
}
export function tgUserName() {
  const u = tgUser();
  return (u && (u.first_name || u.username)) || null;
}
export function tgUserHandle() {
  const u = tgUser();
  if (!u) return null;
  return u.username ? `@${u.username}` : [u.first_name, u.last_name].filter(Boolean).join(" ") || null;
}

/* ================= кто свежее: локальная копия или облачная ================= */
/**
 * Чистое решение о направлении синхронизации.
 * @param local  { rev, syncedRev } — ревизия журнала и ревизия на момент последней синхронизации
 * @param cloud  { rev } | null     — ревизия облачной копии (null, если её нет)
 * @returns "push" | "pull" | "none" | "conflict"
 */
export function decideSync(local, cloud) {
  const lRev = (local && local.rev) || 0;
  const lSynced = (local && local.syncedRev) || 0;
  if (!cloud) return lRev > 0 ? "push" : "none";
  const cRev = cloud.rev || 0;
  if (cRev === lRev) return "none";
  const localChanged = lRev > lSynced;         // журнал меняли после последней синхронизации
  const cloudChanged = cRev > lSynced;         // облако тоже уехало вперёд
  if (cloudChanged && localChanged) return lRev === 0 ? "pull" : "conflict";
  if (cloudChanged) return "pull";
  return "push";
}
