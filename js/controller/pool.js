// Контроллер «Арсенала движений».
import { EXERCISES, MUSCLES, MUSCLE_ORDER, searchExercises } from "../../data/exercises.js";
import { PROGRAM, muscleTrend, weekOfId, weeklyCoverage } from "../../data/program.js";
import { showExerciseDetail, showInfo, showMethod } from "./overlays.js";
import { render, setBack, setCycleSub, setView, withLoader } from "./router.js";
import { S } from "../model/store.js";
import { L } from "../model/theme.js";
import { nextWorkoutId } from "../model/training.js";
import { app } from "../view/dom.js";
import { fxTap } from "../view/fx.js";
import { poolHelpView, poolView } from "../view/pool.js";

export let poolFilter = "";

export const poolOpen = new Set();   // какие группы мышц раскрыты в арсенале

export let bodyPick = null;          // мышца, выбранная на карте тела

export let bodyWeek = null;          // какая неделя цикла показана на карте

/** Карта мышц: две фигуры, цвет — частота, насыщенность — объём, тап — подробности. */

export function renderPool() {
  setCycleSub("pool");
  // при первом заходе карта показывает неделю, в которой лежит следующий квест
  if (!bodyWeek) bodyWeek = weekOfId(nextWorkoutId()) || PROGRAM.weeks[0].n;
  const week = PROGRAM.weeks.find((w) => w.n === bodyWeek) || PROGRAM.weeks[0];
  const q = poolFilter.trim().toLowerCase();
  // поиск идёт по всей странице: и по движениям, и по приёмам интенсивности
  const found = bodyPick ? EXERCISES.filter((e) => e.group === bodyPick) : searchExercises(q);
  const groups = MUSCLE_ORDER.map((g) => ({ g, list: found.filter((e) => e.group === g) })).filter((x) => x.list.length);
  const cov = weeklyCoverage(week, S.plan || {});
  // объём выбранной мышцы по всем неделям: видно, в какой именно она проседает,
  // без перещёлкивания четырёх кнопок подряд
  const trend = bodyPick ? muscleTrend(bodyPick, S.plan || {}) : [];
  const trendTop = Math.max(1, ...trend.map((t) => t.sets));
  // карта остаётся на экране, пока мышца выбрана с фигуры: иначе тап по ней прячет саму фигуру
  const showMap = !q || !!bodyPick;

  app.innerHTML = poolView({ bodyPick, bodyWeek, cov, found, groups, poolFilter, poolOpen, q, showMap, trend, trendTop });

  document.getElementById("pool-help").onclick = () => showInfo({
    title: L("pool"), eyebrow: "как читать",
    body: poolHelpView(),
  });

  const leavePool = () => { setCycleSub(null); bodyPick = null; poolFilter = ""; withLoader(() => { setView("cycle"); render(); }); };
  setBack(leavePool);
  document.getElementById("back").onclick = leavePool;

  app.querySelectorAll(".wk, .tr").forEach((b) => b.onclick = () => {
    bodyWeek = Number(b.dataset.wk); fxTap();
    const y = window.scrollY; renderPool(); window.scrollTo(0, y);
  });

  const qi = document.getElementById("pool-q");
  qi.oninput = () => { poolFilter = qi.value; bodyPick = null; const at = qi.selectionStart; renderPool(); const n = document.getElementById("pool-q"); n.focus(); n.setSelectionRange(at, at); };
  const clearBtn = document.getElementById("pool-clear");
  if (clearBtn) clearBtn.onclick = () => { poolFilter = ""; bodyPick = null; fxTap(); renderPool(); document.getElementById("pool-q").focus(); };

  // карта тела: тап по мышце — её частота и объём за неделю
  app.querySelectorAll(".bm-m").forEach((g) => {
    // тап по мышце не только показывает цифры, но и оставляет в списке её движения
    const pick = () => {
      const same = bodyPick === g.dataset.g;
      bodyPick = same ? null : g.dataset.g;
      poolFilter = same ? "" : MUSCLES[bodyPick];
      fxTap();
      const y = window.scrollY; renderPool(); window.scrollTo(0, y);
    };
    g.onclick = pick;
    g.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } };
  });

  app.querySelectorAll(".pool-row").forEach((b) => b.onclick = () => showExerciseDetail(b.dataset.ex));
  app.querySelectorAll("[data-method]").forEach((b) => b.onclick = () => showMethod(b.dataset.method));
  app.querySelectorAll(".pool-toggle").forEach((b) => b.onclick = () => {
    const g = b.dataset.g;
    if (poolOpen.has(g)) poolOpen.delete(g); else poolOpen.add(g);
    fxTap();
    const y = window.scrollY; renderPool(); window.scrollTo(0, y);
  });
}
