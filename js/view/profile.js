// Вид: profile. Только разметка: данные приходят готовыми из контроллера.
import { TIER_ORDER } from "../../data/achievements.js";
import { LIFT_NAMES } from "../../data/program.js";
import { THEMES, THEME_ORDER } from "../../data/theme.js";
import { fmt } from "../core/format.js";
import { S } from "../model/store.js";
import { AD, AN, L, themeNow } from "../model/theme.js";
import { inTelegram, tgUserHandle, tgUserName } from "../telegram.js";
import { STAT_ACCENT, STAT_GRAD, STAT_ICONS, achMedallion } from "./components.js";
import { icon } from "./icons.js";

/** Шапка «Чистой»: три числа вместо уровня, опыта и характеристик. */
export function heroSummaryView(cells) {
  return `
    <div class="hero-head">
      <h1 class="display hero-name">${S.hero.name}</h1>
      <div class="hero-sum">${cells.map(([v, l]) =>
        `<span class="hs-cell"><b class="mono">${v}</b><i>${l}</i></span>`).join("")}</div>
    </div>`;
}

/** Подпись под аккаунтом: где живёт журнал. */
export const syncNoteText = (serverOn) => (serverOn
  ? "Журнал хранится на сервере, копия — в облаке Telegram."
  : "Журнал привязан к этому аккаунту и сам уезжает в облако Telegram: открой приложение с другого телефона — прогресс будет там же.");

export function profileView({ achSum, achievements, bw, c, earnedList, h, summary, ring, serverOn, goals = "" }) {
  return `
    ${summary ? heroSummaryView(summary) : `
    <div class="hero-head gilded">
      <div class="eyebrow">${L("heroEyebrow")}</div>
      <h1 class="display hero-name">${S.hero.name}</h1>
      <div class="hero-title">${c.novice ? L("heroNovice") : `«${S.hero.title}»`}</div>
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

    ${goals}

    <div class="panel">
      <div class="ach-head">
        <div class="eyebrow">${L("awards")} · ${achSum.total} / ${achSum.of}</div>
        <button class="ach-all-btn" id="ach-all">${L("awardsAll")}</button>
      </div>
      <div class="ach-tiers">${TIER_ORDER.map((t) => `<span class="ach-tier-chip tier-${t}${achSum.byTier[t] ? "" : " none"}"><i></i>${achSum.byTier[t]}</span>`).join("")}</div>
      ${earnedList.length
        ? `<div class="status-grid">${earnedList.slice(0, 24).map((a) => { const g = achievements[a.id]; return `
            <button class="status-badge" data-ach="${a.id}" title="${AN(a)}: ${AD(a)}">
              ${achMedallion(a)}${g.count > 1 ? `<span class="ach-count-badge">×${g.count}</span>` : ""}
              <span class="sb-name">${AN(a)}</span>
            </button>`; }).join("")}</div>${earnedList.length > 24 ? `<div class="dim small" style="margin-top:8px">и ещё ${earnedList.length - 24} — в полном списке</div>` : ""}`
        : `<div class="empty">${L("awardsEmpty")}</div>`}
    </div>

    <div class="panel">
      <div class="eyebrow" style="margin-bottom:8px">${L("lifts")}</div>
      ${Object.entries(h.lifts).map(([k, v]) => {
        const d = v.cur - v.base;
        return `<div class="kv"><span>${LIFT_NAMES[k]}</span>
          <span class="mono">${fmt(v.cur)} кг ${d > 0.5 ? `<span class="verdict-gold">+${fmt(d)}</span>` : `<span class="dim">база</span>`}</span></div>`;
      }).join("")}
      <button class="kv kv-btn" id="edit-bw"><span>${L("bodyweight")}</span><span class="mono">${bw} кг <i class="dim">изменить</i></span></button>
    </div>

    <div class="panel">
      <div class="eyebrow" style="margin-bottom:10px">Оформление</div>
      <div class="theme-pick">
        ${THEME_ORDER.map((id) => { const th = THEMES[id]; return `
          <button class="theme-card ${id === themeNow() ? "on" : ""}" data-theme-pick="${id}" aria-pressed="${id === themeNow()}">
            <span class="theme-swatch">${th.swatch.map((c) => `<i style="background:${c}"></i>`).join("")}</span>
            <span class="theme-name">${th.name}</span>
            <span class="theme-note dim small">${th.note}</span>
          </button>`; }).join("")}
      </div>
    </div>

    <div class="panel">
      <div class="eyebrow" style="margin-bottom:10px">Настройки</div>
      <button class="toggle-row" id="tg-sound"><span>Звук интерфейса</span><span class="tg ${S.settings?.sound ? "on" : ""}"><i></i></span></button>
      <button class="toggle-row" id="tg-haptics"><span>Вибро-отдача</span><span class="tg ${S.settings?.haptics ? "on" : ""}"><i></i></span></button>
      <button class="toggle-row" id="tg-off"><span>Поиск продуктов в открытой базе<span class="dim small" style="display:block">запрос уходит в Open Food Facts</span></span><span class="tg ${S.settings?.offSearch ? "on" : ""}"><i></i></span></button>
    </div>

    ${inTelegram ? `
    <div class="panel">
      <div class="panel-head">
        <span class="eyebrow">Аккаунт Telegram</span>
        <span class="badge b-dim" id="sync-badge">синхронизация…</span>
      </div>
      <div class="kv"><span>${tgUserName() || "Герой"}</span><span class="dim mono">${tgUserHandle() || ""}</span></div>
      <div class="dim small" id="sync-note" style="margin-top:6px">${syncNoteText(serverOn)}</div>
      <button class="btn-ghost" id="btn-sync" style="margin-top:12px">Синхронизировать сейчас</button>
    </div>` : ""}

`;
}

export function bodyweightEditorView() {
  return `
      <div class="portion-card">
        <div class="eyebrow">Вес героя</div>
        <div class="portion-name display">Сколько весишь сейчас</div>
        <p class="dim small" style="margin:8px 0 12px">От него считаются подтягивания, брусья и гиперэкстензия:
          там рабочий вес — это довесок к своему.</p>
        <div class="bw-edit">
          <button class="ex-fix-b" data-bw="-1">−1</button>
          <input id="bw-in" class="mono" inputmode="decimal" enterkeyhint="done" value="${S.hero.bodyweight || 90}" aria-label="вес тела" />
          <button class="ex-fix-b" data-bw="1">+1</button>
        </div>
        <button class="finish-btn" id="bw-save" style="margin-top:14px">Сохранить</button>
        <button class="btn-ghost" id="bw-close">Отмена</button>
      </div>`;
}
