// Вид: profile. Только разметка: данные приходят готовыми из контроллера.
import { esc } from "../core/format.js";
import { T } from "../model/settings.js";
import { S } from "../model/store.js";
import { AD, AN, L } from "../model/theme.js";
import { NUT_ACCENT, NUT_GRAD, STAT_ACCENT, STAT_GRAD, STAT_ICONS, achMedallion } from "./components.js";
import { icon } from "./icons.js";

const GEAR = '<svg class="ico ico-line" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
const PENCIL = '<svg class="ico ico-line" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>';

/**
 * Аватар: фото из Телеграма поверх инициалов. Адрес уже проверен (safeAvatarUrl);
 * не загрузилось — контроллер снимает картинку, и остаются инициалы.
 */
export function avatarView({ photo, name }) {
  const ini = String(name || "").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  const ok = typeof photo === "string" && /^(https:\/\/|data:image\/(?:jpeg|png|webp);base64,)/.test(photo);
  return `<span class="pf-ava" aria-hidden="true"><span class="pf-ini">${esc(ini)}</span>${ok
    ? `<img class="pf-photo" src="${esc(photo)}" alt="" referrerpolicy="no-referrer" decoding="async" />` : ""}</span>`;
}

/**
 * Карточка атлета: фото, имя, ник и главные цифры тела. Как в профилях лучших
 * фитнес-приложений (Apple Fitness, Strava, Hevy): кто ты — сверху, правка и
 * настройки — в один тап.
 */
export function profileCardView({ me }) {
  return `
    <section class="pf-card" aria-label="${T("editProfile")}">
      <div class="pf-top">
        ${avatarView(me)}
        <div class="pf-id">
          <h1 class="display pf-name hero-name">${esc(me.name)}</h1>
          <div class="pf-handle">${me.handle ? esc(me.handle) : T("athlete")}</div>
        </div>
        <span class="pf-btns">
          <button class="pf-edit" id="pf-edit" aria-label="${T("editProfile")}">${PENCIL}</button>
          <button class="pf-edit" id="pf-settings" aria-label="${T("openSettings")}">${GEAR}</button>
        </span>
      </div>
      ${me.chips.length ? `<div class="pf-chips">${me.chips.map((c) => `<span class="pf-chip">${esc(c)}</span>`).join("")}</div>` : ""}
    </section>`;
}

/** «Мои данные»: список как в настройках iOS — значок, что, сколько, стрелка. Тап — правка ровно этого пункта. */
export function myDataView(rows) {
  return `
    <section class="panel pf-list" aria-label="${T("myData")}">
      <div class="eyebrow pf-list-h">${T("myData")}</div>
      ${rows.map((r) => `
        <button class="pf-row" ${r.id ? `id="${r.id}"` : ""} ${r.step ? `data-step="${r.step}"` : ""}>
          <span class="pf-ico">${icon(r.icon)}</span>
          <span class="pf-l">${esc(r.label)}${r.sub ? `<i>${esc(r.sub)}</i>` : ""}</span>
          <span class="pf-v">${esc(r.value)}</span>
          <span class="pf-chev" aria-hidden="true">›</span>
        </button>`).join("")}
    </section>`;
}

/**
 * Питание в профиле: нормы дня тренировки и дня отдыха — калории крупно, БЖУ столбиком.
 * Сегодняшний день подсвечен и показывает, сколько уже съедено, — как на вкладке «Питание».
 * days: [{ key, on, T: нормы, tot: съедено (только у сегодняшнего) }]
 */
export function nutritionBlockView({ days, manual }) {
  const MAC = [["protein", "p", "steak"], ["fat", "f", "avocado"], ["carbs", "cb", "wheat"]];
  const bar = (cur, tgt, grad) => `<span class="pfn-bar"><i style="width:${Math.min(100, tgt ? (cur / tgt) * 100 : 0).toFixed(0)}%;background:${grad}"></i></span>`;
  const day = (d) => {
    const today = !!d.tot;
    return `
      <div class="pfn-day ${today ? "on" : ""}">
        <div class="pfn-h"><span>${T(d.key === "training" ? "dayTraining" : "dayRest")}</span>${today ? `<i class="pfn-today">${T("today")}</i>` : ""}</div>
        <div class="pfn-kcal">
          <span class="pfn-ico" style="color:${NUT_ACCENT.kcal}">${icon("flame")}</span>
          <b class="mono">${today ? Math.round(d.tot.k) : d.T.kcal}</b>
        </div>
        <div class="pfn-ksub mono">${today ? `/ ${d.T.kcal} ${T("kcal")}` : T("kcal")}</div>
        ${today ? bar(d.tot.k, d.T.kcal, NUT_GRAD.kcal) : ""}
        <div class="pfn-macros">
          ${MAC.map(([k, tk, ic]) => `
            <div class="pfn-m">
              <span class="pfn-ico" style="color:${NUT_ACCENT[k]}">${icon(ic)}</span>
              <span class="pfn-mn">${T(k)}</span>
              <span class="pfn-mv mono">${today ? `${Math.round(d.tot[tk])}<small>/${d.T[k]}</small>` : `${d.T[k]}<i> ${T("g")}</i>`}</span>
              ${today ? bar(d.tot[tk], d.T[k], NUT_GRAD[k]) : ""}
            </div>`).join("")}
        </div>
      </div>`;
  };
  return `
    <section class="panel pf-nut" aria-label="${T("nutTitle")}">
      <div class="pfn-head">
        <span class="eyebrow">${T("nutTitle")}</span>
        <button class="pf-sq" id="goals-nut" aria-label="${T("nutEdit")}">${PENCIL}</button>
      </div>
      <button class="pfn-body" id="pf-nut-open" aria-label="${T("nutOpen")}">${days.map(day).join("")}</button>
      ${manual ? `<div class="dim small pfn-note">${T("manualNorms")}</div>` : ""}
    </section>`;
}

export function profileView({ achSum, c, earnedList, h, saga, ring, card = "", myData = "", nutrition = "" }) {
  return `
    ${card}
    ${myData}

    ${nutrition}

    ${!saga ? "" : `
    <div class="hero-head gilded pf-saga">
      <div class="eyebrow">${L("heroEyebrow")}</div>
      <div class="hero-title">${c.novice ? L("heroNovice") : `«${esc(S.hero.title)}»`}</div>
      <div class="level-ring">
        <svg viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(var(--t-acc-b),.16)" stroke-width="5"/>
          <circle cx="60" cy="60" r="52" fill="none" stroke="var(--gold-bright)" stroke-width="5"
            stroke-linecap="round" stroke-dasharray="${ring}" stroke-dashoffset="${ring * (1 - h.lvlProgress)}"/>
        </svg>
        <div class="lvl"><b>${h.level}</b><span>уровень</span></div>
      </div>
      <div class="dim small mono">${S.xp} XP · ${L("doneCount")}: ${S.sessions.length}</div>
    </div>

    <div class="panel panel--ornate class-panel">
      <span class="class-medallion medallion medallion--lg">${icon(c.icon)}</span>
      <div class="class-body">
        <div class="eyebrow">${L("classLbl")}</div>
        <div class="class-name display">${c.name}</div>
        <div class="class-sub">${L("classSub")}: <b>${c.sub}</b></div>
        <div class="class-gov dim small mono">${c.novice ? L("classHint") : (c.hybrid ? `гибрид: ${c.primary} + ${c.secondary}` : `по росту: ${c.primary} · ${c.secondary}`)}</div>
      </div>
    </div>

    <div class="panel panel--ornate">
      <div class="eyebrow" style="margin-bottom:12px">Характеристики</div>
      <div class="statgrid">
        ${Object.entries(h.stats).map(([k, v]) => `
          <div class="stat">
            <span class="stat-ico" style="color:${STAT_ACCENT[k] || "#c9a961"}">${icon(STAT_ICONS[k] || "gem")}</span>
            <span class="label">${k}</span>
            <span class="bar"><i style="width:${v}%;background:${STAT_GRAD[k] || "linear-gradient(90deg,#8a713e,#c9a961,#e8cd82)"}"></i></span>
            <span class="val mono" style="color:${STAT_ACCENT[k] || "#c9a961"}">${v}</span>
          </div>`).join("")}
      </div>
    </div>`}


    <div class="panel">
      <div class="ach-head">
        <div class="eyebrow">${L("awards")} · ${achSum.total}/${achSum.of}</div>
        <button class="ach-all-btn" id="ach-all">${L("awardsAll")}</button>
      </div>
      ${earnedList.length
        ? `<div class="status-grid ach-recent">${earnedList.slice(0, 8).map((c) => { const a = c.shown, g = c.got; return `
            <button class="status-badge" data-ach="${a.id}" title="${AN(a)}: ${AD(a)}">
              ${achMedallion(a)}${g.count > 1 ? `<span class="ach-count-badge">×${g.count}</span>` : ""}
              <span class="sb-name">${AN(a)}</span>
            </button>`; }).join("")}</div>`
        : `<div class="empty">${L("awardsEmpty")}</div>`}
    </div>`;
}
