// Напоминания в Telegram: расписание добавок и конец отдыха. Чистые функции —
// ими пользуются и приложение (что отправить серверу), и сервер (что и когда слать).
//
// Безопасность текста: всё, что уходит в сообщение бота, — короткие строки без
// управляющих символов и без разметки (Bot API получает их без parse_mode).

/** Слоты приёма, у которых есть время на часах. «До/после тренировки» привязаны к тренировке, а не к часам. */
export const SLOT_TIMES = { "Утро": "08:00", "День": "13:00", "Вечер": "19:00", "Перед сном": "22:30" };
export const TIMED_SLOTS = Object.keys(SLOT_TIMES);

export const DELETE_AFTER_SEC = 60;     // сообщение висит минуту и исчезает
export const REST_MAX_WAIT_SEC = 225;   // дольше функция ждать не может (лимит 300 с вместе с удалением)
export const DUE_WINDOW_MIN = 60;       // напоминание о слоте — в течение часа после его времени

const CTRL = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g;
/** Строка для сообщения: без управляющих и «невидимых» символов, одна строка, не длиннее max. */
export const cleanText = (s, max = 60) => String(s == null ? "" : s).replace(CTRL, " ").replace(/\s+/g, " ").trim().slice(0, max);

export const hhmmToMin = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || "")); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null; };
export const minToHhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/**
 * Проверить настройки от приложения. Лишние поля, чужие типы, длинные строки — отказ.
 * @returns {{ ok: true, value } | { ok: false, error }}
 */
export function validateSettings(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "bad_body" };
  if (Object.keys(body).some((k) => !["supp", "rest", "tz", "slots"].includes(k))) return { ok: false, error: "bad_body" };
  const { supp, rest, tz, slots } = body;
  if (typeof supp !== "boolean" || typeof rest !== "boolean") return { ok: false, error: "bad_flags" };
  if (!Number.isInteger(tz) || tz < -840 || tz > 840) return { ok: false, error: "bad_tz" };
  if (!Array.isArray(slots) || slots.length > 8) return { ok: false, error: "bad_slots" };
  const out = [];
  for (const s of slots) {
    if (!s || typeof s !== "object" || Array.isArray(s) || Object.keys(s).some((k) => !["slot", "at", "items"].includes(k))) return { ok: false, error: "bad_slots" };
    if (!TIMED_SLOTS.includes(s.slot)) return { ok: false, error: "bad_slot" };
    if (!Number.isInteger(s.at) || s.at < 0 || s.at > 1439) return { ok: false, error: "bad_time" };
    if (!Array.isArray(s.items) || !s.items.length || s.items.length > 12) return { ok: false, error: "bad_items" };
    const items = [];
    for (const it of s.items) {
      if (!it || typeof it !== "object" || Array.isArray(it) || Object.keys(it).some((k) => !["id", "text"].includes(k))) return { ok: false, error: "bad_items" };
      if (typeof it.id !== "string" || !/^[A-Za-z0-9_-]{1,40}$/.test(it.id)) return { ok: false, error: "bad_items" };
      const text = cleanText(it.text, 60);
      if (!text) return { ok: false, error: "bad_items" };
      items.push({ id: it.id, text });
    }
    if (out.some((x) => x.slot === s.slot)) return { ok: false, error: "bad_slots" };
    out.push({ slot: s.slot, at: s.at, items });
  }
  return { ok: true, value: { supp, rest, tz, slots: out } };
}

/** Местная дата и минута дня для смещения часового пояса (минуты к UTC). */
export function localClock(nowMs, tzMin) {
  const d = new Date(nowMs + tzMin * 60000);
  return { day: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

/**
 * Какие слоты пора напомнить: время наступило не больше часа назад и в журнале
 * за этот день отмечено не всё. taken — журнал дня { "id@Слот": true }.
 * @returns [{ slot, day, items }] — items только неотмеченные
 */
export function dueSlots({ tz_min, slots }, nowMs, taken = {}) {
  const { day, min } = localClock(nowMs, tz_min);
  return (slots || []).filter((s) => min >= s.at && min - s.at < DUE_WINDOW_MIN)
    .map((s) => ({ slot: s.slot, day, items: s.items.filter((it) => !taken[`${it.id}@${s.slot}`]) }))
    .filter((s) => s.items.length);
}

/** Ключ отправки — чтобы не слать один слот дважды за день. */
export const slotKey = (day, slot) => `supp:${day}:${TIMED_SLOTS.indexOf(slot)}`;

export const suppMessage = (slot, items) =>
  `💊 Добавки · ${slot.toLowerCase()}\n${items.map((it) => `• ${it.text}`).join("\n")}\n\nОтметь приём в приложении.`;

export const restMessage = (text) => `⏱ Отдых закончился — пора подход${text ? `\n${cleanText(text, 80)}` : ""}`;

/**
 * Расписание из активных добавок: по слоту с часами — что в нём принимать.
 * buffs: [{ id, name, dose, unit, times }], times: { slot: "08:00" } — своё время слотов.
 */
export function buildSlots(buffs, times = {}) {
  return TIMED_SLOTS.map((slot) => {
    const at = hhmmToMin(times[slot]) ?? hhmmToMin(SLOT_TIMES[slot]);
    const items = buffs.filter((b) => (b.times || []).includes(slot))
      .map((b) => ({ id: String(b.id).slice(0, 40), text: cleanText(`${b.name}${b.dose ? ` ${String(b.dose).replace(".", ",")} ${b.unit || ""}` : ""}`, 60) }))
      .filter((it) => /^[A-Za-z0-9_-]{1,40}$/.test(it.id) && it.text).slice(0, 12);
    return { slot, at, items };
  }).filter((s) => s.items.length);
}
