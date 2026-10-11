// Вид: страница «Настройки» — оформление, экран, язык, звук, данные, напоминания, аккаунт.
// Только разметка: значения приходят готовыми из контроллера.
import { LANGS, LANG_ORDER, THEME_EN } from "../../data/i18n.js";
import { THEMES, THEME_ORDER } from "../../data/theme.js";
import { esc } from "../core/format.js";
import { BRIGHT, SIZE_ORDER, T } from "../model/settings.js";
import { blockHead } from "./components.js";
import { icon } from "./icons.js";

const BACK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4l-8 8 8 8V4z"/></svg>';
const toggle = (id, on, title, sub = "", disabled = false) => `
  <button class="toggle-row" id="${id}" aria-pressed="${!!on}" ${disabled ? "disabled" : ""}>
    <span>${title}${sub ? `<span class="dim small" style="display:block">${sub}</span>` : ""}</span>
    <span class="tg ${on ? "on" : ""}"><i></i></span>
  </button>`;
const seg = (group, items, cur, label) => `
  <div class="st-seg" role="group" aria-label="${label}">
    ${items.map(([id, name]) => `<button class="st-seg-b ${id === cur ? "on" : ""}" data-${group}="${id}" aria-pressed="${id === cur}">${name}</button>`).join("")}
  </div>`;
const slider = (id, label, value, min, max, step, unit) => `
  <label class="st-slider">
    <span class="st-sl-top"><span>${label}</span><b class="mono" id="${id}-val">${value}${unit}</b></span>
    <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label}" />
  </label>`;

/** Текст статуса синхронизации: сервер, облако Telegram или только телефон. */
export const syncNoteText = (serverOn) => T(serverOn ? "syncServer" : "syncCloud");

export function settingsView({ theme, lang, bright, size, volume, sound, haptics, offSearch, remind, account }) {
  const themeName = (id) => (lang === "en" && THEME_EN[id] ? THEME_EN[id].name : THEMES[id].name);
  const themeNote = (id) => (lang === "en" && THEME_EN[id] ? THEME_EN[id].note : THEMES[id].note);
  return `
    <div class="qstack">
      <div class="qhead">
        <button class="icon-btn" id="back" aria-label="${T("back")}">${BACK}</button>
        <h2 class="qhead-title display">${T("settings")}</h2>
      </div>
    </div>

    <section class="panel st-sec" aria-label="${T("look")}">
      ${blockHead(T("look"))}
      <div class="theme-pick">
        ${THEME_ORDER.map((id) => `
          <button class="theme-card ${id === theme ? "on" : ""}" data-theme-pick="${id}" aria-pressed="${id === theme}">
            <span class="theme-swatch">${THEMES[id].swatch.map((c) => `<i style="background:${c}"></i>`).join("")}</span>
            <span class="theme-name">${themeName(id)}</span>
            <span class="theme-note dim small">${themeNote(id)}</span>
          </button>`).join("")}
      </div>
    </section>

    <section class="panel st-sec" aria-label="${T("screen")}">
      ${blockHead(T("screen"))}
      ${slider("st-bright", T("brightness"), bright, BRIGHT.min, BRIGHT.max, 5, "%")}
      <div class="st-field"><span class="st-l">${T("uiSize")}</span>
        ${seg("size", SIZE_ORDER.map((k) => [k, `<span class="st-aa st-aa-${k}">Aa</span><i>${T(`size${k.toUpperCase()}`)}</i>`]), size, T("uiSize"))}
      </div>
    </section>

    <section class="panel st-sec" aria-label="${T("language")}">
      ${blockHead(T("language"))}
      ${seg("lang", LANG_ORDER.map((k) => [k, LANGS[k]]), lang, T("language"))}
      ${lang === "en" ? `<p class="dim small st-note">${T("langBeta")}</p>` : ""}
    </section>

    <section class="panel st-sec" aria-label="${T("sound")}">
      ${blockHead(T("sound"))}
      ${slider("st-volume", T("volume"), volume, 0, 100, 5, "%")}
      <button class="btn-ghost st-test" id="st-volume-test">${icon("stopwatch")}<span>${T("volumeTest")}</span></button>
      ${toggle("tg-sound", sound, T("uiSound"))}
      ${toggle("tg-haptics", haptics, T("haptics"))}
    </section>

    <section class="panel st-sec" aria-label="${T("data")}">
      ${blockHead(T("data"))}
      ${toggle("tg-off", offSearch, T("offSearch"))}
    </section>

    ${remind}
    ${account}`;
}

/** Напоминания в Telegram: о начале подхода и о приёме добавок. */
export function remindPanelView({ conf, available, times }) {
  return `
    <section class="panel st-sec remind-panel" aria-label="${T("reminders")}">
      ${blockHead(T("reminders"))}
      ${available ? "" : `<p class="dim small" style="margin:0 0 8px">${T("remindersOff")}</p>`}
      ${toggle("rm-rest", !!conf.rest, T("remindRest"), "", !available)}
      ${toggle("rm-supp", !!conf.supp, T("remindSupp"), "", !available)}
      ${conf.supp ? `<div class="rm-times">${times.map((t) => `<label class="rm-time"><span>${esc(t.slot)}</span><input type="time" data-slot="${esc(t.slot)}" value="${esc(t.at)}" step="300" /></label>`).join("")}</div>` : ""}
    </section>`;
}

/** Аккаунт Telegram: кто вошёл и где лежит журнал. */
export function accountView({ name, handle, serverOn }) {
  return `
    <section class="panel st-sec" aria-label="${T("account")}">
      ${blockHead(T("account"), `<span class="badge b-dim" id="sync-badge">${T("syncing")}</span>`)}
      <div class="kv"><span>${esc(name || T("hero"))}</span><span class="dim mono">${esc(handle || "")}</span></div>
      <div class="dim small" id="sync-note" style="margin-top:6px">${syncNoteText(serverOn)}</div>
      <button class="btn-ghost" id="btn-sync" style="margin-top:12px">${T("syncNow")}</button>
    </section>`;
}
