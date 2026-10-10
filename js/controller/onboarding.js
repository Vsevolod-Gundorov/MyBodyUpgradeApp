// Контроллер: мастер профиля. Первый запуск — обязательный (без профиля нормы и
// стартовые веса были бы чужими), из профиля — правка с закрытием в любой момент.
import { render } from "./router.js";
import { LIFTS, checkProfile, computeTargets, estimateMaxes, oneRepMax } from "../../data/profile.js";
import { invalidateE1RM } from "../model/training.js";
import { baselines, currentWeight, profile, saveProfile } from "../model/profile.js";
import { S, save } from "../model/store.js";
import { overlayRoot } from "../view/dom.js";
import { fxChime, fxTap } from "../view/fx.js";
import {
  OB_ERRORS, STEPS, aboutStepView, foodStepView, goalStepView, planStepView, trainingStepView, wizardView,
} from "../view/onboarding.js";

const numOf = (v) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : null; };

/** Черновик формы: из профиля, если он есть, иначе из того, что уже известно. */
function draftOf() {
  const p = profile();
  const knownWeight = (S.body && S.body.weights && S.body.weights.length) || S.sessions.length;
  const f = {
    name: S.hero.name || "", sex: p ? p.sex : null,
    age: p ? new Date().getFullYear() - p.birthYear : null, height: p ? p.height : null,
    weight: knownWeight ? currentWeight() : null,
    direction: p ? p.direction : null, pace: p ? p.pace : "normal",
    program: p ? p.program : "balanced", custom: (p && p.custom) || { protein: 2, fat: 0.9 },
    activity: p ? p.activity : null, experience: p ? p.experience : null,
    knowMaxes: !!(p && p.maxesSource === "entered"), sets: {},
  };
  if (p && p.maxesSource === "entered") LIFTS.forEach((l) => (f.sets[l] = { w: p.maxes[l], r: 1 }));
  return f;
}

/**
 * @param opts.editing — правка из профиля (можно закрыть); иначе первый запуск
 */
export function openProfileWizard({ editing = false } = {}) {
  if (document.querySelector(".ob-sheet")) return;
  const f = draftOf();
  let step = "about";
  const hasJournal = S.sessions.length > 0;

  const o = document.createElement("div");
  o.className = "overlay food-sheet ob-sheet";
  o.setAttribute("role", "dialog");
  o.setAttribute("aria-label", editing ? "Профиль" : "Знакомство");
  overlayRoot.appendChild(o);

  const $ = (sel) => o.querySelector(sel);
  const err = (code) => { $("#ob-error").textContent = code ? (OB_ERRORS[code] || "Проверьте значения") : ""; };

  // чтение полей текущего шага в черновик
  function readStep() {
    if (step === "about") {
      f.name = $("#ob-name").value;
      f.age = numOf($("#ob-age").value); f.height = numOf($("#ob-height").value); f.weight = numOf($("#ob-weight").value);
    }
    if (step === "food" && f.program === "custom") f.custom = { protein: numOf($("#ob-cp").value), fat: numOf($("#ob-cf").value) };
    if (step === "training" && f.knowMaxes) LIFTS.forEach((l) => (f.sets[l] = { w: numOf($(`#ob-w-${l}`).value), r: numOf($(`#ob-r-${l}`).value) }));
  }
  // проверка шага; возвращает код ошибки
  function checkStep() {
    const full = { sex: f.sex, age: f.age, height: f.height, weight: f.weight, activity: "light", direction: "maintain", program: "balanced" };
    if (step === "about") {
      if (!f.name.trim()) return "name";
      return checkProfile(full);
    }
    if (step === "goal") return f.direction ? null : "direction";
    if (step === "food") {
      if (!f.program) return "program";
      if (!f.activity) return "activity";
      return checkProfile({ ...full, activity: f.activity, program: f.program, custom: f.custom });
    }
    if (step === "training") return f.experience ? null : "experience";
    return null;
  }
  const maxesOf = () => {
    if (f.knowMaxes) {
      const est = estimateMaxes(f);
      const out = {};
      LIFTS.forEach((l) => { const s = f.sets[l] || {}; out[l] = oneRepMax(s.w, s.r) || est[l]; });
      return { maxes: out, note: "по вашим подходам", entered: true };
    }
    if (hasJournal) return { maxes: (profile() && profile().maxes) || baselines(), note: "по журналу" };
    return { maxes: estimateMaxes(f), note: "оценка с запасом" };
  };

  function draw() {
    o.innerHTML = wizardView({ step, editing });
    const box = $("#ob-step");
    if (step === "about") box.innerHTML = aboutStepView(f);
    if (step === "goal") box.innerHTML = goalStepView(f);
    if (step === "food") box.innerHTML = foodStepView(f);
    if (step === "training") box.innerHTML = trainingStepView(f, { hasJournal, estimated: f.experience && f.sex && f.weight ? estimateMaxes(f) : null });
    if (step === "plan") {
      const t = computeTargets({ ...f, adjust: (profile() && profile().direction === f.direction && profile().program === f.program && profile().adjust) || 0 });
      const m = maxesOf();
      box.innerHTML = planStepView({ f, t, maxes: m.maxes, maxesNote: m.note });
    }
    wire();
  }

  function wire() {
    o.querySelectorAll("[data-group]").forEach((b) => b.onclick = () => {
      readStep();
      const g = b.dataset.group;
      f[g] = b.dataset.value;
      if (g === "direction" && !f.pace) f.pace = "normal";
      fxTap(); err(null);
      const keep = $("#ob-body").scrollTop;
      draw(); $("#ob-body").scrollTop = keep;
    });
    const know = $("#ob-know");
    if (know) know.onclick = () => { readStep(); f.knowMaxes = !f.knowMaxes; draw(); };
    $("#ob-next").onclick = next;
    const back = $("#ob-back");
    if (back) back.onclick = () => {
      const i = STEPS.indexOf(step);
      if (i === 0) { o.remove(); return; }
      readStep(); err(null); step = STEPS[i - 1]; draw();
    };
    const close = $("#ob-close");
    if (close) close.onclick = () => o.remove();
    o.querySelectorAll("input").forEach((inp) => inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); next(); } }));
    o.querySelectorAll("input").forEach((inp) => inp.addEventListener("input", () => err(null)));
  }

  function next() {
    readStep();
    const code = checkStep();
    if (code) { err(code); return; }
    const i = STEPS.indexOf(step);
    if (step !== "plan") { step = STEPS[i + 1]; fxTap(); draw(); $("#ob-body").scrollTop = 0; return; }
    const m = maxesOf();
    const res = saveProfile({ ...f, maxes: m.entered ? m.maxes : null });
    if (!res.ok) { err(res.error); return; }
    invalidateE1RM(); save(); fxChime(); o.remove(); render();
  }

  draw();
  if (!editing) setTimeout(() => { const n = $("#ob-name"); if (n && !n.value) n.focus(); }, 80);
  return o;
}
