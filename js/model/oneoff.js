// Модель: разовые правки журнала по просьбе атлета («замени сегодня…»).
// Каждая выполняется один раз (отметка в S.oneOff) и только в свой срок: открыл приложение
// позже — правка уже неуместна и не делается. Отметка уезжает на сервер вместе с журналом,
// поэтому со второго телефона правка не повторится.
import { today } from "../core/format.js";
import { planOf, setPlan } from "./catalog.js";
import { S } from "./store.js";
import { nextWorkoutId, workoutOf } from "./training.js";

const CURLS = new Set(["legcurl-l", "legcurl-s", "legcurl-st"]);

/**
 * Сегодняшняя тренировка: та, что сегодня открывали или начали заполнять (последняя из них),
 * иначе — следующая по плану.
 */
export function todayWorkoutId(date = today()) {
  const day = (ts) => (Number.isFinite(ts) ? new Date(ts).toISOString().slice(0, 10) : "");
  let best = null, bestTs = 0;
  const seen = (wid, ts) => { if (day(ts) === date && ts > bestTs) { best = wid; bestTs = ts; } };
  Object.entries(S.questStart || {}).forEach(([wid, ts]) => seen(wid, ts));
  Object.entries(S.questTicks || {}).forEach(([wid, ticks]) => (Array.isArray(ticks) ? ticks : []).forEach((ts) => seen(wid, ts)));
  return best && workoutOf(best) ? best : nextWorkoutId();
}

/**
 * В сегодняшней тренировке сгибания ног меняются на сгибания лёжа без ягодиц.
 * Сегодня уже тренировался — сегодняшняя тренировка закрыта, следующую не трогаем.
 * @returns true — замена сделана
 */
export function swapTodayCurl(date = today()) {
  if (S.sessions.some((s) => s.date === date)) return false;
  const wid = todayWorkoutId(date);
  const w = workoutOf(wid);
  const ex = w && w.exercises.find((x) => CURLS.has(x.id));
  if (!ex) return false;
  const base = ex.swappedFrom || ex.id;
  setPlan(wid, { swap: { ...(planOf(wid).swap || {}), [base]: "legcurl-l-ng" } });
  return true;
}

export const ONE_OFF = [
  { key: "curl-noglutes-2026-10-18", until: "2026-10-19", run: swapTodayCurl },
];

/** Выполнить то, что ещё не выполнено и не просрочено. Возвращает, изменилось ли что-то. */
export function runOneOffs(date = today(), list = ONE_OFF) {
  S.oneOff ||= {};
  let changed = false;
  for (const o of list) {
    if (S.oneOff[o.key] || date > o.until) continue;
    S.oneOff[o.key] = date;
    if (o.run(date)) changed = true;
  }
  return changed;
}
