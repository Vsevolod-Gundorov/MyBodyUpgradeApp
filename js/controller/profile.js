// Контроллер экрана профиля: карточка атлета, мои данные, питание за сегодня, достижения.
// Оформление, звук, напоминания и аккаунт — на отдельной странице «Настройки».
import { ACH_BY_ID, TIERS, summary as achSummary } from "../../data/achievements.js";
import { ENUM_EN } from "../../data/i18n.js";
import { ACTIVITY, DIRECTIONS, EXPERIENCE, PACES, PROGRAMS, SEXES } from "../../data/profile.js";
import { showAchievementDetail, showAllAchievements } from "./overlays.js";
import { render, setProfileSub, setView, withLoader } from "./router.js";
import { fmt, today } from "../core/format.js";
import { achievementCards } from "../model/achievements.js";
import { avatarNow, refreshAvatar } from "../model/avatar.js";
import { heroStats } from "../model/hero.js";
import { nutRead, nutTotals } from "../model/nutrition.js";
import { currentWeight, profile, targetsFor } from "../model/profile.js";
import { langNow, T } from "../model/settings.js";
import { S } from "../model/store.js";
import { themeNow } from "../model/theme.js";
import { tgUserHandle } from "../telegram.js";
import { app } from "../view/dom.js";
import { fxTap } from "../view/fx.js";
import { goalsPanelView } from "../view/onboarding.js";
import { myDataView, nutritionBlockView, profileCardView, profileView } from "../view/profile.js";
import { openWeightSheet } from "./body.js";
import { openProfileWizard } from "./onboarding.js";
import { openNutritionPlan } from "./nutplan.js";

/** Название из профиля на текущем языке: русское — из data/profile.js, английское — из data/i18n.js. */
const nameOf = (group, id, ru) => (langNow() === "en" && ENUM_EN[group] && ENUM_EN[group][id]) || ru || "—";

/* ================= ПРОФИЛЬ ================= */
export function renderProfile() {
  const h = heroStats();
  const ring = 2 * Math.PI * 52;
  const bw = currentWeight();
  const c = h.cls;
  const achSum = achSummary(S.achievements || {}, themeNow());
  // полученные — по карточке на серию, свежие первыми
  const earnedList = achievementCards().filter((c) => c.got).sort((a, b) => b.last.localeCompare(a.last) || (TIERS[b.shown.tier].rank - TIERS[a.shown.tier].rank));

  const p = profile();
  const age = p ? new Date().getFullYear() - p.birthYear : null;
  const handle = tgUserHandle();
  const dir = p ? nameOf("direction", p.direction, DIRECTIONS[p.direction] && DIRECTIONS[p.direction].name) : null;
  const me = {
    name: S.hero.name, photo: avatarNow(),
    handle: handle && handle !== S.hero.name ? handle : null,
    chips: [`${fmt(bw)} ${T("kg")}`, p && `${p.height} ${T("cm")}`, age && `${age} ${T("years")}`, dir].filter(Boolean),
  };
  const pace = p && PACES[p.direction] ? (PACES[p.direction].find((x) => x.id === p.pace) || null) : null;
  const myData = myDataView([
    { id: "edit-bw", icon: "weight-scale", label: T("weight"), value: `${fmt(bw)} ${T("kg")}` },
    ...(p ? [
      { step: "about", icon: "stairs", label: T("body"), value: `${p.height} ${T("cm")} · ${age} · ${nameOf("sex", p.sex, (SEXES[p.sex] || "").slice(0, 3).toLowerCase())}` },
      { step: "goal", icon: "on-target", label: T("goal"), value: `${dir}${pace ? ` · ${nameOf("pace", pace.id, pace.name.toLowerCase())}` : ""}` },
      { step: "food", icon: "cutlery", label: T("food"), value: nameOf("program", p.program, PROGRAMS[p.program].name) },
      { step: "activity", icon: "footprint", label: T("activity"), value: nameOf("activity", p.activity, ACTIVITY[p.activity].name.toLowerCase()) },
      { step: "training", icon: "biceps", label: T("experience"), value: nameOf("experience", p.experience, EXPERIENCE[p.experience] && EXPERIENCE[p.experience].name) },
    ] : []),
  ]);

  // питание: нормы обоих дней, а у сегодняшнего — сколько уже съедено
  const tTrain = targetsFor("training"), tRest = targetsFor("rest");
  const day = nutRead(today());
  const tot = nutTotals(day);
  const nutrition = p
    ? nutritionBlockView({
      days: ["training", "rest"].map((key) => ({ key, T: key === "training" ? tTrain : tRest, tot: day.dayType === key ? tot : null })),
      manual: tTrain.manual || tRest.manual,
    })
    : goalsPanelView({ p, tTrain, tRest });

  app.innerHTML = profileView({ achSum, c, earnedList, h, ring, saga: themeNow() !== "plain",
    card: profileCardView({ me }), myData, nutrition });
  const edit = (opts = {}) => { fxTap(); openProfileWizard({ editing: !!profile(), ...opts }); };
  const gEdit = document.getElementById("goals-edit");   // есть, пока профиль не заполнен
  if (gEdit) gEdit.onclick = () => edit();
  document.getElementById("pf-edit").onclick = () => edit();
  app.querySelectorAll(".pf-row[data-step]").forEach((b) => b.onclick = () => edit({ step: b.dataset.step }));
  // фото не загрузилось (нет сети, Телеграм не отдал) — остаются инициалы
  const photo = app.querySelector(".pf-photo");
  if (photo) photo.onerror = () => photo.remove();
  document.getElementById("pf-settings").onclick = () => { fxTap(); withLoader(() => { setProfileSub("settings"); render(); }); };
  const gNut = document.getElementById("goals-nut");
  if (gNut) gNut.onclick = () => { fxTap(); openNutritionPlan(); };
  // тап по питанию — на вкладку «Питание», на сегодняшний день
  const nutOpen = document.getElementById("pf-nut-open");
  if (nutOpen) nutOpen.onclick = () => { fxTap(); withLoader(() => { setView("resources"); render(); }); };

  // Вес меняется: от него считаются нормы питания, подтягивания, брусья и гиперэкстензия.
  // Запись идёт в историю взвешиваний — график и тренд на вкладке «Прогресс».
  document.getElementById("edit-bw").onclick = () => { fxTap(); openWeightSheet(() => renderProfile()); };
  app.querySelectorAll(".status-badge").forEach((b) => b.onclick = () => showAchievementDetail(ACH_BY_ID[b.dataset.ach]));
  document.getElementById("ach-all").onclick = showAllAchievements;
  // фото пришло от бота позже — перерисуем, если профиль ещё на экране
  refreshAvatar({ onChange: () => { if (document.getElementById("pf-edit")) renderProfile(); } });
}
