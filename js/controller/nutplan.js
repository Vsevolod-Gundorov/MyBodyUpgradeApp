// Контроллер: настройка питания — цель, программа, ручные нормы, поправка по весу.
import { render } from "./router.js";
import { computeTargets } from "../../data/profile.js";
import {
  adjustSuggestion, applyAdjust, dismissAdjust, profile, profileInput, setNutritionPlan, setOverride,
} from "../model/profile.js";
import { save } from "../model/store.js";
import { overlayRoot } from "../view/dom.js";
import { fxChime, fxTap } from "../view/fx.js";
import { OB_ERRORS } from "../view/onboarding.js";
import { nutPlanView } from "../view/nutplan.js";

const numOf = (v) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
const kcalOf = (m) => Math.round((m.protein * 4 + m.fat * 9 + m.carbs * 4) / 10) * 10;

export function openNutritionPlan() {
  const p = profile();
  if (!p) return;
  const f = { direction: p.direction, pace: p.pace || "normal", program: p.program, custom: p.custom || { protein: 2, fat: 0.9 } };
  const manual = { training: p.override && p.override.training ? { ...p.override.training } : null, rest: p.override && p.override.rest ? { ...p.override.rest } : null };
  let adjust = p.adjust || 0, adjustTouched = false;
  let suggestion = adjustSuggestion();

  const o = document.createElement("div");
  o.className = "overlay food-sheet ob-sheet np-sheet";
  o.setAttribute("role", "dialog");
  o.setAttribute("aria-label", "Настройка питания");
  overlayRoot.appendChild(o);
  const $ = (s) => o.querySelector(s);
  const targets = () => computeTargets({ ...profileInput(), ...f, custom: f.program === "custom" ? f.custom : null,
    adjust: adjustTouched || (f.direction === p.direction && f.program === p.program) ? adjust : 0 });

  function readInputs() {
    if (f.program === "custom" && $("#np-cp")) f.custom = { protein: numOf($("#np-cp").value), fat: numOf($("#np-cf").value) };
    ["training", "rest"].forEach((k) => {
      if (!manual[k] || !$(`#np-${k}-protein`)) return;
      ["protein", "fat", "carbs"].forEach((m) => (manual[k][m] = numOf($(`#np-${k}-${m}`).value) ?? 0));
      manual[k].kcal = kcalOf(manual[k]);
    });
  }
  function draw() {
    const keep = $(".ob-body") ? $(".ob-body").scrollTop : 0;
    let t;
    try { t = targets(); } catch (e) { t = computeTargets(profileInput()); }
    o.innerHTML = nutPlanView({ f, t, manual, suggestion, adjust });
    $(".ob-body").scrollTop = keep;
    wire();
  }
  function wire() {
    o.querySelectorAll("[data-group]").forEach((b) => b.onclick = () => {
      readInputs(); f[b.dataset.group] = b.dataset.value; fxTap(); draw();
    });
    $("#np-close").onclick = () => o.remove();
    $("#np-manual").onclick = () => {
      readInputs();
      const on = !(manual.training || manual.rest);
      const t = targets();
      ["training", "rest"].forEach((k) => (manual[k] = on ? { kcal: t[k].kcal, protein: t[k].protein, fat: t[k].fat, carbs: t[k].carbs } : null));
      draw();
    };
    // калории по БЖУ — сразу, без перерисовки (фокус остаётся в поле)
    o.querySelectorAll(".np-in input").forEach((inp) => inp.oninput = () => {
      readInputs();
      ["training", "rest"].forEach((k) => { if (manual[k]) $(`#np-kcal-${k}`).textContent = manual[k].kcal; });
    });
    const yes = $("#np-adj-yes");
    if (yes) yes.onclick = () => { adjust = Math.max(-800, Math.min(800, adjust + suggestion.kcal)); adjustTouched = true; suggestion = null; fxTap(); draw(); };
    const no = $("#np-adj-no");
    if (no) no.onclick = () => { dismissAdjust(); save(); suggestion = null; draw(); };
    const reset = $("#np-adj-reset");
    if (reset) reset.onclick = () => { adjust = 0; adjustTouched = true; draw(); };
    $("#np-save").onclick = () => {
      readInputs();
      for (const k of ["training", "rest"]) {
        const m = manual[k];
        if (m && !(m.protein >= 0 && m.fat >= 0 && m.carbs >= 0 && m.kcal >= 800 && m.kcal <= 6000)) { $("#np-error").textContent = "Проверьте БЖУ: калории должны быть от 800 до 6000"; return; }
      }
      const res = setNutritionPlan(f);
      if (!res.ok) { $("#np-error").textContent = OB_ERRORS[res.error] || "Проверьте значения"; return; }
      // смена цели или программы обнуляет поправку (она была под старый план), если её не трогали здесь же
      const cur = profile();
      if (adjustTouched) { cur.adjust = 0; if (adjust) applyAdjust(adjust); }
      ["training", "rest"].forEach((k) => setOverride(k, manual[k]));
      save(); fxChime(); o.remove(); render();
    };
  }
  draw();
  return o;
}
