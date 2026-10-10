// Модель: жалобы атлета (болит плечо, ноет поясница) и заметки к упражнениям.
// Правила — в data/complaints.js; здесь только хранение и даты.
import { AREAS, activeComplaints, easeFor, parseComplaint } from "../../data/complaints.js";
import { today } from "../core/format.js";
import { S } from "./store.js";

const store = () => (S.health ||= { complaints: [] });
const list = () => (store().complaints ||= []);

export const complaints = () => list();
export const activeNow = (date = today()) => activeComplaints(list(), date);

/** Облегчение для движения на сегодня (или null). */
export const easeToday = (exId) => easeFor(exId, activeNow());

/**
 * Записать жалобы. Если по зоне уже есть действующая — она обновляется:
 * сила берётся бо́льшая из двух, дата подтверждения — сегодняшняя.
 */
export function addComplaints(found, { exId = null, note = "", date = today() } = {}) {
  const out = [];
  for (const f of found || []) {
    if (!AREAS[f.area]) continue;
    const cur = activeComplaints(list(), date).find((c) => c.area === f.area);
    if (cur) {
      if (f.level === "pain") cur.level = "pain";
      cur.checkedAt = date;
      if (note) cur.note = note.slice(0, 300);
      out.push(cur);
    } else {
      const c = { id: `${date}-${f.area}-${Math.random().toString(36).slice(2, 7)}`, area: f.area, level: f.level === "pain" ? "pain" : "mild",
        date, checkedAt: date, exId, note: String(note || "").slice(0, 300), resolvedAt: null };
      list().push(c);
      out.push(c);
    }
  }
  // старое не копим: закрытые и погасшие дольше полугода назад — убираем
  const cutoff = new Date(Date.now() - 183 * 864e5).toISOString().slice(0, 10);
  store().complaints = list().filter((c) => (c.resolvedAt || c.checkedAt || c.date) >= cutoff);
  return out;
}

/** Ответ на «как сейчас?»: прошло, ещё беспокоит, хуже. */
export function answerCheck(id, answer, date = today()) {
  const c = list().find((x) => x.id === id);
  if (!c) return;
  if (answer === "gone") c.resolvedAt = date;
  else { c.checkedAt = date; if (answer === "worse") c.level = "pain"; }
  c.askedAt = date;
}

/** О каких жалобах спросить сегодня: заведены не сегодня и сегодня ещё не спрашивали. */
export const toCheck = (date = today()) => activeNow(date).filter((c) => c.checkedAt < date && c.askedAt !== date);

/* ---------------- заметки к упражнениям ---------------- */
const notesOf = (wid) => ((S.exNotes ||= {})[wid] ||= {});
export const exNote = (wid, exId) => (S.exNotes && S.exNotes[wid] && S.exNotes[wid][exId]) || "";

/** Сохранить заметку и, если в ней есть жалоба, — записать её. Возвращает распознанное. */
export function saveExNote(wid, exId, text, extra = []) {
  const t = String(text || "").trim().slice(0, 300);
  if (t) notesOf(wid)[exId] = t; else delete notesOf(wid)[exId];
  const found = [...parseComplaint(t)];
  for (const e of extra) if (!found.some((f) => f.area === e.area)) found.push(e); else found.find((f) => f.area === e.area).level = e.level;
  return addComplaints(found, { exId, note: t });
}

/** Заметки тренировки уходят в сессию, черновик очищается. */
export function takeNotes(wid) {
  const n = (S.exNotes && S.exNotes[wid]) || {};
  if (S.exNotes) delete S.exNotes[wid];
  return Object.keys(n).length ? n : null;
}
