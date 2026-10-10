// Вид: buffs. Только разметка: данные приходят готовыми из контроллера.
import { BUFFS, BUFF_CATS, BUFF_CHECK_DAYS, BUFF_SLOTS, DATALIST_SUPPS, LOW_STOCK_DAYS, allBuffs, buffTimes, doseStr, stockDaysLeft } from "../model/buffs.js";
import { S } from "../model/store.js";
import { BN, BSub, L, themeNow } from "../model/theme.js";
import { runeSVG } from "./components.js";
import { icon } from "./icons.js";

export function buffsView({ activeBuffs, arsenal, checklist, lowAlert, reminder, stockCards, taken, total }) {
  return `
    ${L("buffsNote") ? `<p class="dim small" style="margin-top:2px">${L("buffsNote")}</p>` : ""}
    ${reminder}${lowAlert}

    <div class="rune-divider">${runeSVG}</div>
    <div class="ds-toph">
      <span class="eyebrow">Приём сегодня · ${taken}/${total}</span>
      ${total ? `<button class="ds-allday" id="ds-allday">${taken >= total ? "снять всё" : "принять всё"}</button>` : ""}
    </div>
    <div class="dose-prog"><i style="width:${total ? Math.round(taken / total * 100) : 0}%"></i></div>
    <div id="checklist">${checklist}</div>

    ${activeBuffs.length ? `<div class="rune-divider">${runeSVG}</div>
    <div class="eyebrow" style="margin-bottom:6px">Запасы · ${activeBuffs.length}</div>
    <div id="stock">${stockCards}</div>` : ""}

    <div class="rune-divider">${runeSVG}</div>
    ${themeNow() === "plain"
      // Каталог — справочник, в который заглядывают раз в месяц, а занимает он
      // две трети экрана. Прячем под раскрытие: ежедневный экран — это приём и запасы.
      ? `<details class="cat-fold">
           <summary><span class="eyebrow">${L("stockHead")}</span><span class="cat-count dim small">${BUFFS.length}</span></summary>
           ${arsenal}
         </details>`
      : `<div class="eyebrow" style="margin-bottom:2px">${L("stockHead")}</div>
         ${L("stockHint") ? `<p class="dim small" style="margin-bottom:8px">${L("stockHint")}</p>` : ""}
         ${arsenal}`}
    <button class="btn-ghost buff-add-btn" id="buff-add" style="margin-top:12px">${L("buffAdd")}</button>`;
}

export function doseInputView({ b, id }) {
  return `<input class="dose-input mono" inputmode="decimal" value="${S.buffs.active[id] ?? ""}" aria-label="доза" /><span class="dose-unit">${b.unit || ""}</span>`;
}

export function buffEditorView({ b, editing, preview, times }) {
  return `
    <div class="portion-card buff-editor">
      <div class="eyebrow">${editing ? L("buffEdit") : L("buffNew")}</div>
      <div class="be-preview"><span class="medallion" id="be-medal">${icon(preview.icon)}</span>
        <div><div class="be-pname display" id="be-pname">${preview.name || "…"}</div>
        <button class="be-reroll" id="be-reroll">↻ другой облик</button></div></div>
      <div class="be-field"><label>Что за добавка</label>
        <input id="be-real" list="supp-list" value="${(b.real || "").replace(/"/g, "&quot;")}" placeholder="напр. Креатин, Магний, Омега-3…" autocomplete="off" />
        <datalist id="supp-list">${DATALIST_SUPPS.map((s) => `<option value="${s}"></option>`).join("")}</datalist>
      </div>
      <div class="be-row">
        <div class="be-field"><label>Доза</label><div class="dose-field"><input id="be-dose" inputmode="decimal" value="${b.dose != null ? b.dose : ""}" placeholder="5" /><span class="dose-unit" id="be-unit">${preview.unit}</span></div></div>
        <div class="be-field"><label>Категория</label><select id="be-cat">${BUFF_CATS.map((c) => `<option ${c === preview.cat ? "selected" : ""}>${c}</option>`).join("")}</select></div>
      </div>
      <div class="be-field"><label>Эффект (необязательно)</label><input id="be-effect" value="${(b.effect || "").replace(/"/g, "&quot;")}" placeholder="подставится автоматически" /></div>
      <div class="be-field"><label>Когда принимать</label><div class="slot-pick" id="be-slots">${BUFF_SLOTS.map((sl) => `<button class="slot-chip ${times.has(sl) ? "on" : ""}" data-sl="${sl}">${sl}</button>`).join("")}</div></div>
      <div class="be-field"><label>Запас, порций (необязательно)</label><input id="be-stock" inputmode="numeric" value="${(S.buffs.stock && b.id && typeof S.buffs.stock[b.id] === "number") ? S.buffs.stock[b.id] : ""}" placeholder="напр. 60" /></div>
      <div class="portion-actions">
        ${editing ? `<button class="btn-ghost" id="be-del">Удалить</button>` : `<button class="btn-ghost" id="be-cancel">Отмена</button>`}
        <button class="finish-btn" id="be-save" style="margin-top:0">${editing ? "Сохранить" : "Добавить"}</button>
      </div>
      ${editing ? `<button class="btn-ghost" id="be-cancel" style="margin-top:10px">Отмена</button>` : ""}
    </div>`;
}

export function doseChecklistView({ active, bySlot, cur, dayLog, slotsWith }) {
  return slotsWith.length
    ? slotsWith.map((sl) => {
        const items = bySlot[sl];
        const allDone = items.every((b) => dayLog[`${b.id}@${sl}`]);
        return `<div class="dose-slot ${sl === cur ? "now" : ""}">
          <div class="ds-head">
            <span class="ds-name">${sl}${sl === cur ? ' <span class="ds-now">сейчас</span>' : ""}</span>
            <button class="ds-all" data-slot="${sl}">${allDone ? "снять всё" : "принять всё"}</button>
          </div>
          ${items.map((b) => {
            const on = !!dayLog[`${b.id}@${sl}`];
            return `<button class="dose-item ${on ? "done" : ""}" data-take="${b.id}@${sl}">
              <span class="di-check">${on ? "✓" : ""}</span>
              <span class="di-body">
                <span class="di-top"><span class="di-name">${BN(b)}</span><span class="di-dose mono">${doseStr(b, active[b.id])}</span></span>
                ${(() => { const sub = [BSub(b), themeNow() === "plain" ? "" : (b.hint ? `<span class="di-hint">💡 ${b.hint}</span>` : "")].filter(Boolean).join(" · "); return sub ? `<span class="di-sub dim small">${sub}</span>` : ""; })()}
              </span>
            </button>`;
          }).join("")}
        </div>`;
      }).join("")
    : `<div class="empty">Активных баффов нет. Добавь их из Арсенала ниже — и здесь появится план приёма на день.</div>`;
}

export function stockCardsView({ active, activeBuffs }) {
  return activeBuffs.length
    ? activeBuffs.map((b) => {
        const serv = S.buffs.stock[b.id];
        const dleft = stockDaysLeft(b);
        const low = dleft != null && dleft <= LOW_STOCK_DAYS;
        const stockLine = (typeof serv === "number")
          ? `<span class="st-days ${low ? "low" : ""}">осталось ${serv} порц.${dleft != null ? ` · ~${dleft} дн.` : ""}</span>`
          : `<span class="dim small">запас не задан</span>`;
        return `<div class="stock-card ${low ? "low" : ""}" data-id="${b.id}">
          <span class="medallion">${icon(b.icon)}</span>
          <span class="buff-body">
            <span class="buff-top"><b class="buff-name">${BN(b)}</b><button class="buff-dose edit mono" data-dose="${b.id}">${doseStr(b, active[b.id])} ✎</button></span>
            <span class="st-line">${stockLine} · <button class="st-set" data-stock="${b.id}">${typeof serv === "number" ? "пополнить" : "задать запас"}</button></span>
          </span>
          <button class="buff-toggle off" data-remove="${b.id}" title=L("buffOff") aria-label=L("buffOff")>✕</button>
        </div>`;
      }).join("")
    : "";
}

export function buffCatalogView({ active, cats }) {
  return cats.map((cat) => {
    const items = allBuffs().filter((b) => b.cat === cat);
    if (!items.length) return "";
    return `<div class="buff-cat">
      <div class="week-tag" style="margin:14px 0 4px"><span class="dot"></span> ${cat}</div>
      ${items.map((b) => {
        const on = active[b.id] != null;
        const custom = String(b.id).startsWith("cust");
        return `<div class="buff arsenal ${on ? "on" : ""}" data-id="${b.id}">
          <span class="medallion">${icon(b.icon)}</span>
          <span class="buff-body">
            <span class="buff-top"><b class="buff-name">${BN(b)}${custom ? ' <span class="buff-mine">своё</span>' : ""}</b><span class="buff-dose mono dim">${doseStr(b)}</span></span>
            <span class="buff-real dim small">${[BSub(b), b.effect, buffTimes(b).join(", ")].filter(Boolean).join(" · ")}</span>
          </span>
          ${custom ? `<button class="buff-edit" data-edit="${b.id}" aria-label="Редактировать">✎</button>` : ""}
          <button class="buff-toggle ${on ? "off" : "add"}" aria-label="${on ? "Снять" : "Активировать"}">${on ? "✓" : "+"}</button>
        </div>`;
      }).join("")}
    </div>`;
  }).join("");
}

export function buffReminderView({ days, due }) {
  return due
    ? `<div class="buff-reminder due">
         <div class="br-ico">${icon("hourglass")}</div>
         <div class="br-body"><b>${L("buffDue")}</b><span class="dim small">${days === null ? L("buffNever") : `Прошло ${days} дн. с последней сверки.`}${themeNow() === "plain" ? "" : " Что заканчивается, что обновить."}</span></div>
         <button class="br-ok" id="buff-check">Сверено</button>
       </div>`
    : `<div class="buff-reminder ok">
         <div class="br-ico">${icon("shield")}</div>
         <div class="br-body"><b>${L("buffOk")}</b><span class="dim small">Следующая проверка через ${BUFF_CHECK_DAYS - days} дн.</span></div>
       </div>`;
}

export function lowStockView({ lowList }) {
  return lowList.length
    ? `<div class="buff-reminder due" style="margin-top:10px">
         <div class="br-ico">${icon("flask")}</div>
         <div class="br-body"><b>Скоро закончится</b><span class="dim small">${lowList.map((b) => `${BN(b)} (~${stockDaysLeft(b)} дн.)`).join(", ")}</span></div>
       </div>` : "";
}
