// Контроллер экрана цикла (список квестов).
import { PROGRAM, tonnageTrend, weekOfId } from "../../data/program.js";
import { showInfo, showSessionDetail } from "./overlays.js";
import { renderPool } from "./pool.js";
import { render, withLoader } from "./router.js";
import { renderWorkout } from "./workout.js";
import { ORDER } from "../model/catalog.js";
import { S, save } from "../model/store.js";
import { nextWorkoutId } from "../model/training.js";
import { app } from "../view/dom.js";
import { fxTap } from "../view/fx.js";
import { cycleHelpView, cycleView } from "../view/cycle.js";

export let pickStart = false; // режим выбора стартового квеста цикла

// какие недели развёрнуты. По умолчанию — только текущая: остальные 9 квестов
// на экране не нужны, а листать из-за них весь цикл приходилось каждый раз
export let weekOpen = null;

export function renderCycle() {
  const nextId = nextWorkoutId();
  // первый заход: раскрыта неделя со следующим квестом
  if (!weekOpen) weekOpen = new Set([weekOfId(nextId) || PROGRAM.weeks[0].n]);
  const startId = ORDER[(((S.cycleStart || 0) % ORDER.length) + ORDER.length) % ORDER.length];
  const LOAD_TXT = { low: "лёгкий", mid: "средний", high: "тяжёлый" };
  // сколько реально поднято за неделю — то единственное число, в котором видно
  // «я себя перегружаю» раньше, чем это почувствуют колени
  const TONN = {};
  tonnageTrend(S.sessions, { bodyweight: S.hero.bodyweight || 90 }).forEach((t) => (TONN[t.n] = t));
  app.innerHTML = cycleView({ LOAD_TXT, TONN, nextId, pickStart, startId, weekOpen });

  document.getElementById("pick-start").onclick = () => { pickStart = !pickStart; fxTap(); renderCycle(); };
  app.querySelectorAll(".week-head").forEach((h) => h.onclick = () => {
    const n = Number(h.dataset.week);
    if (weekOpen.has(n)) weekOpen.delete(n); else weekOpen.add(n);
    fxTap(); renderCycle();
  });

  // следующий квест — то, зачем сюда зашли: если он не виден, подводим его к глазам
  const nextCard = app.querySelector(".wcard.next");
  if (nextCard && !pickStart) {
    const r = nextCard.getBoundingClientRect();
    if (r.bottom > window.innerHeight) nextCard.scrollIntoView({ block: "center", behavior: "auto" });
  }
  document.getElementById("cycle-help").onclick = () => showInfo({
    title: PROGRAM.cycleName, eyebrow: "как устроен цикл",
    body: cycleHelpView(),
  });
  document.getElementById("open-pool").onclick = () => withLoader(() => renderPool());

  app.querySelectorAll(".wcard").forEach((c) => c.addEventListener("click", () => withLoader(() => renderWorkout(c.dataset.w))));
  app.querySelectorAll(".verdict-chip.clickable").forEach((ch) => ch.addEventListener("click", (e) => { e.stopPropagation(); showSessionDetail(ch.dataset.sid); }));
  app.querySelectorAll(".wflag").forEach((f) => f.addEventListener("click", (e) => {
    e.stopPropagation();
    const i = +f.dataset.i;
    S.cycleStart = (S.cycleStart === i) ? 0 : i; // повторное нажатие — сбросить на первый
    pickStart = false;
    fxTap(); save(); render();
  }));
}
