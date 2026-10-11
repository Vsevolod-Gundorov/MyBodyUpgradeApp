// Контроллер страницы «Настройки»: оформление, экран, язык, звук, данные,
// напоминания в Telegram и аккаунт. Открывается шестерёнкой из профиля.
import { TIMED_SLOTS } from "../../data/reminders.js";
import { initSync, onServerState, serverState } from "../model/server.js";
import { reminders, slotTime } from "../model/reminders.js";
import { brightnessNow, langNow, setBrightness, setLang, setSize, setVolume, sizeNow, T, volumeNow } from "../model/settings.js";
import { S, save } from "../model/store.js";
import { cloudState, onCloudState } from "../model/sync.js";
import { themeNow } from "../model/theme.js";
import { inTelegram, tgUserHandle, tgUserName } from "../telegram.js";
import { app } from "../view/dom.js";
import { fxChime, fxTap, haptic } from "../view/fx.js";
import { accountView, remindPanelView, settingsView, syncNoteText } from "../view/settings.js";
import { changeSlotTime, remindersAvailable, toggleReminder } from "./reminders.js";
import { applyDisplay, render, setBack, setProfileSub, setTheme } from "./router.js";

const serverOn = () => !["off", "denied", "full"].includes(serverState);

export function renderSettings() {
  const conf = reminders();
  app.innerHTML = settingsView({
    theme: themeNow(), lang: langNow(), bright: brightnessNow(), size: sizeNow(), volume: volumeNow(),
    sound: !!(S.settings && S.settings.sound), haptics: !!(S.settings && S.settings.haptics), offSearch: !!(S.settings && S.settings.offSearch),
    remind: remindPanelView({ conf, available: remindersAvailable(), times: TIMED_SLOTS.map((slot) => ({ slot, at: slotTime(slot) })) }),
    account: inTelegram ? accountView({ name: tgUserName(), handle: tgUserHandle(), serverOn: serverOn() }) : "",
  });

  const leave = () => { setProfileSub(null); render(); };
  setBack(leave);
  document.getElementById("back").onclick = () => { fxTap(); leave(); };
  const keep = (fn) => { const y = window.scrollY; fn(); window.scrollTo(0, y); };

  // оформление
  app.querySelectorAll("[data-theme-pick]").forEach((b) => b.onclick = () => { fxTap(); keep(() => setTheme(b.dataset.themePick)); });

  // экран: яркость видна сразу, пока тянешь ползунок; размер и язык перерисовывают экран
  const bright = document.getElementById("st-bright");
  bright.oninput = () => { setBrightness(bright.value); applyDisplay(); document.getElementById("st-bright-val").textContent = `${brightnessNow()}%`; };
  app.querySelectorAll("[data-size]").forEach((b) => b.onclick = () => { fxTap(); setSize(b.dataset.size); applyDisplay(); keep(renderSettings); });
  app.querySelectorAll("[data-lang]").forEach((b) => b.onclick = () => { fxTap(); setLang(b.dataset.lang); applyDisplay(); keep(render); });

  // звук: громкость сигналов и проверка — тот же сигнал, что звучит в конце отдыха
  const vol = document.getElementById("st-volume");
  vol.oninput = () => { setVolume(vol.value); document.getElementById("st-volume-val").textContent = `${volumeNow()}%`; };
  vol.onchange = () => fxChime();
  document.getElementById("st-volume-test").onclick = () => fxChime();
  document.getElementById("tg-sound").onclick = () => { S.settings.sound = !S.settings.sound; if (S.settings.sound) fxTap(); save(); keep(renderSettings); };
  document.getElementById("tg-haptics").onclick = () => { S.settings.haptics = !S.settings.haptics; if (S.settings.haptics) haptic(15); save(); keep(renderSettings); };
  document.getElementById("tg-off").onclick = () => { S.settings.offSearch = !S.settings.offSearch; fxTap(); save(); keep(renderSettings); };

  // напоминания в Telegram
  ["rest", "supp"].forEach((k) => { const b = document.getElementById(`rm-${k}`); if (b) b.onclick = () => { fxTap(); toggleReminder(k, () => keep(renderSettings)); }; });
  app.querySelectorAll(".rm-time input").forEach((inp) => inp.onchange = () => changeSlotTime(inp.dataset.slot, inp.value));

  // аккаунт: живой статус синхронизации — сервер, если он есть, иначе облако Telegram
  const badge = document.getElementById("sync-badge");
  if (badge) {
    const paint = () => {
      const st = serverState !== "off" ? serverState : cloudState;
      const key = st === "error" && serverState !== "off" ? "serverError" : st;
      const txt = T(`st_${key}`);
      badge.textContent = txt === `st_${key}` ? st : txt;
      badge.className = `badge ${st === "saved" ? "b-vol" : (["error", "expired"].includes(st) ? "b-load" : "b-dim")}`;
      const note = document.getElementById("sync-note");
      if (note) note.textContent = syncNoteText(serverOn());
    };
    paint();
    const offCloud = onCloudState(paint), offServer = onServerState(paint);
    app.addEventListener("view-change", () => { offCloud(); offServer(); }, { once: true });
  }
  const syncBtn = document.getElementById("btn-sync");
  if (syncBtn) syncBtn.onclick = async () => { fxTap(); await initSync(); if (document.getElementById("btn-sync")) keep(renderSettings); };
}
