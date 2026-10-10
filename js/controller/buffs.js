// Контроллер экрана добавок.
import { render } from "./router.js";
import { today } from "../core/format.js";
import { checkAchievements } from "../model/achievements.js";
import { BUFF_CATS, BUFF_SLOTS, LOW_STOCK_DAYS, allBuffs, autoBuffFromReal, buffById, buffTimes, buffsDaysSince, buffsDue, currentSlot, guessUnit, stockDaysLeft, toggleTaken } from "../model/buffs.js";
import { S, save } from "../model/store.js";
import { app, overlayRoot } from "../view/dom.js";
import { fxChime, fxTap } from "../view/fx.js";
import { icon } from "../view/icons.js";
import { buffCatalogView, buffEditorView, buffRemindRowView, buffReminderView, buffsView, doseChecklistView, doseInputView, lowStockView, stockCardsView } from "../view/buffs.js";
import { reminders, syncReminders } from "../model/reminders.js";
import { remindersAvailable, toggleReminder } from "./reminders.js";

export function renderBuffs() {
  if (!S.buffs.log) S.buffs.log = {}; if (!S.buffs.stock) S.buffs.stock = {};
  const active = S.buffs?.active || {};
  const activeBuffs = allBuffs().filter((b) => active[b.id] != null);
  const days = buffsDaysSince();
  const due = buffsDue();
  const date = today();
  const dayLog = S.buffs.log[date] || {};
  const cur = currentSlot();

  // ---- чек-лист приёма по слотам ----
  const bySlot = {}; BUFF_SLOTS.forEach((sl) => (bySlot[sl] = []));
  activeBuffs.forEach((b) => buffTimes(b).forEach((sl) => { (bySlot[sl] ||= []).push(b); }));
  const slotsWith = BUFF_SLOTS.filter((sl) => bySlot[sl] && bySlot[sl].length);
  let total = 0, taken = 0;
  slotsWith.forEach((sl) => bySlot[sl].forEach((b) => { total++; if (dayLog[`${b.id}@${sl}`]) taken++; }));

  const checklist = doseChecklistView({ active, bySlot, cur, dayLog, slotsWith });

  // ---- запасы ----
  const lowList = activeBuffs.filter((b) => { const d = stockDaysLeft(b); return d != null && d <= LOW_STOCK_DAYS; });
  const stockCards = stockCardsView({ active, activeBuffs });

  // ---- арсенал ----
  const cats = [...BUFF_CATS];
  allBuffs().forEach((b) => { if (b.cat && !cats.includes(b.cat)) cats.push(b.cat); });
  const arsenal = buffCatalogView({ active, cats });

  const reminder = buffReminderView({ days, due });

  const lowAlert = lowStockView({ lowList });

  const remindRow = activeBuffs.length ? buffRemindRowView({ on: !!reminders().supp, available: remindersAvailable() }) : "";
  app.innerHTML = buffsView({ activeBuffs, arsenal, checklist, lowAlert, reminder, stockCards, taken, total, remindRow });
  const rm = document.getElementById("buff-remind");
  if (rm) rm.onclick = () => { fxTap(); toggleReminder("supp", render); };
  // состав добавок или доза поменялись — расписание напоминаний тоже (с паузой, без лишних запросов)
  if (reminders().supp) syncReminders();

  const check = document.getElementById("buff-check");
  if (check) check.onclick = () => { S.buffs.checkedAt = today(); fxTap(); save(); render(); };

  // отметки приёма
  app.querySelectorAll(".dose-item").forEach((el) => el.onclick = () => {
    const [id, sl] = el.dataset.take.split("@");
    toggleTaken(id, sl); fxTap(); save(); render(); checkAchievements({ type: "buffs" });
  });
  app.querySelectorAll(".ds-all").forEach((btn) => btn.onclick = () => {
    const sl = btn.dataset.slot;
    const items = bySlot[sl] || [];
    const allDone = items.every((b) => dayLog[`${b.id}@${sl}`]);
    items.forEach((b) => toggleTaken(b.id, sl, !allDone));
    fxTap(); save(); render(); checkAchievements({ type: "buffs" });
  });
  const allday = document.getElementById("ds-allday");
  if (allday) allday.onclick = () => {
    const on = taken < total;
    slotsWith.forEach((sl) => bySlot[sl].forEach((b) => toggleTaken(b.id, sl, on)));
    if (on) fxChime(); else fxTap();
    save(); render(); checkAchievements({ type: "buffs" });
  };

  // запасы: доза и пополнение
  app.querySelectorAll(".buff-dose.edit").forEach((b) => b.onclick = (e) => { e.stopPropagation(); editActiveDose(b, b.dataset.dose); });
  app.querySelectorAll(".st-set").forEach((b) => b.onclick = (e) => { e.stopPropagation(); editStock(b, b.dataset.stock); });
  app.querySelectorAll("[data-remove]").forEach((b) => b.onclick = (e) => {
    e.stopPropagation();
    delete S.buffs.active[b.dataset.remove]; save(); render();
  });

  // арсенал
  document.getElementById("buff-add").onclick = () => openBuffEditor(null);
  app.querySelectorAll(".buff-edit").forEach((b) => b.onclick = (e) => { e.stopPropagation(); openBuffEditor((S.buffs.custom || []).find((x) => x.id === b.dataset.edit)); });
  app.querySelectorAll(".buff.arsenal[data-id]").forEach((el) => {
    const id = el.dataset.id;
    const toggle = el.querySelector(".buff-toggle");
    if (toggle) toggle.onclick = (e) => {
      e.stopPropagation();
      if (active[id] != null) delete S.buffs.active[id];
      else S.buffs.active[id] = (buffById(id) || {}).dose ?? 1;
      save(); render();
    };
  });
}

// инлайновое редактирование дозы (число; единица — из баффа)
export function editActiveDose(btn, id) {
  const b = buffById(id) || { unit: "" };
  const wrap = document.createElement("span");
  wrap.className = "dose-edit-wrap";
  wrap.innerHTML = doseInputView({ b, id });
  btn.replaceWith(wrap);
  const inp = wrap.querySelector("input");
  inp.focus(); inp.select();
  const commit = () => { const v = parseFloat((inp.value + "").replace(",", ".")); if (!isNaN(v) && v > 0) S.buffs.active[id] = v; save(); render(); };
  inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } if (e.key === "Escape") render(); };
  inp.onblur = commit;
}

// инлайновая правка запаса (порций)
export function editStock(btn, id) {
  const inp = document.createElement("input");
  inp.className = "dose-input mono"; inp.inputMode = "numeric";
  inp.value = (typeof S.buffs.stock[id] === "number") ? S.buffs.stock[id] : "";
  inp.placeholder = "порц."; inp.setAttribute("aria-label", "осталось порций");
  btn.replaceWith(inp);
  inp.focus(); inp.select();
  const commit = () => { const v = parseInt(inp.value, 10); if (!isNaN(v) && v >= 0) S.buffs.stock[id] = v; save(); render(); };
  inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } if (e.key === "Escape") render(); };
  inp.onblur = commit;
}

// форма своего баффа: пользователь вводит реальную добавку, система подбирает имя/иконку
export function openBuffEditor(buff) {
  const editing = !!buff;
  const b = buff || {};
  let offset = 0;
  let preview = editing
    ? { name: b.name, icon: b.icon, unit: b.unit || guessUnit(b.real || ""), cat: b.cat, effect: b.effect, times: buffTimes(b), hint: b.hint || "" }
    : autoBuffFromReal("", 0);
  let times = new Set(preview.times);
  let manualCat = false;

  const o = document.createElement("div");
  o.className = "overlay portion-overlay";
  o.innerHTML = buffEditorView({ b, editing, preview, times });
  overlayRoot.appendChild(o);

  const realIn = o.querySelector("#be-real");
  const unitEl = o.querySelector("#be-unit");
  const catSel = o.querySelector("#be-cat");
  const effIn = o.querySelector("#be-effect");
  const applyPreview = () => {
    o.querySelector("#be-medal").innerHTML = icon(preview.icon);
    o.querySelector("#be-pname").textContent = preview.name || "…";
    unitEl.textContent = preview.unit;
  };
  const recompute = (fromReal) => {
    preview = autoBuffFromReal(realIn.value, offset);
    if (!manualCat) catSel.value = preview.cat;
    if (fromReal) { // подхватываем тайминг и эффект из подбора
      times = new Set(preview.times);
      o.querySelectorAll(".slot-chip").forEach((c) => c.classList.toggle("on", times.has(c.dataset.sl)));
      if (!effIn.value.trim()) effIn.placeholder = preview.effect || "подставится автоматически";
    }
    applyPreview();
  };
  realIn.oninput = () => recompute(true);
  o.querySelector("#be-reroll").onclick = (e) => { e.preventDefault(); offset++; preview = autoBuffFromReal(realIn.value, offset); applyPreview(); fxTap(); };
  catSel.onchange = () => { manualCat = true; };
  o.querySelectorAll(".slot-chip").forEach((c) => c.onclick = () => { const sl = c.dataset.sl; if (times.has(sl)) times.delete(sl); else times.add(sl); c.classList.toggle("on"); fxTap(); });
  o.querySelector("#be-cancel").onclick = () => o.remove();
  const delBtn = o.querySelector("#be-del");
  if (delBtn) delBtn.onclick = () => { S.buffs.custom = (S.buffs.custom || []).filter((x) => x.id !== b.id); delete S.buffs.active[b.id]; delete S.buffs.stock[b.id]; save(); o.remove(); render(); };

  o.querySelector("#be-save").onclick = () => {
    const real = realIn.value.trim();
    if (!real) { realIn.focus(); return; }
    const auto = autoBuffFromReal(real, offset);
    const tl = BUFF_SLOTS.filter((sl) => times.has(sl)); if (!tl.length) tl.push("Утро");
    const dose = parseFloat((o.querySelector("#be-dose").value + "").replace(",", ".")) || auto.dose || 1;
    const rec = {
      id: editing ? b.id : "cust" + Date.now(),
      name: editing && b.real === real ? b.name : preview.name,
      icon: editing && b.real === real ? b.icon : preview.icon,
      real, unit: preview.unit, dose,
      effect: o.querySelector("#be-effect").value.trim() || auto.effect || "",
      cat: catSel.value, times: tl, hint: auto.hint || (editing ? b.hint : "") || "",
    };
    if (!S.buffs.custom) S.buffs.custom = [];
    const i = (S.buffs.custom || []).findIndex((x) => x.id === rec.id);
    if (i >= 0) S.buffs.custom[i] = rec; else S.buffs.custom.push(rec);
    const stk = parseInt(o.querySelector("#be-stock").value, 10);
    if (!isNaN(stk) && stk >= 0) S.buffs.stock[rec.id] = stk;
    save(); o.remove(); render(); checkAchievements({ type: "buffs" });
  };
}
