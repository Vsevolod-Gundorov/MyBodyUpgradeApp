// Прогрессия рабочих весов: сколько ставить сегодня и куда двигать в следующий раз.
//
// Одно правило на всё приложение — двойная прогрессия по одному движению:
//   закрыл ВСЕ подходы по верхней границе повторов → в следующий раз +шаг снаряда;
//   попал в коридор повторов, но не дотянул        → вес держим, добираем повторы;
//   не добрал нижнюю границу повторов              → минус шаг, но не ниже пола.
//
// Всё раскрывается из одного числа — РАБОЧЕГО МАКСИМУМА движения. Это не рекорд:
// это то, на что движение способно сейчас, и двигают его только подходы из журнала.
// Из него считается РАБОЧИЙ ВЕС на сегодня — одно число: сколько повесить
// в этой схеме. Его квест и подставляет в подходы — в зале считать нечего.
// Рядом идёт ПОЛ: 90% рабочего веса. Ниже него подход перестаёт быть рабочим —
// столько же стоит граница, за которой движок откатывает рабочий максимум.
//
// Схемы в цикле чередуются (силовая 4–6, объёмная 8–10, добивающая 15–20), поэтому
// рабочий максимум хранится в пересчёте на максимум — по одной кривой «проценты от
// 1ПМ» со скидкой на запас (RIR). Так силовой и объёмный квест по одному движению
// говорят на одном языке, и прибавка с объёмной недели не теряется на силовой.
//
// ЛИЧНЫЙ МАКСИМУМ (расчётный 1ПМ) живёт отдельным счётчиком и в подборе веса
// не участвует: рекорд одного удачного дня не должен задирать рабочую неделю.
//
// Пространства весов. Атлет пишет в журнал то, что реально повесил: для гантелей —
// вес одной гантели, для подтягиваний и брусьев — довесок к своему весу. Проценты
// считаются только по полной системе (обе гантели, тело + пояс), поэтому внутри
// модуля всё живёт в системном весе, а наружу выдаётся в журнальном.

import { pctOf1RM, EQUIP_STEP } from "./exercises.js";

export const PROG = {
  REP_CAP: 10,    // выше 10 повторов формулы 1ПМ врут
  WORKSET: 0.8,   // подход рабочий, если вес ≥80% топового: разминка и лесенка отсекаются
  FLOOR: 0.9,     // глубже 10% от своего же лучшего рабочий максимум не проседает
  LIGHT: 0.9,     // топ ниже 90% назначенного — это лёгкий день, рабочий вес он не двигает
  STALL: 3,       // столько сессий подряд без прибавки — застой
};

/** Расчётный 1ПМ подхода: среднее Эпли и Бжицки, повторы капаются на 10. */
export function e1rm(w, r) {
  const reps = Math.min(r || 0, PROG.REP_CAP);
  if (!(w > 0) || !(reps > 0)) return 0;
  return (w * (1 + reps / 30) + (w * 36) / (37 - reps)) / 2;
}

/** Обратный ход: какой вес даёт такой расчётный максимум на заданных повторах. */
export function weightFor(one, reps) {
  const r = Math.min(Math.max(reps || 1, 1), PROG.REP_CAP);
  if (!(one > 0)) return 0;
  return one / ((1 + r / 30 + 36 / (37 - r)) / 2);
}

// Перевод между схемами идёт по одной кривой — pctOf1RM (Эпли со скидкой на запас).
// Она определена до 30 повторов, поэтому добивающая схема 15–20 не схлопывается
// в десятиповторную, как это было бы с капнутой формулой 1ПМ.
/** Вес подхода → «сколько это в максимуме» на языке этой схемы. */
export const asMax = (w, reps, rir = 0) => (w > 0 ? w / pctOf1RM(reps, rir) : 0);
/** Обратно: максимум → вес, который кладём на снаряд под эту схему. */
export const asWeight = (one, reps, rir = 0) => (one > 0 ? one * pctOf1RM(reps, rir) : 0);

/** Переводы между журнальным весом (что повесил) и системным (по чему считаем проценты). */
export function spaceOf({ perHand = false, bw = false, bodyweight = 0 } = {}) {
  return {
    toSys: (w) => (perHand ? w * 2 : w) + (bw ? bodyweight : 0),
    toBar: (v) => { const x = v - (bw ? bodyweight : 0); return perHand ? x / 2 : x; },
  };
}

/**
 * Что показала одна сессия движения.
 * @param sets  подходы из журнала: [{ w, r }] в журнальном весе
 * @param plan  что было назначено: { sets, reps: [низ, верх], rir }
 * @param bw    движение со своим весом: нулевой довесок — это тоже подход
 * @returns { top, topReps, topSets, work, planned, verdict, lo, hi, record } либо null
 */
export function judge(sets, plan = {}, bw = false) {
  const good = (sets || []).filter((s) => s && s.r > 0 && (s.w > 0 || (bw && s.w >= 0)));
  if (!good.length) return null;
  const lo = (plan.reps && plan.reps[0]) || 1;
  const hi = (plan.reps && plan.reps[1]) || lo;
  // рабочий верх — самый тяжёлый подход, который уложился в коридор повторов.
  // Рекордный сингл в конце квеста идёт в личный максимум, но рабочий вес не двигает:
  // одна удачная попытка не значит, что с этим весом можно работать всю неделю.
  const inRange = good.filter((s) => s.r >= lo);
  const top = Math.max(...(inRange.length ? inRange : good).map((s) => s.w));
  const topSets = good.filter((s) => s.w === top);
  const topReps = Math.min(...topSets.map((s) => s.r));
  const work = good.filter((s) => s.w >= top * PROG.WORKSET && s.w <= top).length;
  const planned = plan.sets || topSets.length;
  let verdict;
  if (!inRange.length) verdict = "down";                                    // не добрал коридор повторов
  else if (topSets.length >= planned && topReps >= hi) verdict = "up";      // всё закрыто по верхней границе
  else verdict = "hold";                                                    // в коридоре — добираем повторы
  return { top, topReps, topSets: topSets.length, work, planned, verdict, lo, hi,
    record: Math.max(...good.map((s) => s.w)) };
}

/**
 * Рабочий максимум движения: идём по истории вперёд и двигаем якорь двойной прогрессией.
 * Каждый шаг — ровно один шаг снаряда в журнальном весе, поэтому вес всегда объясним.
 * @param history [{ date, sets, plan }] по возрастанию даты
 */
export function workMax(history, o = {}) {
  const { step = 2.5 } = o;
  const { toSys, toBar } = spaceOf(o);
  let anchor = 0, best = 0;
  const moves = [];
  for (const h of history || []) {
    const j = judge(h.sets, h.plan, !!o.bw);
    if (!j) continue;
    const rir = (h.plan && h.plan.rir != null) ? h.plan.rir : 0;
    const floor = o.bw ? 0 : step;                                  // без пояса довесок нулевой — это нормально
    const at = (w) => asMax(toSys(Math.max(floor, w)), j.hi, rir);  // вес → якорь на языке этой схемы
    const prev = anchor;
    const due = prev ? toBar(asWeight(prev, j.hi, rir)) : 0;       // что было назначено на этот квест
    let verdict = j.verdict;
    if (!anchor) {
      anchor = at(j.top);                                    // первый замер: с чего начали
    } else if (j.top < due * PROG.LIGHT) {
      verdict = "light";                                     // работал заметно легче плана — не показатель
    } else if (verdict === "up") {
      anchor = Math.max(prev, at(j.top + step));
    } else if (verdict === "hold") {
      anchor = Math.max(prev, at(j.top));                    // доказанное не теряем
    } else {
      anchor = Math.max(at(j.top - step), best * PROG.FLOOR);
    }
    best = Math.max(best, anchor);
    moves.push({ date: h.date, verdict, from: prev, to: anchor, due: Math.max(0, due),
      top: j.top, topReps: j.topReps, sets: j.topSets, planned: j.planned });
  }
  return { anchor, best, moves };
}

/** Лучший подход за всю историю движения — отдельный счётчик личного максимума. */
export function bestSet(history, o = {}) {
  const { toSys } = spaceOf(o);
  let out = null;
  for (const h of history || []) {
    for (const s of h.sets || []) {
      if (!(s && s.r > 0 && (s.w > 0 || (o.bw && s.w >= 0)))) continue;
      const one = e1rm(toSys(s.w), s.r);
      if (one > (out ? out.one : 0)) out = { one, w: s.w, r: s.r, date: h.date };
    }
  }
  return out;
}

/** Самый тяжёлый вес, на котором движение было сделано по плану, — доказанная сила. */
export function provenTop(moves) {
  let out = 0;
  for (const m of moves || []) if (m.verdict !== "down" && m.top > out) out = m.top;
  return out;
}

/** Рост рабочего максимума в %/месяц по линейной регрессии. null — данных мало. */
export function trendPerMonth(moves) {
  const pts = (moves || []).filter((m) => m.to > 0 && m.date);
  if (pts.length < 3) return null;
  const t0 = new Date(pts[0].date + "T00:00:00Z").getTime();
  const xs = pts.map((p) => (new Date(p.date + "T00:00:00Z").getTime() - t0) / 864e5);
  const ys = pts.map((p) => p.to);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  if (!den || !my) return null;
  return ((num / den) * 30 / my) * 100;
}

/**
 * Рабочий вес на сегодня и его история.
 * @param history [{ date, sets, plan }] по этому движению, по возрастанию даты
 * @param o { reps, rir, equip, seed, prog, bodyweight, bw, perHand }
 *        seed — расчётный 1ПМ от базовых лифтов: чем стартовать, пока истории нет
 *        prog — плановая надбавка недели: применяется только к seed, дальше вес двигают подходы
 */
export function progressionOf(history, o = {}) {
  const { reps = [8, 10], rir = 1, equip = "bb", seed = 0, prog = 0 } = o;
  const step = EQUIP_STEP[equip] || 2.5;
  const { toBar } = spaceOf(o);
  const { anchor, moves } = workMax(history, { ...o, step });
  const rec = bestSet(history, o);
  const round = (v) => Math.max(0, Math.round(v / step) * step);
  const empty = { source: "none", work1RM: 0, oneRM: 0, oneRMBar: 0, best: null, proven: 0,
    target: 0, floor: 0, step, sessions: 0, move: null, deltaKg: 0, last: null, moves: [], trend: null };

  let source, target;
  if (anchor > 0) {
    source = "work";
    target = round(toBar(asWeight(anchor, reps[1], rir)));
  } else if (seed > 0) {
    source = "estimate";
    // старт без истории: середина коридора повторов — не завышаем и не мельчим,
    // дальше вес двигают сами подходы
    const mid = Math.round((reps[0] + reps[1]) / 2);
    target = round(toBar(asWeight(seed * (1 + prog), mid, rir)));
  } else {
    return empty;
  }
  // ноль осмыслен только для своего веса: подтягивания пока без пояса
  if (!(target >= 0) || (target === 0 && !o.bw)) return empty;

  const last = moves.length ? moves[moves.length - 1] : null;
  const shift = (v) => round(toBar(asWeight(v, reps[1], rir)));
  // пол: ниже этого веса подход уже не рабочий. Округляем вниз — пол не должен
  // оказаться строже, чем есть на самом деле
  const floor = target > 0 ? Math.max(step, Math.floor((target * PROG.FLOOR) / step) * step) : 0;
  return {
    source, work1RM: anchor || seed * (1 + prog),
    target, floor: floor < target ? floor : 0, step,
    oneRM: rec ? rec.one : (source === "estimate" ? seed * (1 + prog) : 0),
    oneRMBar: rec ? toBar(rec.one) : (source === "estimate" ? toBar(seed * (1 + prog)) : 0),
    best: rec, proven: provenTop(moves), sessions: moves.length,
    move: last ? last.verdict : null,
    deltaKg: last && last.from > 0 ? shift(last.to) - shift(last.from) : 0,
    last, moves, trend: trendPerMonth(moves),
  };
}

/** Словами: что происходит с движением и каким цветом это показывать. */
export function stateOf(p) {
  if (!p || p.source === "none") return { key: "none", text: "Вес по ощущениям", cls: "verdict-mid" };
  if (p.source === "estimate") return { key: "new", text: "Первый заход — оценка от базовых лифтов", cls: "verdict-mid" };
  if (p.sessions < 2) return { key: "new", text: "Первый замер — со второго квеста вес поведёт журнал", cls: "verdict-mid" };
  if (p.move === "down") return { key: "drop", text: "Откат — рабочий вес опустился на шаг", cls: "verdict-fail" };
  const tail = p.moves.slice(1).slice(-PROG.STALL);
  if (tail.length >= PROG.STALL && tail.every((m) => m.to <= m.from))
    return { key: "stall", text: `Застой: ${PROG.STALL} квеста без прибавки — пора делоад или смена движения`, cls: "verdict-fail" };
  if (p.move === "light") return { key: "hold", text: "Прошлый квест был лёгким — вес стоит на месте", cls: "verdict-mid" };
  if (p.move === "up") return { key: "grow", text: "Рост — рабочий вес поднялся на шаг", cls: "verdict-gold" };
  return { key: "hold", text: "Держим вес — добираем повторы до верхней границы", cls: "verdict-mid" };
}

const num = (v) => String(Math.round(v * 100) / 100).replace(".", ",");

/** Короткая подпись: куда поехал рабочий вес. */
export function moveLabel(p) {
  if (!p || p.source === "none") return null;
  if (p.source === "estimate") return { icon: "◎", text: "оценка от базовых лифтов" };
  if (!p.last) return null;
  if (p.last.from === 0) return { icon: "◎", text: `первый замер: ${num(p.last.top)} × ${p.last.topReps}` };
  if (p.move === "up" && p.deltaKg > 0) return { icon: "▲", text: `+${num(p.deltaKg)} кг к прошлому разу` };
  if (p.move === "down") return { icon: "▼", text: p.deltaKg ? `${num(p.deltaKg)} кг после недобора` : "минус шаг после недобора" };
  if (p.move === "light") return { icon: "=", text: `лёгкий квест: прошлый раз ${num(p.last.top)} × ${p.last.topReps}` };
  return { icon: "=", text: `держим вес: прошлый раз ${num(p.last.top)} × ${p.last.topReps}` };
}
