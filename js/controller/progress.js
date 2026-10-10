// Контроллер экрана прогресса.
import { baselines } from "../model/profile.js";
import { mountWeightCard } from "./body.js";
import { showSessionDetail } from "./overlays.js";
import { epley } from "../core/format.js";
import { sessionExercises } from "../model/catalog.js";
import { S } from "../model/store.js";
import { movementHistory } from "../model/training.js";
import { app } from "../view/dom.js";
import { liftCardView, limitCardsView, progressView, sessionLogView } from "../view/progress.js";

export function renderProgress() {
  const liftSeries = {};
  const BASELINES = baselines();
  Object.keys(BASELINES).forEach((k) => (liftSeries[k] = []));
  S.sessions.forEach((s) => {
    sessionExercises(s).forEach((ex) => {
      if (!ex.lift) return;
      let best = 0;
      (s.entries[ex.id] || []).forEach(({ w: wt, r }) => { if (wt && r) best = Math.max(best, epley(wt, Math.min(r, 10))); });
      if (best) liftSeries[ex.lift].push({ date: s.date, v: best });
    });
  });

  // рабочие веса: откуда берётся вилка и куда она едет
  const histAll = movementHistory();
  const LIFTS = ["squat", "bench", "deadlift", "ohp"];
  const keys = [
    ...LIFTS.filter((k) => histAll[k]),
    ...Object.keys(histAll).filter((k) => !LIFTS.includes(k)).sort((a, b) => histAll[b].length - histAll[a].length),
  ];
  const anCards = limitCardsView({ keys });

  app.innerHTML = progressView({ anCards });
  mountWeightCard(document.getElementById("weight-card"));

  const charts = document.getElementById("charts");
  Object.entries(liftSeries).forEach(([k, arr]) => {
    const base = BASELINES[k];
    const pts = [{ date: "база", v: base }, ...arr];
    const last = pts[pts.length - 1].v;
    const d = last - base;
    const card = document.createElement("div");
    card.className = "panel chart-card";
    card.innerHTML = liftCardView({ arr, d, k, last, pts });
    charts.appendChild(card);
  });

  const log = document.getElementById("log");
  const rows = [...S.sessions].reverse().slice(0, 20);
  log.innerHTML = sessionLogView({ rows });
  log.querySelectorAll(".log-row").forEach((r) => r.onclick = () => showSessionDetail(r.dataset.sid));
}
