// Контроллер всплывающих окон: разборы, выборщики, вердикт, достижения.
import { ACH_BY_ID, CATEGORIES, TIERS, summary as achSummary, cardKey, catHidden } from "../../data/achievements.js";
import { EXERCISES, MUSCLES, MUSCLE_ORDER, PATTERNS, exById, similarTo } from "../../data/exercises.js";
import { METHODS, SCHEME } from "../../data/program.js";
import { render, setView, withLoader } from "./router.js";
import { renderWorkout } from "./workout.js";
import { achievementCards } from "../model/achievements.js";
import { WORKOUTS, planOf, setPlan } from "../model/catalog.js";
import { S } from "../model/store.js";
import { themeNow } from "../model/theme.js";
import { clearWorkMax, poolWeight, scaleWorkMax, setWorkFromSet, usedIn } from "../model/training.js";
import { overlayRoot } from "../view/dom.js";
import { fxChime, fxTap, haptic, tone } from "../view/fx.js";
import { achievementDetailView, achievementToastView, allAchievementsView, exerciseDetailView, infoView, methodView, pairPickerView, poolPickerView, sessionDetailView, sessionRowsView, verdictBadgesView, verdictView } from "../view/overlays.js";

/* разбор движения: техника, мышцы, рабочий вес и история атлета */
export function showExerciseDetail(id, opts = {}) {
  const ex = exById(id);
  if (!ex) return;
  fxTap();
  const ww = poolWeight(ex);
  const strength = poolWeight(ex, SCHEME.strength.acc.reps, SCHEME.strength.acc.rir, SCHEME.strength.acc.sets);
  const volume = poolWeight(ex, SCHEME.volume.acc.reps, SCHEME.volume.acc.rir, SCHEME.volume.acc.sets);
  const used = usedIn(ex.id);
  const alts = similarTo(ex.id, 3);
  const o = document.createElement("div");
  o.className = "overlay portion-overlay";
  o.innerHTML = exerciseDetailView({ alts, ex, opts, strength, used, volume, ww });
  overlayRoot.appendChild(o);
  if (opts.onPick) o.querySelector("#ex-pick").onclick = () => { o.remove(); opts.onPick(ex.id); };
  o.querySelectorAll("[data-alt]").forEach((b) => b.onclick = () => { o.remove(); showExerciseDetail(b.dataset.alt, opts); });
  // правка рабочего веса: множителем к текущему, с мгновенной перерисовкой карточки
  o.querySelectorAll("[data-fix]").forEach((b) => b.onclick = () => {
    const k = Number(b.dataset.fix);
    if (k) scaleWorkMax(ex.id, k); else clearWorkMax(ex.id);
    fxTap(); o.remove(); showExerciseDetail(ex.id, opts);
    if (opts.onChange) opts.onChange();
  });
  // рабочий вес по реальному подходу на пределе: «25 × 5 — еле сделал»
  const go = o.querySelector("#ex-set-go");
  if (go) {
    const num = (v) => parseFloat(String(v || "").replace(",", "."));
    const apply = () => {
      const w = num(o.querySelector("#ex-set-w").value), r = num(o.querySelector("#ex-set-r").value);
      const t = setWorkFromSet(ex.id, Number.isFinite(w) ? w : (ex.bw ? 0 : NaN), r);
      if (t == null) { o.querySelector("#ex-set-note").textContent = "Проверьте вес и повторы: повторов от 1 до 30"; return; }
      fxTap(); o.remove(); showExerciseDetail(ex.id, opts);
      if (opts.onChange) opts.onChange();
    };
    go.onclick = apply;
    o.querySelector("#ex-set-r").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); apply(); } };
  }
  o.querySelector("#ex-close").onclick = () => o.remove();
  o.addEventListener("click", (e) => { if (e.target === o) o.remove(); });
}

/* универсальная модалка-подсказка: весь длинный текст живёт здесь, а не на экране */
export function showInfo({ title, eyebrow = "", body }) {
  fxTap();
  const o = document.createElement("div");
  o.className = "overlay portion-overlay";
  o.innerHTML = infoView({ body, eyebrow, title });
  overlayRoot.appendChild(o);
  o.querySelector("#info-close").onclick = () => o.remove();
  o.addEventListener("click", (e) => { if (e.target === o) o.remove(); });
  o.querySelectorAll("[data-method]").forEach((b) => b.onclick = () => showMethod(b.dataset.method));
  return o;
}

/* разбор приёма интенсивности (как у про, но в дозировке натурала) */
export function showMethod(key) {
  const m = METHODS[key];
  if (!m) return;
  fxTap();
  const o = document.createElement("div");
  o.className = "overlay portion-overlay";
  o.innerHTML = methodView({ m });
  overlayRoot.appendChild(o);
  o.querySelector("#m-close").onclick = () => o.remove();
  o.addEventListener("click", (e) => { if (e.target === o) o.remove(); });
}

/* С кем объединить в суперсет: список движений этого же квеста.
   Пара на разные группы — классический суперсет-антагонист: мышца отдыхает,
   пока работает партнёр. Пара на одну группу — двойной подход без отдыха,
   и рабочий вес под неё пересчитывается вниз, о чём честно сказано в списке. */
export function openPairPicker(wid, ex, list) {
  fxTap();
  const src = exById(ex.id) || ex;
  const mates = list.filter((x) => x.id !== ex.id && !x.ss);
  const o = document.createElement("div");
  o.className = "overlay portion-overlay";
  o.innerHTML = pairPickerView({ ex, mates, src });
  overlayRoot.appendChild(o);
  o.querySelectorAll("[data-mate]").forEach((b) => b.onclick = () => {
    const pl = planOf(wid);
    setPlan(wid, { pair: [...(pl.pair || []), [ex.id, b.dataset.mate]] });
    o.remove(); fxTap(); renderWorkout(wid);
  });
  o.querySelector("#pair-close").onclick = () => o.remove();
  o.addEventListener("click", (e) => { if (e.target === o) o.remove(); });
}

/* выбор движения из пула: замена или добавление в квест */
export function openPoolPicker({ title, suggest = [], exclude = [], onPick }) {
  fxTap();
  const ban = new Set(exclude);
  let q = "";
  const o = document.createElement("div");
  o.className = "overlay portion-overlay";
  const draw = () => {
    const qq = q.trim().toLowerCase();
    const match = (ex) => !ban.has(ex.id) && (!qq || ex.name.toLowerCase().includes(qq) ||
      (MUSCLES[ex.group] || "").toLowerCase().includes(qq) || (PATTERNS[ex.pattern] || "").toLowerCase().includes(qq));
    const sug = suggest.filter(match);
    const rest = MUSCLE_ORDER.map((g) => ({ g, list: EXERCISES.filter((e) => e.group === g && match(e) && !sug.includes(e)) })).filter((x) => x.list.length);
    o.innerHTML = poolPickerView({ q, rest, sug, title });
    const qi = o.querySelector("#pk-q");
    qi.oninput = () => { q = qi.value; const at = qi.selectionStart; draw(); const n = o.querySelector("#pk-q"); n.focus(); n.setSelectionRange(at, at); };
    o.querySelectorAll(".pool-row").forEach((b) => b.onclick = () => showExerciseDetail(b.dataset.ex, { onPick: (id) => { o.remove(); onPick(id); } }));
    o.querySelector("#pk-close").onclick = () => o.remove();
  };
  draw();
  overlayRoot.appendChild(o);
  o.addEventListener("click", (e) => { if (e.target === o) o.remove(); });
}

export function showAchievementToast(unlocked) {
  let host = document.getElementById("ach-toasts");
  if (!host) { host = document.createElement("div"); host.id = "ach-toasts"; document.body.appendChild(host); }
  unlocked.slice(0, 3).forEach((u, i) => {
    const el = document.createElement("button");
    el.className = "ach-toast";
    el.innerHTML = achievementToastView({ u });
    el.onclick = () => { el.remove(); showAchievementDetail(u.ach); };
    setTimeout(() => { host.appendChild(el); requestAnimationFrame(() => el.classList.add("in")); setTimeout(() => { el.classList.remove("in"); setTimeout(() => el.remove(), 400); }, 3800); }, i * 350);
  });
  fxChime();
}

export function showVerdict(res, awarded, durationSec) {
  const o = document.createElement("div");
  o.className = "overlay verdict-overlay";
  // старшие ранги — первыми
  if (awarded && awarded.length) awarded = [...awarded].sort((a, b) => TIERS[b.ach.tier].rank - TIERS[a.ach.tier].rank);
  const gold = res.cls === "verdict-fail" ? "#c65b3c" : "#e0bd66";
  const bright = res.cls === "verdict-fail" ? "#e0805a" : "#f7dd94";
  const badges = verdictBadgesView({ awarded });
  o.innerHTML = verdictView({ badges, bright, durationSec, gold, res });
  overlayRoot.appendChild(o);
  if (awarded && awarded.length) fxChime(); else { tone(520, 0.18, "sine", 0.04); haptic(20); }
  o.querySelector(".v-close").onclick = () => { o.remove(); withLoader(() => { setView("cycle"); render(); }); };
}

/* просмотр ранее выполненного квеста (прошлые победы) */
export function showSessionDetail(sessionId) {
  const s = S.sessions.find((x) => x.id === sessionId);
  if (!s) return;
  const w = WORKOUTS[s.workoutId];
  fxTap();
  const rows = sessionRowsView({ s });
  const o = document.createElement("div");
  o.className = "overlay portion-overlay";
  o.innerHTML = sessionDetailView({ rows, s, w });
  overlayRoot.appendChild(o);
  o.querySelector("#sd-close").onclick = () => o.remove();
  o.addEventListener("click", (e) => { if (e.target === o) o.remove(); });
}

/* детали достижения (по тапу на значок): сам знак и все ступени его серии */
export function showAchievementDetail(a) {
  if (!a) return;
  const earned = S.achievements || {};
  const card = achievementCards(true).find((c) => c.key === cardKey(a.id));
  fxTap();
  const o = document.createElement("div");
  o.className = "overlay status-overlay";
  o.innerHTML = achievementDetailView({ a, got: earned[a.id], card, earned });
  overlayRoot.appendChild(o);
  o.querySelector("#st-close").onclick = () => o.remove();
  o.addEventListener("click", (e) => { if (e.target === o) o.remove(); });
}

/* полный список: карточка на серию, закрытые приглушены, у каждой — путь к следующему рангу */
export function showAllAchievements() {
  fxTap();
  const sum = achSummary(S.achievements || {}, themeNow());
  const cats = Object.keys(CATEGORIES).filter((k) => !catHidden(k, themeNow()));
  const o = document.createElement("div");
  o.className = "overlay portion-overlay ach-overlay";
  o.innerHTML = allAchievementsView({ cats, cards: achievementCards(true), sum });
  overlayRoot.appendChild(o);
  o.querySelectorAll(".ach-row").forEach((b) => b.onclick = () => showAchievementDetail(ACH_BY_ID[b.dataset.ach]));
  o.querySelector("#ach-close").onclick = () => o.remove();
  o.addEventListener("click", (e) => { if (e.target === o) o.remove(); });
}
