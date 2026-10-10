// Контроллер: таймер отдыха между подходами.
import { fmtClock } from "../core/format.js";
import { overlayRoot } from "../view/dom.js";
import { fxChime, fxTap, haptic } from "../view/fx.js";
import { restBarView } from "../view/workout.js";

export let restIntervalId = null;       // интервал таймера отдыха (живёт поверх экранов)

export let restState = null;            // { endAt, total, note }

export const timedSets = new WeakSet(); // подходы, для которых отдых уже запускался

export function ensureRestBar() {
  let b = document.getElementById("rest-bar");
  if (!b) {
    b = document.createElement("div");
    b.id = "rest-bar"; b.className = "rest-bar";
    b.innerHTML = restBarView();
    overlayRoot.appendChild(b);
    b.querySelector("#rest-minus").onclick = () => { if (restState) { restState.endAt -= 15000; restState.total = Math.max(15, restState.total - 15); tickRest(); fxTap(); } };
    b.querySelector("#rest-plus").onclick = () => { if (restState) { restState.endAt += 15000; restState.total += 15; tickRest(); fxTap(); } };
    b.querySelector("#rest-skip").onclick = () => stopRest();
  }
  return b;
}

export function startRest(sec, note) {
  restState = { endAt: Date.now() + sec * 1000, total: sec, note: note || "" };
  const b = ensureRestBar(); b.classList.remove("done");
  document.body.classList.add("resting");
  const noteEl = b.querySelector("#rest-note"); if (noteEl) noteEl.textContent = note ? ` · ${note}` : "";
  fxTap();
  clearInterval(restIntervalId);
  restIntervalId = setInterval(tickRest, 250);
  tickRest();
}

export function tickRest() {
  const b = document.getElementById("rest-bar");
  if (!b || !restState) { clearInterval(restIntervalId); return; }
  const rem = (restState.endAt - Date.now()) / 1000;
  if (rem <= 0) { finishRest(); return; }
  b.querySelector("#rest-time").textContent = fmtClock(rem);
  b.querySelector(".rest-prog i").style.width = Math.max(0, Math.min(100, (rem / restState.total) * 100)) + "%";
}

export function finishRest() {
  clearInterval(restIntervalId);
  const b = document.getElementById("rest-bar");
  if (b) {
    b.classList.add("done");
    b.querySelector("#rest-time").textContent = "готово";
    b.querySelector(".rest-prog i").style.width = "0%";
    setTimeout(() => {
      const x = document.getElementById("rest-bar");
      if (x) x.remove();
      document.body.classList.remove("resting");
    }, 1400);
  }
  restState = null;
  fxChime(); haptic([25, 60, 25]);
}

export function stopRest() {
  clearInterval(restIntervalId); restState = null;
  const b = document.getElementById("rest-bar"); if (b) b.remove();
  document.body.classList.remove("resting");
  fxTap();
}

export function stopRestSilent() {
  clearInterval(restIntervalId); restState = null;
  const b = document.getElementById("rest-bar"); if (b) b.remove();
  document.body.classList.remove("resting");
}
