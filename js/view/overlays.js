// Вид: overlays. Только разметка: данные приходят готовыми из контроллера.
import { TIER_ORDER } from "../../data/achievements.js";
import { EQUIP, MUSCLES, PATTERNS, exById } from "../../data/exercises.js";
import { exerciseIcon } from "../../data/icons-exercise.js";
import { SCHEME } from "../../data/program.js";
import { e1rm as e1rmAvg, stateOf } from "../../data/progression.js";
import { fmt, fmtDate, plural3 } from "../core/format.js";
import { tierName } from "../model/achievements.js";
import { sessionExercises } from "../model/catalog.js";
import { S } from "../model/store.js";
import { AD, AN, AVIS, CN, L, questName } from "../model/theme.js";
import { poolWeight } from "../model/training.js";
import { durationTrusted, fmtDuration } from "../timing.js";
import { achLogHTML, achMedallion, poolRow } from "./components.js";
import { icon } from "./icons.js";

export function exerciseDetailView({ alts, ex, opts, strength, used, volume, ww }) {
  return `
    <div class="portion-card ex-card">
      <div class="ex-card-head">
        <span class="ex-card-ico">${icon(exerciseIcon(ex))}</span>
        <span class="ex-card-ttl">
          <span class="eyebrow">${MUSCLES[ex.group]} · ${PATTERNS[ex.pattern]} · ${EQUIP[ex.equip]}</span>
          <span class="portion-name display">${ex.name}</span>
        </span>
      </div>
      <div class="ex-tags">
        ${[ex.group, ...(ex.also || [])].map((g) => `<span class="ex-tag${g === ex.group ? " main" : ""}">${MUSCLES[g] || g}</span>`).join("")}
        ${ex.stretch ? `<span class="ex-tag stretch">растянутая позиция</span>` : ""}
        ${ex.tier === 1 ? `<span class="ex-tag">тяжёлая база</span>` : ""}
      </div>
      <p class="ex-desc">${ex.desc || ""}</p>

      <div class="ex-w-grid">
        <div class="ex-w-cell">
          <span class="ex-w-l">Силовой режим</span>
          <span class="ex-w-v mono">${strength && strength.est1RM ? fmt(strength.target) : "—"}</span>
          <span class="dim small">${SCHEME.strength.acc.reps[0]}–${SCHEME.strength.acc.reps[1]} повт.</span>
        </div>
        <div class="ex-w-cell">
          <span class="ex-w-l">Объёмный режим</span>
          <span class="ex-w-v mono">${volume && volume.est1RM ? fmt(volume.target) : "—"}</span>
          <span class="dim small">${SCHEME.volume.acc.reps[0]}–${SCHEME.volume.acc.reps[1]} повт.</span>
        </div>
      </div>
      <div class="dim small ex-w-note">
        ${ww && ww.est1RM
          ? `${{ work: `★ вес посчитан по твоим подходам: ${plural3(ww.sessions, "квест", "квеста", "квестов")} в журнале, ${stateOf(ww).text.toLowerCase()}`,
                manual: "✎ вес задан вручную — дальше его поведут подходы",
              }[ww.source] || "◎ оценка от базовых лифтов — уточнится после первых подходов"}${ex.bw ? " · вес указан как довесок к своему" : (ex.perHand ? " · на каждую руку" : "")}`
          : "Вес не оценивается — работа со своим весом или на время"}
      </div>
      ${ww && ww.est1RM ? `<div class="ex-fix">
        <span class="ex-fix-l">Поправить рабочий вес <i class="dim">после перерыва или болезни</i></span>
        <div class="ex-fix-row">
          <button class="ex-fix-b" data-fix="0.9">−10%</button>
          <button class="ex-fix-b" data-fix="0.95">−5%</button>
          <button class="ex-fix-b" data-fix="1.05">+5%</button>
          <button class="ex-fix-b ${ww.source === "manual" || (S.workReset || {})[ex.lift || ex.id] ? "on" : ""}" data-fix="0">↺ расчёт</button>
        </div>
      </div>` : ""}
      ${ww && ww.best ? `<div class="ex-1rm">
        <span class="ex-1rm-l">Личный максимум <i class="dim">расчётный 1ПМ</i></span>
        <span class="ex-1rm-v mono">${fmt(ww.oneRMBar)} <i>кг</i></span>
        <span class="dim small">с ${fmt(ww.best.w)} × ${ww.best.r} · ${fmtDate(ww.best.date)}</span>
      </div>` : ""}

      <div class="eyebrow" style="margin:16px 0 6px">Техника</div>
      <ul class="ex-cues">${(ex.cues || []).map((c) => `<li>${c}</li>`).join("")}</ul>

      ${alts.length ? `<div class="eyebrow" style="margin:16px 0 6px">Чем заменить</div>
        <div class="ex-alts">${alts.map((a) => {
          const aw = poolWeight(a);
          return `<button class="ex-alt" data-alt="${a.id}">
            <span class="ex-alt-ico">${icon(exerciseIcon(a))}</span>
            <span class="ex-alt-body">
              <span class="ex-alt-name">${a.name}</span>
              <span class="ex-alt-meta dim">${EQUIP[a.equip]}${aw && aw.est1RM ? ` · ${fmt(aw.target)} кг` : ""}</span>
            </span>
            <span class="pool-chev">›</span>
          </button>`; }).join("")}</div>` : ""}

      ${used.length ? `<div class="eyebrow" style="margin:16px 0 6px">В каких квестах</div>
        <div class="ex-used">${used.map((u) => `<span class="ex-used-chip ${u.type}">${u.boss} <span class="dim">· нед. ${u.week}</span></span>`).join("")}</div>` : ""}

      ${opts.onPick ? `<button class="finish-btn" id="ex-pick">Выбрать это движение</button>` : ""}
      <button class="btn-ghost" id="ex-close">Закрыть</button>
    </div>`;
}

export function infoView({ body, eyebrow, title }) {
  return `
    <div class="portion-card info-card">
      ${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ""}
      <div class="portion-name display">${title}</div>
      <div class="info-body">${body}</div>
      <button class="btn-ghost" id="info-close">Понятно</button>
    </div>`;
}

export function methodView({ m }) {
  return `
    <div class="portion-card ex-card">
      <div class="eyebrow">механика подхода</div>
      <div class="portion-name display">${m.name}</div>
      <p class="ex-desc">${m.desc}</p>
      <div class="eyebrow" style="margin:14px 0 6px">Как делать</div>
      <p class="ex-desc" style="text-align:left">${m.how}</p>
      <div class="dim small" style="margin-top:12px;text-align:left">Движок сам ставит дроп-сет не чаще одного раза за квест и только на изоляции: тяжёлая база идёт без него, с запасом повторов.</div>
      <button class="btn-ghost" id="m-close" style="margin-top:16px">Закрыть</button>
    </div>`;
}

export function pairPickerView({ ex, mates, src }) {
  return `
    <div class="portion-card ex-card">
      <div class="eyebrow">Суперсет с «${ex.short || ex.name}»</div>
      <p class="dim small" style="margin:8px 0 12px">Два движения подряд без отдыха, отдых — после пары.
        Квест станет короче, а объём останется прежним.</p>
      ${mates.length ? `<div class="ex-alts">${mates.map((m) => {
        const ms = exById(m.id) || m;
        const same = ms.group === src.group;
        return `<button class="ex-alt" data-mate="${m.id}">
          <span class="ex-alt-ico">${icon(exerciseIcon(ms))}</span>
          <span class="ex-alt-body">
            <span class="ex-alt-name">${m.name}</span>
            <span class="ex-alt-meta ${same ? "warn" : "dim"}">${same
              ? `та же группа · ${MUSCLES[ms.group]} — вес пересчитается вниз`
              : `${MUSCLES[ms.group]} · мышца отдыхает, пока работает партнёр`}</span>
          </span>
          <span class="pool-chev">›</span>
        </button>`; }).join("")}</div>`
        : `<div class="empty">Свободных движений нет: все уже в парах.</div>`}
      <button class="btn-ghost" id="pair-close" style="margin-top:14px">Отмена</button>
    </div>`;
}

export function poolPickerView({ q, rest, sug, title }) {
  return `
      <div class="portion-card ex-card">
        <div class="eyebrow">${title}</div>
        <input class="pool-search" id="pk-q" placeholder="Поиск движения" value="${q}" />
        ${sug.length ? `<div class="eyebrow" style="margin:12px 0 6px">Похожие по задаче</div>${sug.map(poolRow).join("")}` : ""}
        ${rest.map(({ g, list }) => `<div class="eyebrow" style="margin:14px 0 6px">${MUSCLES[g]}</div>${list.map(poolRow).join("")}`).join("")}
        <button class="btn-ghost" id="pk-close" style="margin-top:14px">Отмена</button>
      </div>`;
}

export function achievementToastView({ u }) {
  return `${achMedallion(u.ach)}<span class="at-body"><span class="eyebrow">${u.isNew ? L("achNew") : L("achAgain")} · ${tierName(u.ach.tier)}</span><b>${AN(u.ach)}${u.count > 1 ? ` <span class="ach-count">×${u.count}</span>` : ""}</b></span>`;
}

export function verdictView({ badges, bright, durationSec, gold, res }) {
  return `
    <div>
      <div class="seal"><svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="44" fill="none" stroke="${gold}" stroke-width="1.5"/>
        <path d="M50 14l9 18 20 3-14.5 14 3.5 20-18-9.5L32 69l3.5-20L21 35l20-3z"
          fill="none" stroke="${bright}" stroke-width="1.5"/>
      </svg></div>
      <div class="v-title ${res.cls}">${res.verdict}</div>
      <div class="v-sub">${res.flavor}</div>
      <div class="v-xp">Счёт ${res.score}% · подходы ${res.doneSets}/${res.plannedSets} · +${res.xp} XP${durationSec ? ` · ⏱ ${fmtDuration(durationSec)}` : ""}</div>
      ${badges}
      <button class="v-close">Вернуться к квестам</button>
    </div>`;
}

export function sessionDetailView({ rows, s, w }) {
  return `
    <div class="portion-card sd-card">
      <div class="eyebrow">Прошлый квест · ${fmtDate(s.date)}</div>
      <div class="portion-name display">${w ? questName(w) : s.workoutId}</div>
      <div class="sd-verdict ${s.cls} mono">${s.score}% · +${s.xp} XP${s.durationSec ? ` · ⏱ ${fmtDuration(s.durationSec)}${durationTrusted(s) ? "" : "<span class=\"dim\"> (старый таймер)</span>"}` : ""}${w && w.title ? ` · ${w.title}` : ""}</div>
      <div class="sd-list">${rows || `<div class="empty">Подходы не записаны.</div>`}</div>
      <button class="btn-ghost" id="sd-close">Закрыть</button>
    </div>`;
}

export function achievementDetailView({ a, got }) {
  return `
    <div class="status-detail">
      ${achMedallion(a, "medallion--lg" + (got ? "" : " locked"))}
      <div class="eyebrow tier-text tier-${a.tier}">${tierName(a.tier)} · ${CN(a.cat)}${a.repeat ? " · повторяемое" : ""}</div>
      <div class="sd-title display">${AN(a)}</div>
      <div class="sd-desc">${AD(a) || ""}</div>
      ${got
        ? `<div class="dim small mono" style="margin-top:8px">${got.count > 1 ? `получено ${got.count} раз · впервые ${got.first ? fmtDate(got.first) : "—"}` : `получено ${got.first ? fmtDate(got.first) : "—"}`}</div>
           ${achLogHTML(got)}`
        : `<div class="dim small mono" style="margin-top:8px">ещё не получено</div>`}
      <button class="btn-ghost" id="st-close" style="margin-top:16px;max-width:200px">Закрыть</button>
    </div>`;
}

export function allAchievementsView({ cats, earned, sum }) {
  return `
    <div class="portion-card ach-card">
      <div class="eyebrow">${L("awards")} · ${sum.total} / ${sum.of}</div>
      <div class="ach-tiers">${TIER_ORDER.map((t) => `<span class="ach-tier-chip tier-${t}"><i></i>${tierName(t)} ${sum.byTier[t]}/${AVIS().filter((a) => a.tier === t).length}</span>`).join("")}</div>
      <div class="ach-list">
        ${cats.map((cat) => {
          const list = AVIS().filter((a) => a.cat === cat);
          if (!list.length) return "";
          return `<div class="eyebrow ach-cat">${CN(cat)} · ${list.filter((a) => earned[a.id]).length}/${list.length}</div>
            ${list.map((a) => { const g = earned[a.id]; return `
              <button class="ach-row ${g ? "" : "locked"}" data-ach="${a.id}">
                ${achMedallion(a, g ? "" : "locked")}
                <span class="ach-row-body">
                  <span class="ach-row-name">${AN(a)}${g && g.count > 1 ? ` <span class="ach-count">×${g.count}</span>` : ""}</span>
                  <span class="ach-row-desc dim small">${AD(a)}</span>
                </span>
                <span class="ach-row-tier tier-text tier-${a.tier}">${tierName(a.tier)}</span>
              </button>`; }).join("")}`;
        }).join("")}
      </div>
      <button class="btn-ghost" id="ach-close">Закрыть</button>
    </div>`;
}

export function verdictBadgesView({ awarded }) {
  return (awarded && awarded.length)
    ? `<div class="v-statuses">
         <div class="eyebrow" style="margin-bottom:8px">${awarded.length > 1 ? L("awards") : "Знак отличия"}</div>
         ${awarded.map((u) => `<div class="v-status">${achMedallion(u.ach)}<span><b>${AN(u.ach)}</b>${u.count > 1 ? ` <span class="ach-count">×${u.count}</span>` : ""}<span class="dim small"> — ${tierName(u.ach.tier)}${u.isNew ? "" : " · снова"} · ${u.note || AD(u.ach)}</span></span></div>`).join("")}
       </div>`
    : "";
}

export function sessionRowsView({ s }) {
  return sessionExercises(s).map((ex) => {
    const sets = (s.entries[ex.id] || []).filter((x) => x.w > 0 && x.r > 0);
    if (!sets.length) return "";
    const ceil = Math.max(...sets.map((x) => e1rmAvg(x.w, x.r)));
    const setStr = sets.map((x) => `${fmt(x.w)}×${x.r}`).join("  ");
    return `<div class="sd-ex">
      <div class="sd-ex-top"><span class="sd-name">${ex.name}${ex.main ? ' <span class="main-badge">дв. дня</span>' : ""}</span><span class="sd-ceil mono">1ПМ ${fmt(ceil)}</span></div>
      <div class="sd-sets mono">${setStr}</div>
    </div>`;
  }).join("");
}
