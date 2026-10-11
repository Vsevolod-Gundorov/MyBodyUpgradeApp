// Вид: profile. Только разметка: данные приходят готовыми из контроллера.
import { LIFT_NAMES } from "../../data/program.js";
import { THEMES, THEME_ORDER } from "../../data/theme.js";
import { esc, fmt } from "../core/format.js";
import { S } from "../model/store.js";
import { AD, AN, L, themeNow } from "../model/theme.js";
import { inTelegram, tgUserHandle, tgUserName } from "../telegram.js";
import { STAT_ACCENT, STAT_GRAD, STAT_ICONS, achMedallion } from "./components.js";
import { icon } from "./icons.js";

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
 * фитнес-приложений (Apple Fitness, Strava, Hevy): кто ты — сверху, правка — в один тап.
 */
export function profileCardView({ me, cells }) {
  return `
    <section class="pf-card" aria-label="Профиль">
      <div class="pf-top">
        ${avatarView(me)}
        <div class="pf-id">
          <h1 class="display pf-name hero-name">${esc(me.name)}</h1>
          <div class="pf-handle">${me.handle ? esc(me.handle) : "Атлет"}</div>
        </div>
        <button class="pf-edit" id="pf-edit" aria-label="Изменить профиль">${PENCIL}</button>
      </div>
      ${me.chips.length ? `<div class="pf-chips">${me.chips.map((c) => `<span class="pf-chip">${c}</span>`).join("")}</div>` : ""}
      ${cells ? `<div class="pf-stats hero-sum">${cells.map(([v, l]) =>
        `<span class="pf-stat hs-cell"><b class="mono">${v}</b><i>${l}</i></span>`).join("")}</div>` : ""}
    </section>`;
}

/** «Мои данные»: список как в настройках iOS — значок, что, сколько, стрелка. Тап — правка ровно этого пункта. */
export function myDataView(rows) {
  return `
    <section class="panel pf-list" aria-label="Мои данные">
      <div class="eyebrow pf-list-h">Мои данные</div>
      ${rows.map((r) => `
        <button class="pf-row" ${r.id ? `id="${r.id}"` : ""} ${r.step ? `data-step="${r.step}"` : ""}>
          <span class="pf-ico">${icon(r.icon)}</span>
          <span class="pf-l">${r.label}${r.sub ? `<i>${r.sub}</i>` : ""}</span>
          <span class="pf-v">${r.value}</span>
          <span class="pf-chev" aria-hidden="true">›</span>
        </button>`).join("")}
    </section>`;
}

/** Подпись под аккаунтом: где живёт журнал. */
export const syncNoteText = (serverOn) => (serverOn
  ? "Журнал хранится на сервере, копия — в облаке Telegram."
  : "Журнал привязан к этому аккаунту и сам уезжает в облако Telegram: открой приложение с другого телефона — прогресс будет там же.");

export function profileView({ achSum, c, earnedList, h, summary, ring, serverOn, goals = "", remind = "", card = "", myData = "" }) {
  return `
    ${card}
    ${summary ? "" : `
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

    ${goals}

    ${myData}

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
    </div>

    <div class="panel">
      <div class="eyebrow" style="margin-bottom:8px">${L("lifts")}</div>
      ${Object.entries(h.lifts).map(([k, v]) => {
        const d = v.cur - v.base;
        return `<div class="kv"><span>${LIFT_NAMES[k]}</span>
          <span class="mono">${fmt(v.cur)} кг ${d > 0.5 ? `<span class="verdict-gold">+${fmt(d)}</span>` : `<span class="dim">база</span>`}</span></div>`;
      }).join("")}
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

    ${remind}

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

/** Напоминания в Telegram: добавки по расписанию и конец отдыха. Сообщение исчезает через минуту. */
export function remindPanelView({ conf, available, times }) {
  const row = (id, on, title, sub) => `<button class="toggle-row" id="${id}" aria-pressed="${on}" ${available ? "" : "disabled"}><span>${title}<span class="dim small" style="display:block">${sub}</span></span><span class="tg ${on ? "on" : ""}"><i></i></span></button>`;
  return `
    <div class="panel remind-panel">
      <div class="eyebrow" style="margin-bottom:10px">Напоминания в Telegram</div>
      ${available ? "" : `<p class="dim small" style="margin:0 0 8px">Работают в приложении, открытом из Telegram: пишет бот.</p>`}
      ${row("rm-rest", !!conf.rest, "Конец отдыха", "«пора подход», если приложение свёрнуто")}
      ${row("rm-supp", !!conf.supp, "Добавки по расписанию", "только то, что ещё не отмечено")}
      ${conf.supp ? `<div class="rm-times">${times.map((t) => `<label class="rm-time"><span>${t.slot}</span><input type="time" data-slot="${esc(t.slot)}" value="${esc(t.at)}" step="300" /></label>`).join("")}</div>` : ""}
      <p class="dim small" style="margin:8px 0 0">Сообщение висит минуту и удаляется само.</p>
    </div>`;
}

