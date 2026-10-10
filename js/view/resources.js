// Вид: resources. Только разметка: данные приходят готовыми из контроллера.
import { NUTRITION, WATER_TARGET_ML } from "../../data/nutrition.js";
import { WD, addDays, dateLabel, fmt, today } from "../core/format.js";
import { gaugeState, itemWaterMl } from "../model/nutrition.js";
import { S } from "../model/store.js";
import { L, themeNow } from "../model/theme.js";
import { NUT_ACCENT, NUT_GRAD, NUT_ICON, runeSVG } from "./components.js";
import { icon } from "./icons.js";

export function resourcesView({ T, date, day, drinkWater, gaugeHTML, isToday, itemsHTML, readiness, ring, strip, tip, totalWater, vCls, vTxt, waterCups, waterPct }) {
  return `
    <div class="daynav">
      <button class="dn-arrow" id="day-prev" aria-label="Прошлый день"><svg viewBox="0 0 24 24"><path d="M15 4l-8 8 8 8V4z"/></svg></button>
      <div class="dn-label">${dateLabel(date)}${isToday ? ' <span class="dn-today">сегодня</span>' : ""}</div>
      <button class="dn-arrow" id="day-next" aria-label="Следующий день" ${isToday ? "disabled" : ""}><svg viewBox="0 0 24 24"><path d="M9 4l8 8-8 8V4z"/></svg></button>
    </div>
    <div class="weekstrip">${strip}</div>
    ${!isToday ? `<button class="today-btn" id="day-today">← Вернуться в сегодня</button>` : ""}

    <div class="daytype-toggle">
      <button class="dt ${day.dayType === "training" ? "on" : ""}" data-dt="training">${icon("hammer")} Тренировочный</button>
      <button class="dt ${day.dayType === "rest" ? "on" : ""}" data-dt="rest">${icon("moon")} Отдых</button>
    </div>

    <div class="panel panel--ornate fuel-panel">
      <div class="level-ring fuel-ring">
        <svg viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(201,169,97,.15)" stroke-width="5"/>
          <circle cx="60" cy="60" r="52" fill="none" stroke="#c9a961" stroke-width="5"
            stroke-linecap="round" stroke-dasharray="${ring}" stroke-dashoffset="${ring * (1 - readiness / 100)}"/>
        </svg>
        <div class="lvl"><b>${readiness}%</b><span>${L("ration")}</span></div>
      </div>
      ${themeNow() === "plain" ? "" : `<div class="fuel-verdict ${vCls}">${vTxt}</div>`}
      <div class="dim small mono">${T.label} · цель ${T.kcal} ккал · Б ${T.protein} · Ж ${T.fat} · У ${T.carbs}</div>
    </div>

    <div class="gauges">${gaugeHTML}</div>

    <div class="panel water-panel">
      <div class="g-top">
        <span class="g-name" style="color:#7fc7d6">${icon("droplet")}<b>Вода</b></span>
        <span class="g-val mono">${(totalWater / 1000).toFixed(2)}<span class="g-tgt"> / ${(WATER_TARGET_ML / 1000).toFixed(1)} л</span></span>
      </div>
      <div class="g-bar"><i class="water" style="width:${waterPct.toFixed(0)}%"></i></div>
      <div class="water-breakdown mono dim small">${waterCups} стак. × 250 мл${drinkWater ? ` <span class="wb-drink">+ ${drinkWater} мл из напитков</span>` : ""}</div>
      <div class="water-ctl">
        <button class="wbtn" id="water-minus" aria-label="Убрать стакан">− стакан</button>
        <button class="wbtn wbtn-add" id="water-plus" aria-label="Добавить стакан">+ стакан</button>
      </div>
    </div>

    ${tip}

    <div class="rune-divider">${runeSVG}</div>

    <div class="eyebrow" style="margin-bottom:6px">Добавить провизию</div>
    <div class="food-search">
      <input id="food-q" type="search" inputmode="search" placeholder="Найди продукт — курица, кофе, кола…" autocomplete="off" />
    </div>
    <div id="food-results"></div>

    <div class="rune-divider">${runeSVG}</div>
    <div class="eyebrow" style="margin-bottom:6px">${isToday ? "Съедено сегодня" : "Съедено в этот день"} · ${day.items.length}</div>
    <div id="meal-log">${itemsHTML}</div>`;
}

export function portionView({ editing, food, per, startAmt, unit }) {
  return `
    <div class="portion-card">
      <div class="eyebrow">${editing ? "Изменить порцию" : "Порция"}</div>
      <div class="portion-name display">${food.n}</div>
      <div class="dim small mono portion-per100">${per.k} ккал · Б ${fmt(per.p)} · Ж ${fmt(per.f)} · У ${fmt(per.cb)}${per.fb ? ` · клет ${fmt(per.fb)}` : ""} на 100 г</div>

      <div class="unit-toggle" role="group" aria-label="Единица измерения">
        <button class="ut" data-u="г">Граммы</button>
        <button class="ut" data-u="мл">Миллилитры</button>
      </div>

      <div class="stepper">
        <button class="stp" id="p-minus" aria-label="Меньше">−</button>
        <div class="stp-mid"><input id="portion-g" inputmode="decimal" value="${startAmt}" aria-label="количество" /><span class="stp-unit" id="p-unit">${unit}</span></div>
        <button class="stp" id="p-plus" aria-label="Больше">+</button>
      </div>

      <div class="portion-chips" id="p-chips"></div>
      <div class="portion-preview" id="p-preview"></div>

      <div class="portion-actions">
        <button class="btn-ghost" id="portion-cancel">Отмена</button>
        <button class="finish-btn" id="portion-add" style="margin-top:0">${editing ? "Сохранить" : "Добавить"}</button>
      </div>
    </div>`;
}

export function portionPreviewView({ m, per, wml }) {
  return `
      <div class="pv"><span class="pv-v mono" style="color:${NUT_ACCENT.kcal}">${Math.round(per.k * m)}</span><span class="pv-l">ккал</span></div>
      <div class="pv"><span class="pv-v mono" style="color:${NUT_ACCENT.protein}">${fmt(per.p * m)}</span><span class="pv-l">белок</span></div>
      <div class="pv"><span class="pv-v mono" style="color:${NUT_ACCENT.carbs}">${fmt(per.cb * m)}</span><span class="pv-l">углев</span></div>
      <div class="pv"><span class="pv-v mono" style="color:${NUT_ACCENT.fat}">${fmt(per.f * m)}</span><span class="pv-l">жиры</span></div>
      <div class="pv"><span class="pv-v mono" style="color:${NUT_ACCENT.fiber}">${fmt(per.fb * m)}</span><span class="pv-l">клетч</span></div>
      ${wml ? `<div class="pv"><span class="pv-v mono" style="color:#7fc7d6">${wml}</span><span class="pv-l">вода, мл</span></div>` : ""}`;
}

export function gaugesView({ gaugeList }) {
  return gaugeList.map((m) => {
    const pct = m.tgt ? m.cur / m.tgt : 0;
    const st = gaugeState(pct, m.floor ? "protein" : m.key);
    const left = Math.round(m.tgt - m.cur);
    const sub = st === "ok" ? "в цель ✓" : (left > 0 ? `осталось ${left} ${m.unit}` : `перебор ${Math.abs(left)} ${m.unit}`);
    return `
      <div class="gauge ${st}">
        <div class="g-top">
          <span class="g-name" style="color:${NUT_ACCENT[m.key]}">${icon(NUT_ICON[m.key])}<b>${m.name}</b></span>
          <span class="g-val mono">${Math.round(m.cur)}<span class="g-tgt"> / ${m.tgt} ${m.unit}</span></span>
        </div>
        <div class="g-bar"><i style="width:${Math.min(100, pct * 100).toFixed(0)}%;background:${NUT_GRAD[m.key]}"></i></div>
        ${themeNow() === "plain" ? "" : `<div class="g-sub mono">${sub}</div>`}
      </div>`;
  }).join("");
}

export function mealsView({ day }) {
  return day.items.length
    ? day.items.map((it, i) => {
        const wml = Math.round(itemWaterMl(it));
        const amt = it.amt != null ? it.amt : it.g;
        const unit = it.unit || "г";
        return `
        <div class="meal-row">
          <button class="meal-main" data-i="${i}" aria-label="Изменить порцию">
            <span class="meal-name">${it.n}</span>
            <span class="meal-portion mono">${fmt(amt)} ${unit}${wml ? `<span class="water-badge">${icon("droplet")}${wml} мл</span>` : ""} <span class="meal-pen">✎</span></span>
          </button>
          <span class="meal-kcal mono">${Math.round(it.k * it.g / 100)} ккал</span>
          <button class="meal-del" data-i="${i}" aria-label="Убрать">✕</button>
        </div>`;
      }).join("")
    : `<div class="empty">${L("foodEmpty")}</div>`;
}

export function dayTipView({ T, day }) {
  return !L("dayTip") ? "" : day.dayType === "training"
    ? `<div class="nut-tip"><span class="dim small">⚔ Тренировочный день · за 2 ч до похода: ${NUTRITION.timing.pre.carbs.join("–")} г углеводов + ${NUTRITION.timing.pre.protein.join("–")} г белка · после: ${NUTRITION.timing.post.carbs.join("–")} г углеводов + ${NUTRITION.timing.post.protein.join("–")} г белка.</span></div>`
    : (L("dayTip") ? `<div class="nut-tip"><span class="dim small">☾ День отдыха · углеводы ровнее по приёмам, ужин легче. Белок держим ${T.protein} г.</span></div>` : "");
}

export function weekStripView({ date, winEnd }) {
  return Array.from({ length: 7 }, (_, i) => addDays(winEnd, -(6 - i))).map((iso) => {
    const d = new Date(iso + "T00:00:00Z");
    const rec = S.nutrition && S.nutrition.log[iso];
    const has = rec && (rec.items.length || rec.water > 0);
    const future = iso > today();
    return `<button class="cday ${iso === date ? "on" : ""} ${future ? "future" : ""}" data-d="${iso}" ${future ? "disabled" : ""}>
      <span class="cw">${WD[d.getUTCDay()]}</span><span class="cn">${d.getUTCDate()}</span>
      <span class="cdot ${has ? "has" : ""}"></span>
    </button>`;
  }).join("");
}

export function foodListView({ foods, note, opts, star }) {
  return (note ? `<div class="dim small" style="padding:4px 2px">${note}</div>` : "") +
      (foods.length ? foods.map((f) => `
        <div class="food-item" data-id="${f.id}">
          <span class="food-body">
            <span class="food-name">${f.n}${star.has(f.id) ? ' <span class="freq-badge">★ часто</span>' : ""}</span>
            <span class="food-macros dim small mono">${f.k} ккал · Б ${fmt(f.p)} · Ж ${fmt(f.f)} · У ${fmt(f.cb)} <span class="per100">/ 100 г</span></span>
          </span>
          <button class="food-add" aria-label="Добавить">+</button>
        </div>`).join("") : `<div class="empty">Ничего не найдено. Попробуй другое слово.</div>`) +
      (opts.moreCount ? `<button class="food-more" id="food-more">Развернуть · ещё ${opts.moreCount}</button>` : "");
}

export function portionChipsView({ chips, unit }) {
  return chips.map((v) => `<button class="pchip" data-g="${v}">${v} ${unit}</button>`).join("");
}
