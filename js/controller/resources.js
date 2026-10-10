// Контроллер экрана питания: день, сводка, вода, приёмы пищи.
// Добавление и порции — в controller/foods.js.
import { NUTRITION } from "../../data/nutrition.js";
import { openFoodSheet, openPortion } from "./foods.js";
import { render } from "./router.js";
import { addDays, today } from "../core/format.js";
import { checkAchievements } from "../model/achievements.js";
import { foodOfItem, mealByTime } from "../model/foods.js";
import { drinkWaterOf, nutDay, nutRead, nutTotals } from "../model/nutrition.js";
import { save } from "../model/store.js";
import { L, themeNow } from "../model/theme.js";
import { app } from "../view/dom.js";
import { dayTipView, extrasView, mealsView, resourcesView, summaryView, weekStripView } from "../view/resources.js";

export let resDate = null;               // выбранный день (по умолчанию сегодня)

export const curResDate = () => resDate || today();

export function renderResources() {
  const date = curResDate();
  const isToday = date === today();
  const day = nutRead(date);
  const T = NUTRITION.dayTypes[day.dayType];
  const tot = nutTotals(day);

  // В «Саге» под сводкой — вердикт дня, в «Чистой» только цифры
  let verdict = null;
  if (themeNow() !== "plain") {
    const core = [[tot.k, T.kcal], [tot.p, T.protein], [tot.cb, T.carbs], [tot.f, T.fat]];
    const readiness = Math.round(100 * core.reduce((a, [c, t]) => a + Math.min(1, c / t), 0) / core.length);
    const kcalPct = tot.k / T.kcal;
    if (readiness >= 90 && tot.p >= T.protein * 0.95 && kcalPct >= 0.9 && kcalPct <= 1.1) verdict = { cls: "verdict-gold", text: L("nGold") };
    else if (readiness >= 55) verdict = { cls: "verdict-mid", text: L("nMid") };
    else verdict = { cls: "verdict-fail", text: L("nFail") };
  }

  // вода = стаканы вручную + вода из напитков дня
  const drinkWater = Math.round(drinkWaterOf(day));
  const totalWater = day.water + drinkWater;

  // календарь: 7 дней. Окно оканчивается сегодня, либо выбранным днём, если он раньше.
  const winEnd = (date <= today() && date > addDays(today(), -6)) ? today() : date;

  app.innerHTML = resourcesView({
    date, isToday,
    strip: weekStripView({ date, winEnd }),
    summary: summaryView({ T, tot, dayType: day.dayType, verdict }),
    extras: extrasView({ fb: tot.fb, fbTgt: NUTRITION.constants.fiber[0], totalWater, drinkWater }),
    meals: mealsView({ day, isToday }),
    tip: dayTipView({ T, day }),
  });

  // навигация по дням
  document.getElementById("day-prev").onclick = () => { resDate = addDays(date, -1); render(); };
  const nextBtn = document.getElementById("day-next");
  if (nextBtn && !nextBtn.disabled) nextBtn.onclick = () => { if (date < today()) { resDate = addDays(date, 1); render(); } };
  const todayBtn = document.getElementById("day-today");
  if (todayBtn) todayBtn.onclick = () => { resDate = today(); render(); };
  app.querySelectorAll(".cday").forEach((b) => { if (!b.disabled) b.onclick = () => { resDate = b.dataset.d; render(); }; });

  // тип дня и вода — в постоянную запись выбранного дня
  app.querySelectorAll(".dt").forEach((b) => b.onclick = () => { nutDay(date).dayType = b.dataset.dt; save(); render(); checkAchievements({ type: "nutrition" }); });
  document.getElementById("water-plus").onclick = () => { nutDay(date).water += 250; save(); render(); checkAchievements({ type: "nutrition" }); };
  document.getElementById("water-minus").onclick = () => { const d = nutDay(date); d.water = Math.max(0, d.water - 250); save(); render(); };

  // «+» у приёма пищи — экран добавления сразу в этот приём
  app.querySelectorAll(".mh-add").forEach((b) => b.onclick = () => openFoodSheet(date, b.dataset.add));
  // касание записи — изменить порцию, приём пищи или удалить
  app.querySelectorAll(".meal-item").forEach((b) => b.onclick = () => {
    const i = +b.dataset.i;
    const it = nutRead(date).items[i];
    if (!it) return;
    openPortion(foodOfItem(it), date, { editIndex: i, meal: it.meal || mealByTime(), amt: it.amt != null ? it.amt : it.g, unit: it.unit || "г" });
  });
}
