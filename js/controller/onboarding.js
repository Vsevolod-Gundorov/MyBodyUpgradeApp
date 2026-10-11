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
  AUTO_STEPS, OB_ERRORS, STEPS, activityStepView, bodyStepView, experienceStepView, foodStepView,
  goalStepView, planStepView, sexStepView, wizardView,
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

/** Ползунки не бывают пустыми: подставляем типичные значения для выбранного пола. */
function withDefaults(f) {
  if (f.age == null) f.age = 30;
  if (f.height == null) f.height = f.sex === "f" ? 165 : 178;
  if (f.weight == null) f.weight = f.sex === "f" ? 62 : 80;
  return f;
}

// старые имена шагов (из профиля): «о вас» → тело, «тренировки» → опыт
const STEP_ALIAS = { about: "body", training: "experience" };

/**
 * @param opts.editing — правка из профиля (можно закрыть); иначе первый запуск
 * @param opts.step — правка одного пункта из профиля: открывается сразу этот шаг,
 *                    и «Сохранить» сохраняет профиль, не проводя по остальным
 */
export function openProfileWizard({ editing = false, step: only = null } = {}) {
  if (document.querySelector(".ob-sheet")) return;
  const f = draftOf();
  const target = STEP_ALIAS[only] || only;
  const quick = !!(editing && target && (STEPS.includes(target) || target === "food") && profile());
  const steps = quick ? [target] : STEPS;
  let step = steps[0];
  const hasJournal = S.sessions.length > 0;
  // имя: в Telegram оно уже есть; в обычном браузере спросим на первом экране
  const askName = !f.name.trim();

  const o = document.createElement("div");
  o.className = "overlay food-sheet ob-sheet";
  o.setAttribute("role", "dialog");
  o.setAttribute("aria-label", editing ? "Профиль" : "Знакомство");
  overlayRoot.appendChild(o);

  const $ = (sel) => o.querySelector(sel);
  const err = (code) => { $("#ob-error").textContent = code ? (OB_ERRORS[code] || "Проверьте значения") : ""; };

  // чтение полей текущего шага в черновик
  function readStep() {
    const name = $("#ob-name");
    if (name) f.name = name.value;
    if (step === "body") {
      f.age = numOf($("#ob-age").value); f.height = numOf($("#ob-height").value); f.weight = numOf($("#ob-weight").value);
    }
    if (step === "food" && f.program === "custom") f.custom = { protein: numOf($("#ob-cp").value), fat: numOf($("#ob-cf").value) };
    if (step === "experience" && f.knowMaxes) LIFTS.forEach((l) => (f.sets[l] = { w: numOf($(`#ob-w-${l}`).value), r: numOf($(`#ob-r-${l}`).value) }));
  }
  // проверка шага; возвращает код ошибки
  function checkStep() {
    const full = { sex: f.sex, age: f.age, height: f.height, weight: f.weight, activity: "light", direction: "maintain", program: "balanced" };
    if ((step === "sex" || step === "body") && !f.name.trim()) return "name";
    if (step === "sex") return f.sex ? null : "sex";
    if (step === "body") return checkProfile(full);
    if (step === "goal") return f.direction ? null : "direction";
    if (step === "activity") return f.activity ? null : "activity";
    if (step === "experience") return f.experience ? null : "experience";
    if (step === "food") {
      if (!f.program) return "program";
      if (!f.activity) return "activity";
      return checkProfile({ ...full, activity: f.activity, program: f.program, custom: f.custom });
    }
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
  const answered = () => ({ sex: f.sex, goal: f.direction, activity: f.activity, experience: f.experience })[step];

  function draw() {
    if (step === "body") withDefaults(f);
    o.innerHTML = wizardView({ step, steps, editing, quick, answered: !!answered() });
    const box = $("#ob-step");
    if (step === "sex") box.innerHTML = sexStepView(f, { askName });
    if (step === "body") box.innerHTML = bodyStepView(f, { withName: editing && !askName, withSex: quick });
    if (step === "goal") box.innerHTML = goalStepView(f, { showPace: quick });
    if (step === "activity") box.innerHTML = activityStepView(f);
    if (step === "experience") box.innerHTML = experienceStepView(f, { edit: editing, hasJournal });
    if (step === "food") box.innerHTML = foodStepView(f);
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
      // плитка на шаге-вопросе: выбор и есть ответ — сразу дальше, без кнопки
      if (!quick && AUTO_STEPS.has(step) && g !== "pace" && !(step === "experience" && editing)) {
        b.classList.add("on");
        o.querySelectorAll(`[data-group="${g}"]`).forEach((x) => { if (x !== b) x.classList.remove("on"); });
        setTimeout(next, 220);
        return;
      }
      const keep = $("#ob-body").scrollTop;
      draw(); $("#ob-body").scrollTop = keep;
    });
    // ползунки: число крупно обновляется на ходу, кнопки ± — для точности
    const fmtNum = (v) => String(v).replace(".", ",");
    o.querySelectorAll('input[type="range"]').forEach((r) => {
      r.oninput = () => { const out = $(`#${r.id}-out b`); if (out) out.textContent = fmtNum(r.value); err(null); };
    });
    o.querySelectorAll("[data-pm]").forEach((b) => b.onclick = () => {
      const r = $(`#${b.dataset.pm}`);
      const v = Math.min(Number(r.max), Math.max(Number(r.min), Math.round((Number(r.value) + Number(b.dataset.d)) * 10) / 10));
      r.value = String(v); r.oninput(); fxTap();
    });
    const know = $("#ob-know");
    if (know) know.onclick = () => { readStep(); f.knowMaxes = !f.knowMaxes; draw(); };
    $("#ob-next").onclick = next;
    const back = $("#ob-back");
    if (back) back.onclick = () => {
      const i = steps.indexOf(step);
      if (i === 0) { o.remove(); return; }
      readStep(); err(null); step = steps[i - 1]; draw();
    };
    const close = $("#ob-close");
    if (close) close.onclick = () => o.remove();
    o.querySelectorAll('input:not([type="range"])').forEach((inp) => inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); next(); } }));
    o.querySelectorAll("input").forEach((inp) => inp.addEventListener("input", () => err(null)));
  }

  function next() {
    readStep();
    const code = checkStep();
    if (code) { err(code); return; }
    const i = steps.indexOf(step);
    if (i < steps.length - 1) { step = steps[i + 1]; fxTap(); draw(); $("#ob-body").scrollTop = 0; return; }
    const m = maxesOf();
    const res = saveProfile({ ...f, maxes: m.entered ? m.maxes : null });
    if (!res.ok) { err(res.error); return; }
    invalidateE1RM(); save(); fxChime(); o.remove(); render();
  }

  draw();
  if (!editing && askName) setTimeout(() => { const n = $("#ob-name"); if (n && !n.value) n.focus(); }, 80);
  return o;
}
