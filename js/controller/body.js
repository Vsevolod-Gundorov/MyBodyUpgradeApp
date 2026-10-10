// Контроллер: вес тела — карточка с графиком, запись взвешивания, история.
import { trendChange, weightTrend, weightTrendSeries } from "../../data/profile.js";
import { today } from "../core/format.js";
import { checkAchievements } from "../model/achievements.js";
import { currentWeight, deleteWeight, logWeight, weightLog } from "../model/profile.js";
import { save } from "../model/store.js";
import { invalidateE1RM } from "../model/training.js";
import { overlayRoot } from "../view/dom.js";
import { fxChime, fxTap } from "../view/fx.js";
import { chartGeom, historyView, tipView, weightCardView, weightSheetView } from "../view/body.js";

let range = 90;   // дней на графике; запоминается на время работы приложения

/** Нарисовать карточку веса в контейнер и подключить её. */
export function mountWeightCard(box, onChange = () => {}) {
  if (!box) return;
  const log = weightLog();
  const series = weightTrendSeries(log);
  const empty = !series.length;
  const to = today();
  const fromWanted = new Date(Date.now() - range * 864e5).toISOString().slice(0, 10);
  const from = empty ? to : (range >= 3650 ? series[0].date : (series[0].date > fromWanted ? series[0].date : fromWanted));
  const g = empty ? null : chartGeom(series, from, to);
  const tr = weightTrend(log);
  box.innerHTML = weightCardView({
    g, empty, range, cur: empty ? null : series[series.length - 1].trend,
    change: empty ? null : trendChange(series, Math.min(range, 3650)), rate: tr ? tr.kgPerWeek : null,
  });
  const redraw = () => { mountWeightCard(box, onChange); };
  box.querySelector("#wc-add").onclick = () => { fxTap(); openWeightSheet(() => { redraw(); onChange(); }); };
  box.querySelectorAll("[data-range]").forEach((b) => b.onclick = () => { range = +b.dataset.range; fxTap(); redraw(); });
  const hist = box.querySelector("#wc-hist");
  if (hist) hist.onclick = () => openWeightHistory(() => { redraw(); onChange(); });
  if (g) wireChart(box, g);
}

/** Касание или ведение пальцем по графику: перекрестие и подсказка у ближайшего взвешивания. */
function wireChart(box, g) {
  const svg = box.querySelector(".wc-svg");
  const tip = box.querySelector("#wc-tip"), cross = box.querySelector("#wc-cross"), hl = box.querySelector("#wc-hl");
  if (!svg) return;
  const show = (ev) => {
    const r = svg.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * 340;
    const p = g.pts.reduce((a, q) => (Math.abs(q.x - x) < Math.abs(a.x - x) ? q : a), g.pts[0]);
    cross.setAttribute("x1", p.x); cross.setAttribute("x2", p.x); cross.setAttribute("visibility", "visible");
    hl.setAttribute("cx", p.x); hl.setAttribute("cy", p.yk); hl.setAttribute("visibility", "visible");
    tip.innerHTML = tipView(p);
    tip.hidden = false;
    const left = (p.x / 340) * r.width;
    tip.style.left = `${Math.max(4, Math.min(r.width - tip.offsetWidth - 4, left - tip.offsetWidth / 2))}px`;
  };
  const hide = () => { tip.hidden = true; cross.setAttribute("visibility", "hidden"); hl.setAttribute("visibility", "hidden"); };
  svg.addEventListener("pointerdown", (e) => { show(e); svg.setPointerCapture && svg.setPointerCapture(e.pointerId); });
  svg.addEventListener("pointermove", (e) => { if (e.buttons || e.pointerType === "mouse") show(e); });
  svg.addEventListener("pointerleave", hide);
  svg.addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") setTimeout(hide, 1800); });
}

/** Лист «Взвешивание». */
export function openWeightSheet(onDone = () => {}) {
  const o = document.createElement("div");
  o.className = "overlay portion-overlay";
  o.innerHTML = weightSheetView({ kg: currentWeight(), date: today(), max: today() });
  overlayRoot.appendChild(o);
  const inp = o.querySelector("#ws-kg");
  const val = () => parseFloat(String(inp.value).replace(",", "."));
  o.querySelectorAll("[data-step]").forEach((b) => b.onclick = () => {
    const v = (Number.isFinite(val()) ? val() : currentWeight()) + Number(b.dataset.step);
    inp.value = String(Math.round(v * 10) / 10).replace(".", ","); fxTap();
  });
  const commit = () => {
    const date = o.querySelector("#ws-date").value || today();
    if (date > today()) { o.querySelector("#ws-error").textContent = "Дата не может быть в будущем"; return; }
    if (!logWeight(val(), date)) { o.querySelector("#ws-error").textContent = "Вес — от 30 до 300 кг"; inp.focus(); return; }
    invalidateE1RM(); save(); fxChime(); o.remove(); onDone(); checkAchievements({ type: "body" });
  };
  o.querySelector("#ws-save").onclick = commit;
  inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } };
  o.querySelector("#ws-cancel").onclick = () => o.remove();
  o.addEventListener("click", (e) => { if (e.target === o) o.remove(); });
  setTimeout(() => inp.select(), 60);
}

export function openWeightHistory(onDone = () => {}) {
  const o = document.createElement("div");
  o.className = "overlay portion-overlay";
  const draw = () => {
    o.innerHTML = historyView({ rows: [...weightLog()].reverse() });
    o.querySelectorAll("[data-del]").forEach((b) => b.onclick = () => { deleteWeight(b.dataset.del); invalidateE1RM(); save(); draw(); });
    o.querySelector("#wh-close").onclick = () => { o.remove(); onDone(); };
  };
  overlayRoot.appendChild(o);
  draw();
  o.addEventListener("click", (e) => { if (e.target === o) { o.remove(); onDone(); } });
}
