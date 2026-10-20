// Контроллер раздела «Растяжка»: главная программы и экран тренировки A или B.
import { PELVIC_DAILY, STRETCH, STRETCH_ORDER, STRETCH_TESTS, STRETCH_WEEKS, stretchItems, videoUrl } from "../../data/stretch.js";
import { showInfo } from "./overlays.js";
import { startRest } from "./rest.js";
import { render, setBack, setCycleSub, setView, withLoader } from "./router.js";
import { doneThisWeek, finishStretch, isTestWeek, marksOf, saveTest, stretchClash, stretchNow, testResults, testValueNow, toggleMark } from "../model/stretch.js";
import { T } from "../model/settings.js";
import { nextWorkoutId, workoutOf } from "../model/training.js";
import { openExternal } from "../telegram.js";
import { app } from "../view/dom.js";
import { fxChime, fxTap } from "../view/fx.js";
import { pelvicHelpView, stretchDoneText, stretchHelpView, stretchHomeView, stretchWorkoutView, testInputView } from "../view/stretch.js";

let openWid = null;    // какая тренировка открыта: null — главная программы
let openItem = null;   // какое упражнение раскрыто (подсказки и видео)

const keepScroll = (fn) => { const y = window.scrollY; fn(); window.scrollTo(0, y); };

/** Вход в раздел: с экрана тренировок. */
export function renderStretch() {
  setCycleSub("stretch");
  if (openWid && STRETCH[openWid]) renderStretchWorkout(); else renderStretchHome();
}

function leaveStretch() {
  setCycleSub(null); openWid = null; openItem = null;
  withLoader(() => { setView("cycle"); render(); });
}

function renderStretchHome() {
  const st = stretchNow();
  const wk = STRETCH_WEEKS[st.week - 1];
  const done = doneThisWeek(st);
  const workouts = STRETCH_ORDER.map((id) => ({ ...STRETCH[id], count: stretchItems(id).length, marked: marksOf(id).size }));
  const clash = stretchClash(workoutOf(nextWorkoutId()));
  app.innerHTML = stretchHomeView({ st, wk, done, workouts, clash, pf: PELVIC_DAILY[st.week - 1],
    testsNow: isTestWeek(st.week), results: testResults(st) });

  setBack(leaveStretch);
  document.getElementById("back").onclick = leaveStretch;
  document.getElementById("sx-help").onclick = () => showInfo({ title: T("stretch"), eyebrow: "программа",
    body: stretchHelpView({ timingA: STRETCH.A.timing, timingB: STRETCH.B.timing }) });
  document.getElementById("sx-pf-help").onclick = () => showInfo({ title: "Тазовое дно", eyebrow: "как выполнять", body: pelvicHelpView() });
  app.querySelectorAll("[data-sw]").forEach((b) => b.onclick = () => withLoader(() => {
    openWid = b.dataset.sw; openItem = null; renderStretchWorkout();
  }));
  app.querySelectorAll("[data-test]").forEach((b) => b.onclick = () => openTest(b.dataset.test));
}

function openTest(id) {
  const t = STRETCH_TESTS.find((x) => x.id === id);
  if (!t) return;
  let value = testValueNow(id);
  if (value == null) value = t.def;
  const o = showInfo({ title: t.name, eyebrow: "тест", body: testInputView({ t, value }) });
  o.querySelector("#info-close").textContent = "Отмена";
  const out = o.querySelector("#sx-val");
  const step = (d) => { value = Math.min(t.max, Math.max(t.min, value + d)); out.textContent = value; fxTap(); };
  o.querySelector("#sx-minus").onclick = () => step(-t.step);
  o.querySelector("#sx-plus").onclick = () => step(t.step);
  o.querySelector("#sx-save").onclick = () => { saveTest(id, value); o.remove(); fxChime(); keepScroll(renderStretchHome); };
}

function renderStretchWorkout() {
  const st = stretchNow();
  const w = STRETCH[openWid];
  app.innerHTML = stretchWorkoutView({ w, week: st.week, marks: marksOf(openWid), open: openItem });

  const back = () => { openWid = null; openItem = null; withLoader(renderStretchHome); };
  setBack(back);
  document.getElementById("back").onclick = back;

  const item = (id) => stretchItems(openWid).find((x) => x.id === id);
  app.querySelectorAll("[data-mark]").forEach((b) => b.onclick = () => {
    toggleMark(openWid, b.dataset.mark); fxTap(); keepScroll(renderStretchWorkout);
  });
  app.querySelectorAll("[data-open]").forEach((b) => b.onclick = () => {
    openItem = openItem === b.dataset.open ? null : b.dataset.open; fxTap(); keepScroll(renderStretchWorkout);
  });
  app.querySelectorAll("[data-hold]").forEach((b) => b.onclick = () => {
    const x = item(b.dataset.hold);
    const sec = x && x.sec ? x.sec[st.week - 1] : 0;
    if (sec) startRest(sec, "", { label: "Поза", remind: false });
  });
  app.querySelectorAll("[data-video]").forEach((b) => b.onclick = () => {
    const x = item(b.dataset.video);
    if (x && x.video) openExternal(videoUrl(x.video));
  });
  document.getElementById("sx-finish").onclick = () => {
    const prevCycle = st.cycle;
    const res = finishStretch(openWid);
    if (!res) return;
    fxChime();
    openWid = null; openItem = null;
    withLoader(() => {
      renderStretchHome();
      const text = stretchDoneText({ res, wk: STRETCH_WEEKS[res.week - 1], newCycle: res.cycle !== prevCycle });
      if (text) showInfo({ title: "Растяжка сделана", eyebrow: "итог", body: text });
    });
  };
}
