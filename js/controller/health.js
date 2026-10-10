// Контроллер: заметка к упражнению с жалобами и список действующих жалоб.
import { easeFor, parseComplaint } from "../../data/complaints.js";
import { activeNow, answerCheck, exNote, saveExNote } from "../model/health.js";
import { save } from "../model/store.js";
import { invalidateE1RM } from "../model/training.js";
import { overlayRoot } from "../view/dom.js";
import { fxChime, fxTap } from "../view/fx.js";
import { complaintsSheetView, notePreviewView, noteSheetView } from "../view/workout.js";

/**
 * Заметка к упражнению. Зоны можно отметить кнопками или просто написать
 * «болело плечо» — словарь распознает сам. Ниже видно, какие движения этой
 * тренировки облегчатся и насколько, — до сохранения.
 */
export function openExerciseNote(wid, ex, exercises, onDone = () => {}) {
  const text0 = exNote(wid, ex.id);
  // выбранные кнопками зоны: area -> level; уже действующие жалобы показываем отмеченными
  const sel = {};
  activeNow().forEach((c) => { sel[c.area] = c.level; });
  const picked = new Set();   // что человек нажал сам в этом листе
  let level = null;           // сила, выбранная кнопкой

  const o = document.createElement("div");
  o.className = "overlay portion-overlay";
  o.setAttribute("role", "dialog");
  o.setAttribute("aria-label", `Заметка: ${ex.name}`);
  overlayRoot.appendChild(o);
  const $ = (q) => o.querySelector(q);

  const current = () => {
    const found = parseComplaint($("#nt-text").value);
    const out = {};
    found.forEach((f) => { out[f.area] = level || f.level; });
    picked.forEach((a) => { out[a] = level || out[a] || "mild"; });
    return out;
  };
  const preview = () => {
    const all = { ...sel, ...current() };
    const list = Object.entries(all).map(([area, lv]) => ({ area, level: lv }));
    const rows = exercises.map((x) => ({ x, e: easeFor(x.id, list) })).filter((r) => r.e)
      .map((r) => ({ name: r.x.name, k: r.e.k, swap: r.e.swap }));
    $("#nt-preview").innerHTML = notePreviewView(rows);
    // кнопки зон и силы — отражают то, что распознано в тексте
    const cur = current();
    o.querySelectorAll("[data-area]").forEach((b) => { const on = !!cur[b.dataset.area] || !!sel[b.dataset.area]; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
    const lv = $(".nt-levels");
    lv.hidden = !Object.keys(cur).length;
    o.querySelectorAll("[data-level]").forEach((b) => b.classList.toggle("on", Object.values(cur).includes(b.dataset.level)));
  };
  const draw = () => {
    o.innerHTML = noteSheetView({ name: ex.name, text: text0, sel });
    $("#nt-text").oninput = preview;
    o.querySelectorAll("[data-area]").forEach((b) => b.onclick = () => {
      const a = b.dataset.area;
      if (picked.has(a)) picked.delete(a); else picked.add(a);
      fxTap(); preview();
    });
    o.querySelectorAll("[data-level]").forEach((b) => b.onclick = () => { level = b.dataset.level; fxTap(); preview(); });
    $("#nt-cancel").onclick = () => o.remove();
    $("#nt-save").onclick = () => {
      const extra = Object.entries(current()).map(([area, lv]) => ({ area, level: lv }));
      saveExNote(wid, ex.id, $("#nt-text").value, extra);
      invalidateE1RM(); save(); fxChime(); o.remove(); onDone();
    };
    preview();
    setTimeout(() => $("#nt-text") && $("#nt-text").focus(), 60);
  };
  o.addEventListener("click", (e) => { if (e.target === o) o.remove(); });
  draw();
}

/** Действующие жалобы: закрыть, если прошло. */
export function openComplaints(onDone = () => {}) {
  const o = document.createElement("div");
  o.className = "overlay portion-overlay";
  overlayRoot.appendChild(o);
  const draw = () => {
    const list = activeNow();
    o.innerHTML = complaintsSheetView({ list });
    o.querySelectorAll("[data-gone]").forEach((b) => b.onclick = () => { answerCheck(b.dataset.gone, "gone"); invalidateE1RM(); save(); fxTap(); draw(); });
    o.querySelector("#cm-close").onclick = () => { o.remove(); onDone(); };
  };
  o.addEventListener("click", (e) => { if (e.target === o) { o.remove(); onDone(); } });
  draw();
}
