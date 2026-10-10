// Модель: напоминания в Telegram — что и когда напоминать. Правила — в data/reminders.js.
import { REST_MAX_WAIT_SEC, SLOT_TIMES, TIMED_SLOTS, buildSlots, hhmmToMin } from "../../data/reminders.js";
import { allBuffs, buffTimes } from "./buffs.js";
import { remindersPost, remindersPut } from "./server.js";
import { S } from "./store.js";
import { BN } from "./theme.js";

const conf = () => (S.reminders ||= { supp: false, rest: false, times: {} });
export const reminders = () => conf();
/** Время слота: своё, если оно правильное «чч:мм», иначе по умолчанию. */
export const slotTime = (slot) => (hhmmToMin(conf().times[slot]) != null ? conf().times[slot] : SLOT_TIMES[slot]);

export function setReminder(kind, on) { conf()[kind] = !!on; }
export function setSlotTime(slot, hhmm) {
  if (!TIMED_SLOTS.includes(slot) || hhmmToMin(hhmm) == null) return false;
  conf().times[slot] = hhmm;
  return true;
}

/** Что отправить серверу: флаги, часовой пояс и расписание по активным добавкам. */
export function reminderPayload(now = new Date()) {
  const active = (S.buffs && S.buffs.active) || {};
  const buffs = allBuffs().filter((b) => active[b.id] != null)
    .map((b) => ({ id: b.id, name: BN(b), dose: active[b.id], unit: b.unit, times: buffTimes(b) }));
  const c = conf();
  return { supp: !!c.supp, rest: !!c.rest, tz: -now.getTimezoneOffset(), slots: c.supp ? buildSlots(buffs, c.times) : [] };
}

let lastSent = "";
let pushTimer = null;
/** Отправить настройки, если они поменялись (с паузой: правки идут пачкой). */
export function syncReminders({ now = false } = {}) {
  clearTimeout(pushTimer);
  const run = async () => {
    const p = reminderPayload();
    const key = JSON.stringify(p);
    if (key === lastSent) return { status: 200, same: true };
    const r = await remindersPut(p);
    if (r.status === 200) lastSent = key;
    return r;
  };
  if (now) return run();
  pushTimer = setTimeout(run, 1500);
  return null;
}

/* ---------------- конец отдыха ---------------- */
let restTimer = null, restPosted = false;
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 20);

/**
 * Попросить бота напомнить, когда отдых кончится. Сервер ждёт не больше REST_MAX_WAIT_SEC,
 * поэтому длинный отдых отправляется с задержкой — когда до конца останется столько.
 */
export function remindRest(endAt, text = "") {
  cancelRestRemind({ silent: true });
  if (!conf().rest) return;
  const send = () => {
    const sec = Math.round((endAt - Date.now()) / 1000);
    if (sec < 5) return;
    restPosted = true;
    remindersPost({ action: "rest", sec: Math.min(sec, REST_MAX_WAIT_SEC), token: token(), text: String(text).slice(0, 80) }, { keepalive: true });
  };
  const wait = Math.max(0, endAt - Date.now() - REST_MAX_WAIT_SEC * 1000);
  if (wait > 0) restTimer = setTimeout(send, wait); else send();
}

/** Отдых пропущен, поменян или человек и так смотрит в приложение — бот не нужен. */
export function cancelRestRemind({ silent = false } = {}) {
  clearTimeout(restTimer); restTimer = null;
  if (restPosted && !silent) remindersPost({ action: "cancel" }, { keepalive: true });
  restPosted = false;
}
