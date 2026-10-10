// Модель: синхронизация журнала с облаком Telegram.
import { cloudAvailable, cloudInfo, cloudLoad, cloudSave, decideSync } from "../telegram.js";
import { fmtDate } from "../core/format.js";
import { DB_KEY, S, reloadState } from "./store.js";
import { invalidateE1RM } from "./training.js";

/* ---- автосинхронизация с облаком Телеграма ---- */
// Модель не рисует и не спрашивает сама: что сделать после подтягивания облака и как
// спросить про конфликт копий, задаёт контроллер при запуске (configureCloudSync).
const hooks = { onPulled: () => {}, askConflict: () => false };
export function configureCloudSync({ onPulled, askConflict } = {}) {
  if (onPulled) hooks.onPulled = onPulled;
  if (askConflict) hooks.askConflict = askConflict;
}
export let cloudTimer = null, cloudBusy = false, cloudState = "idle"; // idle | saving | saved | error | off

export const cloudListeners = new Set();

export const setCloudState = (v) => { cloudState = v; cloudListeners.forEach((f) => f(v)); };
export const onCloudState = (f) => { cloudListeners.add(f); return () => cloudListeners.delete(f); };

export function queueCloudSync() {
  if (!cloudAvailable()) return;
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(pushCloud, 4000);        // ввод веса и повторов идёт очередями — не дёргаем облако на каждый символ
}

export async function pushCloud() {
  if (!cloudAvailable() || cloudBusy) return;
  cloudBusy = true; setCloudState("saving");
  try {
    const rev = S.rev || 0;
    await cloudSave(JSON.stringify(S), { rev });
    S.sync = { ...(S.sync || {}), syncedRev: rev, at: new Date().toISOString() };
    // пишем отметку синхронизации без save(), чтобы не крутить ревизию, но не затираем
    // хранилище, если рядом открыта вторая вкладка и она успела записать более свежий журнал
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(DB_KEY) || "null"); } catch (e) { stored = null; }
    if (!stored || (stored.rev || 0) <= rev) localStorage.setItem(DB_KEY, JSON.stringify(S));
    setCloudState("saved");
  } catch (e) { setCloudState("error"); }
  finally { cloudBusy = false; }
}

export function applyCloudJson(json) {
  localStorage.setItem(DB_KEY, json);
  reloadState();
  S.sync = { ...(S.sync || {}), syncedRev: S.rev || 0, at: new Date().toISOString() };
  localStorage.setItem(DB_KEY, JSON.stringify(S));
  invalidateE1RM();
}

/** Старт внутри Телеграма: решаем, чья копия свежее, и подтягиваем облако. */
export async function initCloudSync() {
  if (!cloudAvailable()) { setCloudState("off"); return; }
  try {
    const meta = await cloudInfo();
    const verdict = decideSync({ rev: S.rev || 0, syncedRev: (S.sync && S.sync.syncedRev) || 0 }, meta ? { rev: meta.rev || 0 } : null);
    if (verdict === "pull" || verdict === "conflict") {
      const got = await cloudLoad();
      if (got) {
        const take = verdict === "pull" || hooks.askConflict(
          `Журнал менялся и здесь, и в облаке Telegram${got.at ? ` (облачная копия от ${fmtDate(got.at.slice(0, 10))})` : ""}.\n\nOK — взять облачную копию, Отмена — оставить то, что на этом устройстве.`);
        if (take) { applyCloudJson(got.json); hooks.onPulled(); setCloudState("saved"); return; }
        await pushCloud(); return;
      }
    }
    if (verdict === "push") { await pushCloud(); return; }
    setCloudState("saved");
  } catch (e) { setCloudState("error"); }
}
