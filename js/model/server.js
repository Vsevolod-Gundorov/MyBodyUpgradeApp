// Модель: журнал на сервере приложения (Postgres за /api/journal).
//
// Сервер — главная копия, если он доступен этому пользователю. Облако Telegram
// остаётся резервной копией, а без сервера (обычный браузер, нет приглашения,
// нет сети) приложение работает как раньше: журнал на устройстве + облако Telegram.
//
// Кто ты, сервер узнаёт по подписанным Telegram данным запуска (initData) —
// они уходят только сюда, на свой же адрес /api/, и никуда больше.
//
// Ревизии: S.rev растёт с каждым сохранением; S.sync.serverRev — ревизия сервера,
// от которой считаны локальные изменения (null — с сервером ещё не сверялись).
import { inTelegram, tgInitData } from "../telegram.js";
import { DB_KEY, S, reloadState } from "./store.js";
import { initCloudSync, queueCloudSync } from "./sync.js";
import { invalidateE1RM } from "./training.js";

const API = "/api/journal";
export const PREMIGRATE_KEY = `${DB_KEY}.before-server`;   // журнал до первого переезда на сервер
export const BACKUP_KEY = `${DB_KEY}.before-pull`;         // локальная копия перед заменой серверной

/* ---- состояние и подписки ---- */
// off — сервер не используется; idle, saving, saved; offline — нет связи (журнал цел на устройстве);
// denied — нет приглашения; expired — подпись устарела (переоткрыть приложение); error — сбой сервера
export let serverState = "off";
const stateListeners = new Set();
const setServerState = (v) => { serverState = v; stateListeners.forEach((f) => f(v)); };
export const onServerState = (f) => { stateListeners.add(f); return () => stateListeners.delete(f); };
// после отказа в доступе или устаревшей подписи не стучимся: повтор не поможет,
// а неудачные входы сервер считает и в конце концов закрывает адрес
export const serverActive = () => !["off", "denied", "expired"].includes(serverState);

const hooks = { onPulled: () => {}, askConflict: () => false };
export function configureServerSync({ onPulled, askConflict } = {}) {
  if (onPulled) hooks.onPulled = onPulled;
  if (askConflict) hooks.askConflict = askConflict;
}

/** Сервер вообще возможен: внутри Telegram, с подписью, страница по http(s). */
export const serverPossible = () =>
  inTelegram && !!tgInitData() && typeof location !== "undefined" && /^https?:$/.test(location.protocol);

/* ---- чистые помощники (тестируются отдельно) ---- */
/** Канонический JSON: ключи по алфавиту. Postgres jsonb переставляет ключи, а сравнивать надо смысл. */
export function canon(v) {
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}`;
  return JSON.stringify(v === undefined ? null : v);
}

/** Что отправляется на сервер: журнал без служебных отметок этого устройства. */
export function serverPayload(state) {
  const { sync, ...data } = state;   // eslint-disable-line no-unused-vars
  return JSON.parse(JSON.stringify(data));
}

/** На устройстве нет ничего, что ввёл человек: новый телефон или чистая установка. */
export function isBlank(state) {
  const empty = (o) => !o || (Array.isArray(o) ? o.length === 0 : Object.keys(o).length === 0);
  return empty(state.sessions) && empty(state.drafts) && empty(state.nutrition && state.nutrition.log) &&
    empty(state.buffs && state.buffs.log) && empty(state.buffs && state.buffs.custom);
}

/**
 * Решение о направлении синхронизации с сервером.
 * @param local  { rev, base } — ревизия журнала и ревизия сервера, от которой он считан (null — не сверялись)
 * @param server { rev } | null — ревизия на сервере (null — журнала там ещё нет)
 * @param same   совпадает ли содержимое (когда известно)
 * @param blank  на устройстве пусто (ревизию могла поднять служебная запись при запуске)
 * @returns "migrate" | "push" | "pull" | "none" | "conflict"
 */
export function decideServer(local, server, same = false, blank = false) {
  const lRev = local.rev || 0, base = local.base;
  if (!server) return lRev > 0 && !blank ? "migrate" : "none";
  if (same) return "none";
  if (blank && base == null) return "pull";
  const serverChanged = base == null || server.rev !== base;
  const localChanged = base == null ? lRev > 0 : lRev > base;
  if (!serverChanged) return localChanged ? "push" : "none";
  if (!localChanged) return "pull";
  return "conflict";
}

/* ---- запросы ---- */
async function api(method, body) {
  let res;
  try {
    res = await fetch(API, {
      method,
      headers: { authorization: `tma ${tgInitData()}`, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store", credentials: "omit", redirect: "error",
    });
  } catch (e) { return { status: 0, json: null }; }   // нет сети
  let json = null;
  try { json = await res.json(); } catch (e) { json = null; }
  return { status: res.status, json };
}

/** Ответ сервера → состояние. true — можно продолжать работу с сервером. */
function acceptStatus(status, json) {
  if (status === 200 || status === 409) return true;
  if (status === 0) setServerState("offline");
  else if (status === 401) setServerState("expired");
  else if (status === 403 && json && json.error === "not_invited") setServerState("denied");
  else if (status === 503 && json && json.error === "not_configured") setServerState("off");
  else setServerState("error");
  return false;
}

/* ---- запись служебных отметок без новой ревизии ---- */
function writeMeta() {
  // как в облаке Telegram: не затираем более свежий журнал из соседней вкладки
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(DB_KEY) || "null"); } catch (e) { stored = null; }
  if (!stored || (stored.rev || 0) <= (S.rev || 0)) localStorage.setItem(DB_KEY, JSON.stringify(S));
}
const keepCopy = (key, json, { once = false } = {}) => {
  try { if (!once || !localStorage.getItem(key)) localStorage.setItem(key, json); } catch (e) { /* нет места — без копии */ }
};

function applyServer(data, rev) {
  const prevSync = S.sync || {};
  if ((S.rev || 0) > 0) keepCopy(BACKUP_KEY, JSON.stringify(S));
  localStorage.setItem(DB_KEY, JSON.stringify({ ...data, rev, sync: { ...prevSync, serverRev: rev } }));
  reloadState();
  invalidateE1RM();
}

/* ---- отправка ---- */
let timer = null, busy = false, again = false;

export function queueServerSync() {
  if (!serverActive()) return;
  clearTimeout(timer);
  setServerState("saving");               // честно: есть изменения, которые ещё не на сервере
  timer = setTimeout(pushServer, 2500);   // вес и повторы вводятся очередями — не дёргаем сервер на каждый символ
}

/** Отправить журнал. reason "migrate" — первый переезд на сервер. */
export async function pushServer({ reason = "save" } = {}, depth = 0) {
  if (!serverActive()) return;
  if (busy) { again = true; return; }
  busy = true; setServerState("saving");
  try {
    const base = S.sync && S.sync.serverRev != null ? S.sync.serverRev : null;
    const rev = S.rev || 0;
    const { status, json } = await api("PUT", { rev, baseRev: base, reason, data: serverPayload(S) });
    if (!acceptStatus(status, json)) return;
    if (status === 409) { busy = false; await reconcile(null, depth + 1); return; }
    S.sync = { ...(S.sync || {}), serverRev: json.rev, serverAt: json.updatedAt };
    writeMeta();
    setServerState(S.rev === json.rev ? "saved" : "saving");   // пока ехали, могли появиться новые правки
  } finally {
    busy = false;
    if (again) { again = false; if ((S.rev || 0) !== (S.sync && S.sync.serverRev)) queueServerSync(); }
  }
}

/* ---- сверка с сервером ---- */
async function reconcile(prefetched = null, depth = 0) {
  // при гонке нескольких устройств сверка может повториться; бесконечно — нет
  if (depth > 3) { setServerState("error"); return false; }
  const got = prefetched || await api("GET");
  if (!acceptStatus(got.status, got.json)) return false;
  const srv = got.json;
  if (!srv.exists) {
    if (decideServer({ rev: S.rev || 0, base: null }, null, false, isBlank(S)) === "none") { setServerState("saved"); return true; }
    keepCopy(PREMIGRATE_KEY, JSON.stringify(S), { once: true });   // журнал до переезда — на всякий случай
    S.sync = { ...(S.sync || {}), serverRev: null };
    await pushServer({ reason: "migrate" }, depth);
    return true;
  }
  const base = S.sync && S.sync.serverRev != null ? S.sync.serverRev : null;
  const same = canon(serverPayload({ ...srv.data, rev: 0 })) === canon(serverPayload({ ...S, rev: 0 }));
  const verdict = decideServer({ rev: S.rev || 0, base }, { rev: srv.rev }, same, isBlank(S));
  if (verdict === "none") {
    if (S.sync.serverRev !== srv.rev || S.rev !== srv.rev) {
      S.rev = Math.max(S.rev || 0, srv.rev);
      S.sync = { ...(S.sync || {}), serverRev: srv.rev };
      writeMeta();
      if (S.rev !== srv.rev) await pushServer({}, depth);     // содержимое совпало, а ревизия у нас выше — выровнять
    }
    if (serverState !== "saving") setServerState("saved");
    return true;
  }
  if (verdict === "pull") { applyServer(srv.data, srv.rev); hooks.onPulled(); setServerState("saved"); return true; }
  if (verdict === "push") { await pushServer({}, depth); return true; }

  // конфликт: журнал меняли и здесь, и на другом устройстве
  const when = srv.updatedAt ? new Date(srv.updatedAt).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "";
  const takeServer = hooks.askConflict(
    `Журнал менялся и на этом устройстве, и на другом${when ? ` (${when})` : ""}.\n\nOK — взять версию с сервера (текущая сохранится резервной копией на этом устройстве), Отмена — оставить версию с этого устройства.`);
  if (takeServer) { applyServer(srv.data, srv.rev); hooks.onPulled(); setServerState("saved"); return true; }
  S.rev = Math.max(S.rev || 0, srv.rev) + 1;
  S.sync = { ...(S.sync || {}), serverRev: srv.rev };
  writeMeta();
  await pushServer({}, depth);
  return true;
}

/**
 * Старт: сервер, если он доступен; иначе — как раньше, облако Telegram.
 * При первом переезде сначала подтягиваем облако Telegram: там может лежать
 * более свежий журнал с другого телефона, и переехать должен именно он.
 */
export async function initSync() {
  if (!serverPossible()) { setServerState("off"); return initCloudSync(); }
  setServerState("idle");
  try {
    const got = await api("GET");
    if (!acceptStatus(got.status, got.json)) return initCloudSync();
    if (!got.json.exists) await initCloudSync();
    await reconcile(got);
    queueCloudSync();   // резервная копия в облаке Telegram
  } catch (e) { setServerState("error"); }   // журнал на устройстве цел; повторим при следующем сохранении
}
