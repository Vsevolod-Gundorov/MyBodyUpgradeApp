// Контроллер экрана прогресса: итоги недели, вес, рабочие веса, базовые движения, журнал.
import { MUSCLES, MUSCLE_ORDER } from "../../data/exercises.js";
import { baselines } from "../model/profile.js";
import { mountWeightCard } from "./body.js";
import { showInfo, showSessionDetail } from "./overlays.js";
import { addDays, epley, isoWeekStart, today } from "../core/format.js";
import { sessionExercises } from "../model/catalog.js";
import { S } from "../model/store.js";
import { movementHistory } from "../model/training.js";
import { firstWeek, weekSummary } from "../model/weekly.js";
import { app } from "../view/dom.js";
import { fxTap } from "../view/fx.js";
import { liftCardView, liftListView, liftRowOf, progressHelpHTML, progressView, sessionLogView, weekCardView } from "../view/progress.js";

const LIFTS = ["squat", "bench", "deadlift", "ohp"];
// что раскрыто — помнится, пока приложение открыто
const ui = { week: null, q: "", openG: new Set(["base"]), openK: null, logAll: false };

export function renderProgress() {
  app.innerHTML = progressView();
  mountWeek();
  mountWeightCard(document.getElementById("weight-card"));
  mountLifts();
  mountCharts();
  mountLog();
}

/* ---------------- итоги недели ---------------- */
function mountWeek() {
  const box = document.getElementById("week-card");
  const cur = isoWeekStart(today()), first = firstWeek();
  const start = ui.week && ui.week >= first && ui.week <= cur ? ui.week : cur;
  const lastDate = S.sessions.reduce((m, x) => (x.date > m ? x.date : m), "");
  box.innerHTML = weekCardView({ w: weekSummary(start), canPrev: start > first, canNext: start < cur, lastDate });
  const go = (d) => { ui.week = addDays(start, d * 7); fxTap(); mountWeek(); };
  box.querySelector("#wk-prev").onclick = () => go(-1);
  box.querySelector("#wk-next").onclick = () => go(1);
}

/* ---------------- рабочие веса ---------------- */
function liftGroups(q) {
  const hist = movementHistory();
  const keys = [...LIFTS.filter((k) => hist[k]), ...Object.keys(hist).filter((k) => !LIFTS.includes(k)).sort((a, b) => hist[b].length - hist[a].length)];
  const needle = q.trim().toLowerCase();
  const rows = keys.map(liftRowOf).filter((r) => !needle || r.name.toLowerCase().includes(needle));
  const by = new Map();
  rows.forEach((r) => {
    const g = LIFTS.includes(r.k) ? "base" : (r.src && r.src.group) || "other";
    if (!by.has(g)) by.set(g, []);
    by.get(g).push(r);
  });
  const order = ["base", ...MUSCLE_ORDER, "other"];
  return order.filter((g) => by.has(g)).map((g) => ({ key: g, name: g === "base" ? "Базовые" : g === "other" ? "Другое" : MUSCLES[g], rows: by.get(g) }));
}

function mountLifts() {
  const list = document.getElementById("lr-list");
  const draw = () => {
    list.innerHTML = liftListView({ groups: liftGroups(ui.q), openG: ui.openG, openK: ui.openK, q: ui.q });
    list.querySelectorAll("[data-g]").forEach((b) => b.onclick = () => {
      const g = b.dataset.g;
      if (ui.openG.has(g)) ui.openG.delete(g); else ui.openG.add(g);
      fxTap(); draw();
    });
    list.querySelectorAll("[data-k]").forEach((b) => b.onclick = () => {
      ui.openK = ui.openK === b.dataset.k ? null : b.dataset.k;
      fxTap(); draw();
    });
  };
  const q = document.getElementById("lr-q");
  q.value = ui.q;
  q.oninput = () => { ui.q = q.value; draw(); };   // перерисовывается только список — фокус остаётся в поле
  document.getElementById("lr-how").onclick = () => showInfo({ title: "Как считаются рабочие веса", body: progressHelpHTML() });
  draw();
}

/* ---------------- базовые движения: мини-графики 2×2 ---------------- */
function mountCharts() {
  const BASE = baselines();
  const series = Object.fromEntries(Object.keys(BASE).map((k) => [k, []]));
  S.sessions.forEach((s) => {
    sessionExercises(s).forEach((ex) => {
      if (!ex.lift || !series[ex.lift]) return;
      let best = 0;
      (s.entries[ex.id] || []).forEach(({ w, r }) => { if (w && r) best = Math.max(best, epley(w, Math.min(r, 10))); });
      if (best) series[ex.lift].push({ date: s.date, v: best });
    });
  });
  const charts = document.getElementById("charts");
  charts.innerHTML = "";
  Object.entries(series).forEach(([k, arr]) => {
    const pts = [{ date: "база", v: BASE[k] }, ...arr];
    const last = pts[pts.length - 1].v;
    const card = document.createElement("div");
    card.className = "panel chart-card";
    card.innerHTML = liftCardView({ arr, d: last - BASE[k], k, last, pts });
    charts.appendChild(card);
  });
}

/* ---------------- журнал ---------------- */
function mountLog() {
  const log = document.getElementById("log");
  const all = [...S.sessions].reverse();
  const rows = ui.logAll ? all : all.slice(0, 5);
  log.innerHTML = sessionLogView({ rows, more: all.length > rows.length ? all.length : 0 });
  log.querySelectorAll(".log-row").forEach((r) => r.onclick = () => showSessionDetail(r.dataset.sid));
  const more = log.querySelector("#log-more");
  if (more) more.onclick = () => { ui.logAll = true; fxTap(); mountLog(); };
}
