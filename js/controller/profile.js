// Контроллер экрана профиля.
import { ACH_BY_ID, TIERS, summary as achSummary } from "../../data/achievements.js";
import { showAchievementDetail, showAllAchievements } from "./overlays.js";
import { render, setTheme } from "./router.js";
import { fmt, fmtTonn, plural3 } from "../core/format.js";
import { achievementCards, sessionTonnage, weekStreak } from "../model/achievements.js";
import { heroStats } from "../model/hero.js";
import { S, save } from "../model/store.js";
import { initSync, onServerState, serverState } from "../model/server.js";
import { cloudState, onCloudState } from "../model/sync.js";
import { themeNow } from "../model/theme.js";
import { app } from "../view/dom.js";
import { fxTap, haptic } from "../view/fx.js";
import { myDataView, profileCardView, profileView, remindPanelView, syncNoteText } from "../view/profile.js";
import { ACTIVITY, DIRECTIONS, EXPERIENCE, PACES, PROGRAMS, SEXES } from "../../data/profile.js";
import { tgAvatar, tgUserHandle } from "../telegram.js";
import { TIMED_SLOTS } from "../../data/reminders.js";
import { reminders, slotTime } from "../model/reminders.js";
import { changeSlotTime, remindersAvailable, toggleReminder } from "./reminders.js";
import { openWeightSheet } from "./body.js";
import { goalsPanelView } from "../view/onboarding.js";
import { openProfileWizard } from "./onboarding.js";
import { openNutritionPlan } from "./nutplan.js";
import { currentWeight, profile, targetsFor } from "../model/profile.js";

/* ================= ПРОФИЛЬ ================= */
export function renderProfile() {
  const h = heroStats();
  const ring = 2 * Math.PI * 52;
  const bw = currentWeight();

  const c = h.cls;
  const achSum = achSummary(S.achievements || {}, themeNow());
  // полученные — по карточке на серию, свежие первыми
  const earnedList = achievementCards().filter((c) => c.got).sort((a, b) => b.last.localeCompare(a.last) || (TIERS[b.shown.tier].rank - TIERS[a.shown.tier].rank));
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
  const rc = reminders();
  const remind = remindPanelView({ conf: rc, available: remindersAvailable(), times: TIMED_SLOTS.map((slot) => ({ slot, at: slotTime(slot) })) });
  const p = profile();
  const tTrain = targetsFor("training"), tRest = targetsFor("rest");
  const age = p ? new Date().getFullYear() - p.birthYear : null;
  const handle = tgUserHandle();
  const me = {
    name: S.hero.name, photo: tgAvatar(),
    handle: handle && handle !== S.hero.name ? handle : null,
    chips: [`${fmt(bw)} кг`, p && `${p.height} см`, age && `${age} лет`, p && DIRECTIONS[p.direction] && DIRECTIONS[p.direction].name].filter(Boolean),
  };
  const pace = p && PACES[p.direction] ? (PACES[p.direction].find((x) => x.id === p.pace) || {}).name : null;
  const myData = myDataView([
    { id: "edit-bw", icon: "weight-scale", label: "Вес", sub: "история и тренд — на «Прогрессе»", value: `${fmt(bw)} кг` },
    ...(p ? [
      { step: "about", icon: "stairs", label: "Рост, возраст, пол", value: `${p.height} см · ${age} · ${(SEXES[p.sex] || "").slice(0, 3).toLowerCase()}` },
      { step: "goal", icon: "on-target", label: "Цель", value: `${DIRECTIONS[p.direction].name}${pace ? ` · ${pace.toLowerCase()}` : ""}` },
      { step: "food", icon: "cutlery", label: "Питание", sub: ACTIVITY[p.activity].name.toLowerCase(), value: PROGRAMS[p.program].name },
      { step: "training", icon: "biceps", label: "Опыт в зале", value: EXPERIENCE[p.experience] ? EXPERIENCE[p.experience].name : "—" },
    ] : []),
  ]);
  app.innerHTML = profileView({ achSum, c, earnedList, h, summary, ring, serverOn: serverOn(), remind,
    card: profileCardView({ me, cells: summary }), myData,
    goals: goalsPanelView({ p, tTrain, tRest }) });
  const edit = (opts = {}) => { fxTap(); openProfileWizard({ editing: !!profile(), ...opts }); };
  const gEdit = document.getElementById("goals-edit");   // есть, пока профиль не заполнен
  if (gEdit) gEdit.onclick = () => edit();
  document.getElementById("pf-edit").onclick = () => edit();
  app.querySelectorAll(".pf-row[data-step]").forEach((b) => b.onclick = () => edit({ step: b.dataset.step }));
  const gNut = document.getElementById("goals-nut");
  if (gNut) gNut.onclick = () => { fxTap(); openNutritionPlan(); };
  // фото не загрузилось (нет сети, Телеграм не отдал) — остаются инициалы
  const photo = app.querySelector(".pf-photo");
  if (photo) photo.onerror = () => photo.remove();

  // Вес меняется: от него считаются нормы питания, подтягивания, брусья и гиперэкстензия.
  // Запись идёт в историю взвешиваний — график и тренд на вкладке «Прогресс».
  document.getElementById("edit-bw").onclick = () => { fxTap(); openWeightSheet(() => renderProfile()); };
  app.querySelectorAll("[data-theme-pick]").forEach((b) => b.onclick = () => { fxTap(); setTheme(b.dataset.themePick); });
  document.getElementById("tg-sound").onclick = () => { S.settings.sound = !S.settings.sound; if (S.settings.sound) fxTap(); save(); render(); };
  document.getElementById("tg-haptics").onclick = () => { S.settings.haptics = !S.settings.haptics; if (S.settings.haptics) haptic(15); save(); render(); };
  ["rest", "supp"].forEach((k) => { const b = document.getElementById(`rm-${k}`); if (b) b.onclick = () => { fxTap(); toggleReminder(k, () => renderProfile()); }; });
  app.querySelectorAll(".rm-time input").forEach((inp) => inp.onchange = () => changeSlotTime(inp.dataset.slot, inp.value));
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
