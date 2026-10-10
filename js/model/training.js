// Модель: рабочие веса, история движений, отдых и разбор квеста.
import { PROGRAM, SCHEME, TEMPLATES, buildExercises } from "../../data/program.js";
import { FEEL, PROG, asMax, e1rm as e1rmAvg, feelOf, isWarmup, priorSetsOf, progressionOf, restFor, spaceOf } from "../../data/progression.js";
import { exById, setDone } from "../../data/exercises.js";
import { epley, fmt, today } from "../core/format.js";
import { ORDER, WORKOUTS, planOf, sessionExercises } from "./catalog.js";
import { easeToday } from "./health.js";
import { baselines, currentWeight, weightOn } from "./profile.js";
import { S, save } from "./store.js";
import { L } from "./theme.js";

/* ---- квест = шаблон недели + правки атлета + его рабочие веса ---- */
// Лучший расчётный 1ПМ атлета по каждому движению (ключ = базовый лифт или id упражнения).
export let e1rmCache = null;

export function athleteE1RM() {
  if (e1rmCache) return e1rmCache;
  const out = {};
  S.sessions.forEach((sess) => {
    sessionExercises(sess).forEach((ex) => {
      const key = ex.lift || ex.id;
      (sess.entries[ex.id] || []).forEach(({ w, r }) => {
        if (w > 0 && r > 0) out[key] = Math.max(out[key] || 0, e1rmAvg(w, r));
      });
    });
  });
  return (e1rmCache = out);
}

export const invalidateE1RM = () => { e1rmCache = null; histCache = null; };

// История подходов по каждому движению: что было назначено и что реально сделано.
// Отсюда растёт рабочий вес — из квеста в квест и из цикла в цикл.
export let histCache = null;

export function movementHistory() {
  if (histCache) return histCache;
  const out = {};
  [...S.sessions].sort((a, b) => a.date.localeCompare(b.date)).forEach((sess) => {
    const list = sessionExercises(sess);
    // сколько работы по группе было сделано до каждого движения в ТОЙ сессии:
    // считаем по снимку состава, а не берём из плана — тогда и старые сессии,
    // записанные до появления поправки, читаются по тем же правилам
    const prior = priorSetsOf(list.map((ex) => {
      const src = exById(ex.id);
      return { group: src ? src.group : null, also: (src && src.also) || [], sets: ex.sets };
    }));
    list.forEach((ex, i) => {
      const src = exById(ex.id) || ex;
      const sets = (sess.entries[ex.id] || []).filter((x) => setDone(x, src));
      if (!sets.length) return;
      const key = ex.lift || ex.id;
      (out[key] ||= []).push({ date: sess.date, sets, bodyweight: src.bw ? weightOn(sess.date) : null, plan: {
        sets: ex.sets, reps: ex.reps, rir: ex.rir != null ? ex.rir : 1,
        feel: sess.feel || "norm", deload: !!ex.deload, prior: ex.recovered ? 0 : (prior[i] || 0), ease: ex.ease || 0 } });
    });
  });
  return (histCache = out);
}

// Стартовая оценка 1ПМ от базовых лифтов: чем двигаться, пока по движению нет подходов.
export function seed1RM(src) {
  if (!src || !src.k) return 0;
  const e = athleteE1RM();
  const refKey = src.ref || "bench";
  const refVal = e[refKey] || baselines()[refKey] || 0;
  return refVal > 0 ? refVal * src.k : 0;
}

/** Вилка рабочего веса движения: из журнала, а без журнала — от базовых лифтов. */
export function progressOf(src, { reps = [8, 10], rir = 1, prog = 0, sets = 1, rest = 0, feel = "norm", deload = false, prior = 0, ease = 1 } = {}) {
  if (!src) return null;
  const key = src.lift || src.id;
  return progressionOf(movementHistory()[key] || [], {
    reps, rir, equip: src.equip, prog, seed: seed1RM(src),
    sets, tier: src.tier || 2, rest: rest || 0, feel, deload, prior, ease,
    bodyweight: currentWeight(), bw: !!src.bw, perHand: !!src.perHand,
    reset: (S.workReset || {})[key] || null,
  });
}

// добавить к упражнению рабочий вес под атлета (с учётом прогрессии недели)
export function withWeights(ex) {
  const src = exById(ex.id);
  // В суперсете мышца отдыхает, пока работает партнёр: если это антагонист,
  // отдыха даже больше обычного. А вот пара на одну группу — это двойной подход
  // без отдыха, и вес под неё честно пересчитывается вниз.
  const rest = !ex.ss ? 0
    : (ex.ssSameMuscle ? Math.round(restFor(src.tier || 2, ex.reps[1]) * 0.45)
                       : restFor(src.tier || 2, ex.reps[1]) + 30);
  // разбитому атлету квест даёт на подход меньше: тренировка состоится,
  // но не за счёт следующей недели. Ниже двух подходов не опускаемся —
  // это уже не упражнение
  const feel = feelToday();
  ex = { ...ex, sets: Math.max(2, (ex.sets || 3) + feelOf(feel).sets) };
  // жалоба (болит плечо, ноет поясница) облегчает движения, которые грузят эту зону
  const ease = easeToday(ex.id);
  ex = { ...ex, ease };
  const p = progressOf(src, { reps: ex.reps, rir: ex.rir, prog: ex.prog || 0, sets: ex.sets, rest,
    feel, deload: !!ex.deload, prior: ex.prior || 0, ease: ease ? ease.k : 1 });
  const own = src && (src.equip === "bw" || src.bw);
  if (!p || p.source === "none") return { ...ex, w: 0, wSource: "none", wp: p || null, bwOnly: !!own,
    wNote: own ? "свой вес" : "задай вес сам" };
  // подтягивания и брусья без пояса: вес честно нулевой, но подход всё равно записывается
  const note = src.bw ? (p.target > 0 ? "довесок к своему весу" : "свой вес, без довеска") : (src.perHand ? "на каждую руку" : null);
  return { ...ex, w: p.target, wSource: p.source, prog1RM: p.work1RM, wp: p, bwOnly: !!own && !p.target, wNote: note };
}

// собранный квест текущего цикла (или архивный — там список зашит)
export function workoutOf(wid) {
  const meta = WORKOUTS[wid];
  if (!meta) return null;
  if (meta.exercises) return meta;                    // архив
  const tpl = TEMPLATES[meta.tpl];
  return {
    ...meta,
    title: tpl ? tpl.name : "",
    why: tpl ? tpl.why : "",
    exercises: buildExercises(meta, (S.plan || {})[meta.id]).map(withWeights),
  };
}

/* ================= скоринг: отработал или схалявил ================= */
export function scoreSession(workout, entries) {
  let plannedSets = 0, doneSets = 0, weightPts = 0, weightMax = 0;
  workout.exercises.forEach((ex) => {
    const all = (entries[ex.id] || []).filter((s) => setDone(s, exById(ex.id) || ex));
    const src = exById(ex.id) || ex;
    const sp = spaceFor(src);
    const sets = all.filter((s) => !isWarmup(s, ex.w, sp));   // разминка слот плана не занимает
    plannedSets += ex.sets;
    doneSets += Math.min(sets.length, ex.sets);
    if (ex.w > 0) {
      const weight = ex.main ? 2 : 1;
      weightMax += weight;
      if (all.length) {
        const top = Math.max(...all.map((s) => s.w));
        const { toSys } = spaceOf(sp);
        const floor = (ex.wp && ex.wp.floor != null && ex.wp.floor > 0) ? ex.wp.floor : spaceOf(sp).toBar(toSys(ex.w) * PROG.FLOOR);
        if (top >= ex.w) weightPts += weight;               // вышел на рабочий вес
        else if (top >= floor) weightPts += weight * 0.6;   // между полом и рабочим
        else weightPts += weight * 0.3;                     // ниже пола
      }
    }
  });
  const coverage = plannedSets ? doneSets / plannedSets : 0;
  const intensity = weightMax ? weightPts / weightMax : 1;
  const score = Math.round(100 * (0.65 * coverage + 0.35 * intensity));
  let verdict, cls, flavor;
  if (score >= 85) { verdict = L("vGold"); cls = "verdict-gold"; flavor = L("vGoldSub"); }
  else if (score >= 60) { verdict = L("vMid"); cls = "verdict-mid"; flavor = L("vMidSub"); }
  else { verdict = L("vFail"); cls = "verdict-fail"; flavor = L("vFailSub"); }
  const xp = Math.round(score * 1.2 + doneSets * 2);
  return { score, verdict, cls, flavor, xp, doneSets, plannedSets };
}

/* ================= вычисление статов героя ================= */
export function bestE1RM(lift, upto = Infinity) {
  let best = 0;
  S.sessions.forEach((s, i) => {
    if (i > upto) return;
    sessionExercises(s).forEach((ex) => {
      if (ex.lift !== lift) return;
      (s.entries[ex.id] || []).forEach(({ w: wt, r }) => { if (wt && r) best = Math.max(best, epley(wt, Math.min(r, 10))); });
    });
  });
  return best;
}

export function nextWorkoutId() {
  // порядок цикла с учётом выбранного стартового квеста
  const n = ORDER.length;
  const start = (((S.cycleStart || 0) % n) + n) % n;
  const rot = ORDER.slice(start).concat(ORDER.slice(0, start));
  // следующий — с наименьшим числом прохождений, первый в порядке от старта
  const counts = rot.map((id) => S.sessions.filter((s) => s.workoutId === id).length);
  const min = Math.min(...counts);
  return rot[counts.indexOf(min)];
}

// самочувствие на сегодня: от него зависят рабочий вес, число подходов и отдых.
// Живёт в журнале и сбрасывается на «норму» на следующий день — вчерашняя разбитость
// не должна молча резать сегодняшний квест
export function feelToday() {
  const f = S.feel;
  return f && f.date === today() && FEEL[f.val] ? f.val : "norm";
}

export function setFeelToday(val) {
  S.feel = { date: today(), val: FEEL[val] ? val : "norm" };
  invalidateE1RM(); save();
}

// зона нагрузки по числу повторов (для подписи отдыха)
export function repZone(r) {
  if (r <= 5) return "сила";
  if (r <= 8) return "сила/гипертрофия";
  if (r <= 12) return "гипертрофия";
  if (r <= 15) return "гипертрофия/выносл.";
  return "выносливость";
}

// изоляция — по id упражнения (остальное считаем многосуставным компаундом)
export const ISO_RE = /curl|raise|delt|pushdown|french|calv|abs|cross|hammer|legext|legcurl|shrug|fly|pec/i;

// уровень упражнения: 1 — тяжёлая база штанги (макс. перформанс), 2 — вторичный
// компаунд / гипертрофия, 3 — изоляция/подсобка
export function exTier(ex) {
  if (ex.tier) return ex.tier;                                      // из пула движений
  const src = exById(ex.id);
  if (src && src.tier) return src.tier;
  if (ex.id === "squat-vol") return 2;                              // многоповторный присед — гипертрофия
  if (["squat", "deadlift", "bench", "ohp"].includes(ex.lift)) return 1;
  if (ISO_RE.test(ex.id)) return 3;
  return 2;
}

// Умный отдых. Тяжёлая база (присед/становая/жим/швунг) требует 4–5 мин, иначе
// повторы падают между подходами (Willardson & Burkett 2005/2006: при 8ПМ суммарные
// повторы за 4 сета растут 1→2→5 мин: присед 22→25→29, жим 17→22→26). Подсобка и
// изоляция — коротко по зоне повторов (de Salles 2009; NSCA; Grgic 2018).
export function smartRest(ex, set, a) {
  const r = set.r || 8;
  const tier = exTier(ex);
  const pct = (a && a.target > 0) ? set.w / a.target : null;
  const warmup = pct != null && pct <= 0.6; // явно лёгкий/разминочный подход
  // отдых берём из общего справочника — по нему же считается рабочий вес,
  // иначе план и расчёт разъезжаются: вес как на три минуты, отдых как на минуту
  let rest = restFor(tier, r);
  if (warmup) rest = Math.min(rest, 120);
  else if (pct != null && tier !== 1) { if (pct >= 0.9) rest += 20; else if (pct <= 0.7) rest -= 15; }
  // состояние
  rest *= feelOf(feelToday()).rest;
  // тяжёлая база на рабочих подходах в силовой зоне — гарантируем ≥4 мин
  if (tier === 1 && r <= 8 && !warmup) rest = Math.max(rest, 240);
  rest = Math.round(rest / 5) * 5;
  return Math.max(40, Math.min(360, rest));
}

/* ================= КВЕСТЫ (цикл) ================= */
export const exCount = (wid) => { const w = workoutOf(wid); return w ? w.exercises.length : 0; };

/* ================= АРСЕНАЛ ДВИЖЕНИЙ (подстраница квестов) ================= */
// Рабочий вес любого движения под атлета: свой замер, иначе оценка от базовых лифтов.
export function poolWeight(ex, reps = [8, 10], rir = 1, sets = 3) {
  const p = progressOf(ex, { reps, rir, sets });
  // для подтягиваний ноль — осмысленный ответ: «свой вес, без пояса», а не «не считается»
  return p ? { ...p, est1RM: p.target || (ex && ex.bw && p.source !== "none") ? p.work1RM : 0 } : null;
}

// в каких квестах цикла встречается движение
export function usedIn(id) {
  const out = [];
  PROGRAM.weeks.forEach((wk) => wk.workouts.forEach((w) => {
    const has = buildExercises(w, planOf(w.id)).some((e) => e.id === id);
    if (has) out.push({ wid: w.id, boss: w.boss, week: wk.n, type: w.type });
  }));
  return out;
}

/* ================= ХРОНИКИ (прогресс) ================= */
/* ================= анализ пределов силы (потолки/полы, тренды) ================= */
/** Поправить рабочий максимум движения: множитель к тому, что есть сейчас. */
export function scaleWorkMax(id, k) {
  const src = exById(id);
  if (!src) return;
  const key = src.lift || src.id;
  const p = progressOf(src, { reps: SCHEME.strength.acc.reps, rir: SCHEME.strength.acc.rir, sets: SCHEME.strength.acc.sets });
  const base = p && p.work1RM ? p.work1RM : 0;
  if (!base) return;
  S.workReset = S.workReset || {};
  S.workReset[key] = { date: today(), one: base * k };
  invalidateE1RM(); save();
}

/**
 * Задать рабочий максимум по реальному подходу «на пределе»: вес × повторы.
 * Для подтягиваний и брусьев вес — довесок (0 — без пояса), считается вместе с весом
 * тела. Дальше вес снова ведут подходы — с этой точки.
 * @returns новый рабочий вес под силовую схему или null, если значения не годятся
 */
export function setWorkFromSet(id, w, r) {
  const src = exById(id);
  if (!src) return null;
  const reps = Math.round(r);
  if (!(reps >= 1 && reps <= 30) || !(w >= 0 && w <= 500) || (!src.bw && !(w > 0))) return null;
  const sys = spaceOf(spaceFor(src)).toSys(w);
  if (!(sys > 0)) return null;
  S.workReset = S.workReset || {};
  // подход на пределе — запаса нет (rir 0): «еле сделал 25 на 5» — это и есть потолок
  S.workReset[src.lift || src.id] = { date: today(), one: asMax(sys, reps, 0) };
  invalidateE1RM(); save();
  const p = progressOf(src, { reps: SCHEME.strength.acc.reps, rir: SCHEME.strength.acc.rir, sets: SCHEME.strength.acc.sets });
  return p ? p.target : null;
}

/** Вернуть расчёт по журналу: ручная правка снимается. */
export function clearWorkMax(id) {
  const src = exById(id);
  if (!src || !S.workReset) return;
  delete S.workReset[src.lift || src.id];
  invalidateE1RM(); save();
}

// Что было в прошлый раз по этому движению — главный ориентир двойной прогрессии.
export function lastDone(ex) {
  const h = movementHistory()[ex.lift || ex.id];
  if (!h || !h.length) return null;
  const last = h[h.length - 1];
  const done = last.sets.filter((x) => setDone(x, exById(ex.id) || ex));
  if (!done.length) return null;
  const peak = Math.max(...done.map((x) => x.w));
  const sets = done.filter((x) => !isWarmup(x, peak, spaceFor(exById(ex.id) || ex)));   // разминку в сводке не показываем
  if (!sets.length) return null;
  const top = Math.max(...sets.map((x) => x.w));
  const same = sets.every((x) => x.w === top);
  // одинаковый вес во всех подходах — печатаем один раз: «102,5 × 6 · 6 · 5»
  const txt = same
    ? `${fmt(top)} × ${sets.map((x) => x.r).join(" · ")}`
    : sets.map((x) => `${fmt(x.w)}×${x.r}`).join(" · ");
  return { date: last.date, txt, top, sets };
}

// Ближайший квест цикла, где встречается движение: оттуда и схема, и рабочий вес.
export function nextSlotFor(key) {
  const start = Math.max(0, ORDER.indexOf(nextWorkoutId()));
  for (let i = 0; i < ORDER.length; i++) {
    const wid = ORDER[(start + i) % ORDER.length];
    const w = workoutOf(wid);
    const ex = w && w.exercises.find((x) => (x.lift || x.id) === key);
    if (ex) return { wid, boss: (WORKOUTS[wid] || {}).boss || "", ex };
  }
  return null;
}

/** В каком весе сравнивать подходы: для подтягиваний и брусьев — тело плюс довесок. */
export const spaceFor = (src) => ({ bw: !!(src && src.bw), perHand: !!(src && src.perHand), bodyweight: currentWeight() });
