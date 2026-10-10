// Контроллер экрана профиля.
import { ACH_BY_ID, TIERS, summary as achSummary } from "../../data/achievements.js";
import { showAchievementDetail, showAllAchievements } from "./overlays.js";
import { render, setTheme } from "./router.js";
import { fmtTonn, plural3 } from "../core/format.js";
import { sessionTonnage, weekStreak } from "../model/achievements.js";
import { heroStats } from "../model/hero.js";
import { S, save } from "../model/store.js";
import { initSync, onServerState, serverState } from "../model/server.js";
import { cloudState, onCloudState } from "../model/sync.js";
import { AVIS, themeNow } from "../model/theme.js";
import { invalidateE1RM } from "../model/training.js";
import { app, overlayRoot } from "../view/dom.js";
import { fxChime, fxTap, haptic } from "../view/fx.js";
import { bodyweightEditorView, profileView, syncNoteText } from "../view/profile.js";
import { goalsPanelView } from "../view/onboarding.js";
import { openProfileWizard } from "./onboarding.js";
import { openNutritionPlan } from "./nutplan.js";
import { profile, targetsFor } from "../model/profile.js";

/* ================= ПРОФИЛЬ ================= */
export function renderProfile() {
  const h = heroStats();
  const ring = 2 * Math.PI * 52;
  const bw = S.hero.bodyweight;

  const c = h.cls;
  const achievements = S.achievements || {};
  const achSum = achSummary(achievements, themeNow());
  // полученные знаки: старшие ранги первыми, внутри ранга — свежие
  const earnedList = AVIS().filter((a) => achievements[a.id])
    .sort((a, b) => (TIERS[b.tier].rank - TIERS[a.tier].rank) || ((achievements[b.id].last || "").localeCompare(achievements[a.id].last || "")));
  // Уровень, опыт, класс и характеристики — это язык «Саги». В «Чистой» вместо них
  // три числа, которые атлету действительно нужны: сколько тренировок, сколько
  // поднято и сколько недель подряд без пропусков.
  const summary = themeNow() === "plain" ? (() => {
    let lifetime = 0; S.sessions.forEach((x) => (lifetime += sessionTonnage(x)));
    const n = S.sessions.length;
    const word = (v, a, b, c) => plural3(v, a, b, c).replace(/^\S+\s/, "");   // нужно слово без числа
    return [
      [n, word(n, "тренировка", "тренировки", "тренировок")],
      [fmtTonn(lifetime), "поднято"],
      [weekStreak(S.sessions, 3).streak, "нед. подряд"],
    ];
  })() : null;

  const serverOn = () => !["off", "denied", "full"].includes(serverState);
  app.innerHTML = profileView({ achSum, achievements, bw, c, earnedList, h, summary, ring, serverOn: serverOn(),
    goals: goalsPanelView({ p: profile(), tTrain: targetsFor("training"), tRest: targetsFor("rest") }) });
  document.getElementById("goals-edit").onclick = () => { fxTap(); openProfileWizard({ editing: !!profile() }); };
  const gNut = document.getElementById("goals-nut");
  if (gNut) gNut.onclick = () => { fxTap(); openNutritionPlan(); };

  // Вес героя меняется: от него считаются подтягивания, брусья и гиперэкстензия —
  // там рабочий вес это довесок к своему, и устаревшие 93 кг врут в каждом подходе
  document.getElementById("edit-bw").onclick = () => {
    fxTap();
    const o = document.createElement("div");
    o.className = "overlay portion-overlay";
    o.innerHTML = bodyweightEditorView();
    overlayRoot.appendChild(o);
    const inp = o.querySelector("#bw-in");
    o.querySelectorAll("[data-bw]").forEach((b) => b.onclick = () => {
      inp.value = Math.max(30, Math.min(250, (parseFloat(inp.value.replace(",", ".")) || 0) + Number(b.dataset.bw)));
    });
    const commit = () => {
      const v = parseFloat(String(inp.value).replace(",", ".")) || 0;
      if (v < 30 || v > 250) { inp.focus(); return; }
      S.hero.bodyweight = Math.round(v * 10) / 10;
      invalidateE1RM(); save(); o.remove(); fxChime(); renderProfile();
    };
    o.querySelector("#bw-save").onclick = commit;
    inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } };
    o.querySelector("#bw-close").onclick = () => o.remove();
    o.addEventListener("click", (e) => { if (e.target === o) o.remove(); });
  };
  app.querySelectorAll("[data-theme-pick]").forEach((b) => b.onclick = () => { fxTap(); setTheme(b.dataset.themePick); });
  document.getElementById("tg-sound").onclick = () => { S.settings.sound = !S.settings.sound; if (S.settings.sound) fxTap(); save(); render(); };
  document.getElementById("tg-haptics").onclick = () => { S.settings.haptics = !S.settings.haptics; if (S.settings.haptics) haptic(15); save(); render(); };
  document.getElementById("tg-off").onclick = () => { S.settings.offSearch = !S.settings.offSearch; fxTap(); save(); render(); };
  app.querySelectorAll(".status-badge").forEach((b) => b.onclick = () => showAchievementDetail(ACH_BY_ID[b.dataset.ach]));
  document.getElementById("ach-all").onclick = showAllAchievements;

  // живой статус синхронизации в шапке блока аккаунта: сервер, если он есть, иначе облако Telegram
  const syncBadge = document.getElementById("sync-badge");
  if (syncBadge) {
    const TXT = {
      idle: "ожидает", saving: "сохраняю…", saved: "синхронизировано", off: "только на устройстве",
      error: "ошибка облака", serverError: "ошибка сервера", offline: "нет сети · сохранено здесь",
      denied: "нет доступа к серверу", expired: "переоткройте приложение", full: "сервер занят · журнал здесь",
    };
    const paint = () => {
      const st = serverState !== "off" ? serverState : cloudState;
      syncBadge.textContent = (st === "error" && serverState !== "off" ? TXT.serverError : TXT[st]) || st;
      syncBadge.className = `badge ${st === "saved" ? "b-vol" : (["error", "expired"].includes(st) ? "b-load" : "b-dim")}`;
      const note = document.getElementById("sync-note");
      if (note) note.textContent = syncNoteText(serverOn());
    };
    paint();
    const offCloud = onCloudState(paint), offServer = onServerState(paint);
    app.addEventListener("view-change", () => { offCloud(); offServer(); }, { once: true });
  }
  const syncBtn = document.getElementById("btn-sync");
  if (syncBtn) syncBtn.onclick = async () => { fxTap(); await initSync(); renderProfile(); };
}
