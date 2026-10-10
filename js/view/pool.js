// Вид: pool. Только разметка: данные приходят готовыми из контроллера.
import { BODY_VIEWS, coverLabel, coverLevel, coverVolume, shapeSvg } from "../../data/bodymap.js";
import { EXERCISES, MUSCLES } from "../../data/exercises.js";
import { PROGRAM } from "../../data/program.js";
import { plural3 } from "../core/format.js";
import { L } from "../model/theme.js";
import { coverSummary, poolRow } from "./components.js";
import { icon } from "./icons.js";

/** Карта мышц: заливка по покрытию недели, выбранная группа подсвечена. */
export function bodyMap(cov, bodyPick) {
  return BODY_VIEWS.map((v) => `
    <div class="bm-wrap">
      <svg viewBox="${v.viewBox}" class="bm" role="img" aria-label="Мышцы ${v.title}">
        <g class="bm-base">${shapeSvg(v.base)}</g>
        ${Object.entries(v.muscles).map(([g, list]) => `
          <g class="bm-m lvl-${coverLevel(cov[g], g)} vol-${coverVolume(cov[g])} ${bodyPick === g ? "pick" : ""}"
             data-g="${g}" tabindex="0" role="button"
             aria-label="${MUSCLES[g]}: ${coverLabel(cov[g])}">${shapeSvg(list)}</g>`).join("")}
      </svg>
      <span class="bm-title">${v.title}</span>
    </div>`).join("");
}

export function poolView({ bodyPick, bodyWeek, cov, found, groups, poolFilter, poolOpen, q, showMap, trend, trendTop }) {
  const lvlBadge = (g) => ({ ok: "b-vol", low: "b-load", miss: "b-warn", none: "b-dim" })[coverLevel(cov[g], g)];
  return `
    <div class="qstack">
      <div class="qhead">
        <button class="icon-btn" id="back" aria-label="Назад"><svg viewBox="0 0 24 24"><path d="M15 4l-8 8 8 8V4z"/></svg></button>
        <h2 class="qhead-title display">${L("pool")}</h2>
        <span class="badge">${EXERCISES.length}</span>
        <button class="icon-btn" id="pool-help" aria-label="${L("poolAbout")}">${icon("help")}</button>
      </div>
      <div class="search-bar">
        <span class="search-ico">${icon("search")}</span>
        <input class="search-input" id="pool-q" placeholder="Движение, мышца, снаряд" value="${poolFilter}"
               autocomplete="off" autocorrect="off" spellcheck="false" />
        ${poolFilter ? `<button class="search-clear" id="pool-clear" aria-label="Очистить">${icon("close")}</button>` : ""}
      </div>
    </div>

    ${!showMap ? `<div class="search-count dim small">${found.length
        ? plural3(found.length, "движение", "движения", "движений") + " найдено"
        : "Движений не найдено"}</div>` : `
    <div class="panel">
      <div class="panel-head">
        <span class="eyebrow">Покрытие мышц</span>
        <span class="wk-switch">
          ${PROGRAM.weeks.map((wk) => `<button class="wk ${wk.n === bodyWeek ? "on" : ""}" data-wk="${wk.n}"
            title="Неделя ${wk.n}${wk.wave ? `, волна ${wk.wave}` : ""}">${wk.n}</button>`).join("")}
        </span>
      </div>
      <div class="bm-row">${bodyMap(cov, bodyPick)}</div>
      <div class="bm-info ${bodyPick ? "on" : ""}">
        ${bodyPick
          ? `<span class="badge ${lvlBadge(bodyPick)}">${MUSCLES[bodyPick]}</span><span class="mono">${coverLabel(cov[bodyPick])}</span>
             <span class="bm-hint dim">${plural3(found.length, "движение", "движения", "движений")} ниже</span>`
          : `<span class="dim small">${coverSummary(cov)}</span>`}
      </div>
      ${bodyPick ? `
      <div class="trend" role="group" aria-label="Объём по неделям">
        ${trend.map((t) => `
          <button class="tr ${t.n === bodyWeek ? "on" : ""}" data-wk="${t.n}"
                  title="Неделя ${t.n}: ${coverLabel(t)}">
            <b>${t.sets ? Math.round(t.sets) : "—"}</b>
            <span class="tr-track"><i class="lvl-${coverLevel(t, bodyPick)} vol-${coverVolume(t)}"
               style="height:${Math.max(7, Math.round((t.sets / trendTop) * 100))}%"></i></span>
            <span class="tr-n">Н${t.n}</span>
          </button>`).join("")}
      </div>` : ""}
      <div class="cov-scale">
        <div class="cs-row">
          <span class="cs-t">частота</span>
          <span class="cs-chip lvl-ok">2×/нед</span>
          <span class="cs-chip lvl-low">один день</span>
          <span class="cs-chip lvl-miss">пропуск</span>
        </div>
        <div class="cs-row">
          <span class="cs-t">объём</span>
          <span class="cs-bar"><i class="vol-lo"></i><i class="vol-mid"></i><i class="vol-hi"></i></span>
          <span class="cs-scale mono">до 8 · 8–14 · 15+ сетов</span>
        </div>
      </div>
    </div>`}

    ${groups.map(({ g, list }) => {
      const open = !!q || !!bodyPick || poolOpen.has(g);
      return `
      <div class="panel pool-group ${open ? "open" : ""}">
        <button class="panel-head pool-toggle" data-g="${g}">
          <span class="eyebrow">${MUSCLES[g]}</span>
          <span class="ph-right"><span class="badge b-dim">${list.length}</span><span class="chev">›</span></span>
        </button>
        <div class="pool-list">${list.map(poolRow).join("")}</div>
      </div>`; }).join("")}
    ${!groups.length ? `<div class="empty">Ничего не найдено. Попробуй другое слово — например «блок» или «тяга».</div>` : ""}`;
}

export function poolHelpView() {
  return `<p>Весь пул движений с рабочими весами под твои замеры. Любое можно поставить в квест заменой или добавить к нему.</p>
      <div class="info-legend">
        <div><span class="badge b-weight">вес ★</span> посчитан по твоим замерам этого движения</div>
        <div><span class="badge b-weight">вес ◎</span> оценка от базовых лифтов — уточнится после первых подходов</div>
        <div><span class="badge b-main">база</span> опорный лифт: от него считаются веса остальных движений</div>
        <div><span class="badge b-ss">растяжение</span> движение грузит мышцу в растянутой позиции: по свежим данным это приоритет</div>
      </div>
      <p>На карте тела мышца подсвечена по числу активных дней за неделю. Тапни по мышце — покажу частоту и объём. Правило цикла: каждая группа работает дважды в неделю.</p>
      <p class="dim small">В самих квестах встречаются две механики подхода: суперсет (два движения подряд без отдыха) и дроп-сет (сброс веса на последнем подходе). Тапни по бейджу в тренировке — расскажу подробнее.</p>`;
}
