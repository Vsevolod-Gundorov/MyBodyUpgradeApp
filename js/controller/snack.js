// Плашка внизу экрана: что сделано и «Отменить». Гаснет сама через 5 секунд.
import { snackView } from "../view/resources.js";

let timer = null;
export function showSnack(text, onUndo = null, ms = 5000) {
  let el = document.getElementById("snack");
  if (!el) { el = document.createElement("div"); el.id = "snack"; el.className = "snack"; el.setAttribute("role", "status"); document.body.appendChild(el); }
  el.innerHTML = snackView(text, !!onUndo);
  el.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => (el.hidden = true), ms);
  const undo = el.querySelector("#snack-undo");
  if (undo) undo.onclick = () => { clearTimeout(timer); el.hidden = true; onUndo(); };
}
