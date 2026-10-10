// Вид: workout. Только разметка: данные приходят готовыми из контроллера.
import { MUSCLES, setDone } from "../../data/exercises.js";
import { exerciseIcon } from "../../data/icons-exercise.js";
import { METHOD_ICON } from "../../data/icons-ui.js";
import { METHODS, SESSION_CAP, TYPE_NAMES } from "../../data/program.js";
import { DELOAD, FEEL, isWarmup } from "../../data/progression.js";
import { fmt, fmtDate, plural, plural3 } from "../core/format.js";
import { L, questName, themeNow } from "../model/theme.js";
import { feelToday } from "../model/training.js";
import { icon } from "./icons.js";

export function restBarView() {
  return `
      <div class="rest-prog"><i></i></div>
      <div class="rest-row">
        <span class="rest-label">Отдых · <b id="rest-time">0:00</b><span class="rest-note dim small" id="rest-note"></span></span>
        <div class="rest-ctl">
          <button id="rest-minus" aria-label="Меньше 15 с">−15</button>
          <button id="rest-plus" aria-label="Больше 15 с">+15</button>
          <button id="rest-skip" class="rest-skip">Пропустить</button>
        </div>
      </div>`;
}

/** Счётчик в шапке карточки: «3/4», а когда всё закрыто — «✓ 4/4». */
export function countView(n, total) {
  return `${n >= total ? "✓ " : ""}${n}<i>/${total}</i>`;
}

/** Точки закрытых подходов (или кругов суперсета) в шапке карточки. */
export function dotsView(n, total) {
  return Array.from({ length: total }, (_, k) => `<i class="${k < n ? "on" : ""}"></i>`).join("");
}

export function workoutView({ LOAD_TXT, hot, sl, w, wk }) {
  return `
    <div class="qhead">
      <button class="icon-btn" id="back" aria-label="Назад"><svg viewBox="0 0 24 24"><path d="M15 4l-8 8 8 8V4z"/></svg></button>
      <span class="medallion medallion--sm">${icon(w.icon || "anvil")}</span>
      <h2 class="qhead-title display">${questName(w)}</h2>
      <span class="qtimer mono" id="quest-timer">${icon("stopwatch")}<b>0:00</b></span>
      <button class="icon-btn" id="q-help" aria-label="${L("questAbout")}">${icon("help")}</button>
    </div>
    <div class="badges qbadges">
      <span class="badge b-${w.type === "volume" ? "vol" : "str"}">${TYPE_NAMES[w.type]}</span>
      ${wk ? `<span class="badge">неделя ${wk.n}</span>` : ""}
      ${w.wave && themeNow() !== "plain" ? `<span class="badge">волна ${w.wave}</span>` : ""}
      ${w.deload ? `<span class="badge b-deload">разгрузка −${Math.round((1 - DELOAD) * 100)}%</span>` : ""}
      ${w.prog ? `<span class="badge b-prog">+${Math.round(w.prog * 100)}%</span>` : ""}
      <span class="badge ${sl.level === "high" ? "b-load" : ""}">${LOAD_TXT[sl.level]}</span>
      ${hot.length ? `<span class="badge b-focus ${hot[0].level === "high" ? "deep" : ""}" id="q-focus">${(MUSCLES[hot[0].group] || "").toLowerCase()} ${hot[0].sets}</span>` : ""}
      ${sl.overload ? `<span class="badge b-warn" id="q-warn">⚠ перегруз</span>` : ""}
    </div>
    <div class="feel-row">
      <span class="feel-lbl">Состояние</span>
      ${["fresh", "norm", "tired"].map((k) =>
        `<button class="feel ${feelToday() === k ? "on" : ""}" data-feel="${k}">${FEEL[k].name}</button>`).join("")}
    </div>
    ${feelToday() === "norm" ? "" : `<div class="feel-note dim small">${FEEL[feelToday()].hint}</div>`}
    <div id="ex-list"></div>
    <button class="btn-ghost add-ex-btn" id="add-ex">+ движение</button>
    <button class="finish-btn" id="finish">${L("questOne")}</button>`;
}

export function exerciseCardView({ ex, floor, heavy, mv, prev, repTxt, saved, src, target, wNoteShort }) {
  return `
      <button class="ex-head" aria-expanded="false">
        <span class="ex-ico">${icon(exerciseIcon(src))}</span>
        <span class="ex-main">
          <span class="ex-title">
            <span class="name">${ex.name}</span>
            ${ex.main ? '<span class="badge b-main">движение дня</span>' : ""}${ex.added ? '<span class="badge b-alt">добавлено</span>' : ""}${ex.swappedFrom ? '<span class="badge b-alt">замена</span>' : ""}${ex.method && METHODS[ex.method] ? `<span class="badge b-method">${METHODS[ex.method].name}</span>` : ""}
          </span>
          <span class="ex-brief">
            ${target
              ? `<b class="mono">${fmt(target)}</b><span class="u">кг${wNoteShort ? " " + wNoteShort : ""}</span>`
              : `<b class="own-w">${ex.bwOnly ? "свой вес" : (ex.wNote || "вес по ощущениям")}</b>`}
            <i>×</i><b class="mono">${repTxt}</b><span class="u">повт</span>
          </span>
        </span>
        <span class="ex-count">
          <span class="ex-status ${saved.filter((x) => setDone(x, src) && !isWarmup(x, ex.w)).length >= ex.sets ? "ok" : ""}">${saved.filter((x) => setDone(x, src) && !isWarmup(x, ex.w)).length}<i>/${ex.sets}</i></span>
          <span class="ex-dots">${dotsView(saved.filter((x) => setDone(x, src) && !isWarmup(x, ex.w)).length, ex.sets)}</span>
        </span>
      </button>
      <div class="ex-body">
        <div class="ex-goal">
          <div class="eg-nums">
            ${target
              ? `<span class="eg-w"><b class="mono">${fmt(target)}</b><span class="eg-u">кг${wNoteShort ? ` <i>${wNoteShort}</i>` : ""}</span></span>`
              : `<b class="eg-noweight">${ex.bwOnly ? "свой вес" : (ex.wNote || "вес по ощущениям")}</b>`}
            <span class="eg-reps"><span class="eg-x">×</span><b class="mono">${repTxt}</b><span class="eg-u">повт</span></span>
          </div>
          <div class="eg-side">
            ${floor ? `<span class="eg-floor">пол <b class="mono">${fmt(floor)}</b> кг</span>` : ""}
            ${mv ? `<span class="eg-line ${{ "▲": "up", "▼": "down" }[mv.icon] || ""}"><i class="mono">${mv.icon}</i>${prev ? mv.text.split(":")[0] : mv.text}</span>` : ""}
          </div>
          ${prev ? `<details class="eg-prev"><summary>прошлый раз</summary><span>${fmtDate(prev.date)}: <b class="mono">${prev.txt}</b></span></details>` : ""}
          ${ex.wp && ex.wp.freshK < 1 && src.group ? `<div class="eg-line note fatigue-note">${(MUSCLES[src.group] || "группа").toLowerCase()} к этому моменту уже отработал${/[аь]$/.test(MUSCLES[src.group] || "") ? "а" : ""} ${plural3(Math.round(ex.wp.prior), "подход", "подхода", "подходов")} — вес на ${Math.round((1 - ex.wp.freshK) * 100)}% ниже, чем на свежую мышцу</div>` : ""}
          ${ex.method && METHODS[ex.method] ? `<div class="eg-line note" data-method="${ex.method}">${icon(METHOD_ICON(ex.method))} ${METHODS[ex.method].name} на последнем подходе — как делать</div>` : ""}
        </div>

        <div class="set-head"><span>#</span><span>вес, кг</span><span>повторы</span><span></span></div>
        <div class="sets"></div>
        <div class="set-add">
          ${target ? `<button class="add-warm">+ ${heavy ? "лесенка" : "разминка"}</button>` : ""}
          <button class="add-set">+ ещё подход</button>
        </div>

        <div class="ex-tools">
          <button class="ex-tool" data-swap="${ex.id}">⇄<span>замена</span></button>
          <button class="ex-tool" data-info="${ex.id}">◎<span>разбор</span></button>
          <button class="ex-tool" data-pair="${ex.id}">⛓<span>в суперсет</span></button>
          <button class="ex-tool danger" data-drop="${ex.id}">✕<span>убрать</span></button>
        </div>
      </div>`;
}

export function setRowView({ si }) {
  return `
        <span class="idx mono"></span>
        <input class="s-w mono" inputmode="decimal" enterkeyhint="done" aria-label="вес подхода ${si + 1}" />
        <input class="s-r mono" inputmode="numeric" enterkeyhint="done" aria-label="повторы подхода ${si + 1}" />
        <button class="s-clear" aria-label="очистить подход"></button>`;
}

export function supersetCardView({ meta, pair, rounds, sameMuscle }) {
  return `
      <button class="ex-head" aria-expanded="false">
        <span class="ss-duo">${meta.map((m) => `<span class="ex-ico">${icon(exerciseIcon(m.src))}</span>`).join("")}</span>
        <span class="ex-main">
          <span class="ex-title"><span class="name">Суперсет</span><span class="badge ${sameMuscle ? "b-load" : "b-ss"}">${sameMuscle ? "одна группа" : "без отдыха внутри"}</span></span>
          <span class="ex-brief"><span class="u">${meta.map((m) => m.ex.short || m.ex.name).join(" + ")}</span></span>
        </span>
        <span class="ex-count">
          <span class="ex-status">0<i>/${rounds}</i></span>
          <span class="ex-dots">${dotsView(0, rounds)}</span>
        </span>
      </button>
      <div class="ex-body">
        <div class="ss-legend">
          ${meta.map((m) => `<button class="ss-leg" data-info="${m.ex.id}">
            <span class="ss-leg-ico">${icon(exerciseIcon(m.src))}</span>
            <span class="ss-leg-body">
              <span class="ss-leg-name">${m.ex.name}</span>
              <span class="ss-leg-goal">${m.target ? `<b class="mono">${fmt(m.target)}</b> кг${m.note ? " " + m.note : ""} × ` : ""}<b class="mono">${m.repTxt}</b> повт${m.floor ? ` · пол ${fmt(m.floor)}` : ""}</span>
            </span>
            <span class="pool-chev">›</span>
          </button>`).join("")}
        </div>
        <div class="ss-rounds"></div>
        <button class="add-set">+ ещё круг</button>
        <div class="ex-tools">
          ${meta.map((m) => `<button class="ex-tool" data-swap="${m.ex.id}">⇄<span>${m.ex.short || m.ex.name}</span></button>`).join("")}
          <button class="ex-tool danger" data-unpair="${pair[0].ss}">⛓<span>разбить пару</span></button>
        </div>
      </div>`;
}

export function roundLabelView({ k }) {
  return `<div class="ssr-l"><span>круг ${k + 1}</span><i></i></div>`;
}

export function roundRowView({ m }) {
  return `
          <span class="idx ss-idx">${icon(exerciseIcon(m.src))}</span>
          <input class="s-w mono" inputmode="decimal" enterkeyhint="done" aria-label="вес ${m.ex.name}" />
          <input class="s-r mono" inputmode="numeric" enterkeyhint="done" aria-label="повторы ${m.ex.name}" />
          <button class="s-clear" aria-label="очистить"></button>`;
}

export function workoutHelpView({ LOAD_TXT, gl, hot, sl, w }) {
  return `<p>${w.why || ""}</p>
      <div class="info-legend">
        <div><span class="badge b-${w.type === "volume" ? "vol" : "str"}">${TYPE_NAMES[w.type]}</span> ${w.type === "volume" ? "многоповторка ближе к отказу — работаем на объём" : "тяжёлые веса с запасом в баке — работаем на силу"}</div>
        ${w.wave ? `<div><span class="badge">волна ${w.wave}</span> набор вспомогательных движений этой пары недель</div>` : ""}
        ${w.prog ? `<div><span class="badge b-prog">+${Math.round(w.prog * 100)}%</span> прибавка к рабочим весам относительно первой пары недель</div>` : ""}
        ${w.deload ? `<div><span class="badge b-deload">разгрузка</span> те же движения и то же число подходов, но вес −${Math.round((1 - DELOAD) * 100)}%. Эта неделя не двигает рабочий максимум ни вверх, ни вниз — она нужна, чтобы следующий блок стартовал со свежих мышц, а не с накопленной усталости</div>` : ""}
        <div><span class="feel on">Устал</span> ${L("helpFeel")}: «Свежий» даёт +2% к весу и короткий отдых, «Устал» — минус 5%, на подход меньше и отдых длиннее. ${L("helpFeelTail")}</div>
        <div><span class="badge ${sl.level === "high" ? "b-load" : ""}">${LOAD_TXT[sl.level]}</span> ${plural(sl.compound, "многосуставное", "многосуставных")}, ${sl.maxBase ? plural(sl.maxBase, "максимальная база", "максимальные базы") : "без максимальных баз"}</div>
        ${hot.length ? `<div><span class="badge b-focus ${hot[0].level === "high" ? "deep" : ""}">${(MUSCLES[hot[0].group] || "").toLowerCase()} ${hot[0].sets}</span> ${L("helpFocus")}. Потолок — ${SESSION_CAP} за сессию: выше добавочный подход уже не растит, а только отнимает восстановление${hot[0].level === "high" ? ". <b>Потолок пробит</b> — убери одно движение на эту группу или перенеси его в другой квест" : ""}.
          ${gl.filter((g) => g.ex > 1).map((g) => `<br><b>${MUSCLES[g.group]}</b>: ${plural3(g.ex, "движение", "движения", "движений")}, ${plural3(g.sets, "подход", "подхода", "подходов")} — ${g.names.join(", ").toLowerCase()}`).join("")}
          <br><br>Рабочий вес это учитывает: каждый сделанный до движения подход по той же группе снимает 1,5% (вторичная работа — вполовину, глубже 15% не идём). Поэтому третье упражнение на квадрицепс получает вес не как на свежие ноги. Уберёшь или переставишь движение — вес соседей пересчитается сам.</div>` : ""}
        ${sl.overload ? `<div><span class="badge b-warn">⚠ перегруз</span> две максимальные базы в одном квесте. Натуралу это стоит дороже, чем даёт: замени одну на движение в тренажёре</div>` : ""}
        <div><span class="badge b-weight">вес ★</span> посчитан по твоим подходам в этом движении; ◎ — оценка от базовых лифтов, пока журнал пуст</div>
        <div><span class="ex-prog up"><i class="mono">▲</i>+2,5 кг</span> двойная прогрессия: закрыл все подходы по верхней границе повторов — в следующий раз шаг вверх. Не добрал нижнюю — шаг вниз. Попал в коридор — вес держим и добираем повторы</div>
        <div><span class="badge b-weight">105 кг</span> рабочий вес движения: столько надо повесить. У движения нет «от и до» — есть база, которую надо сделать</div>
        <div><span class="badge b-ss">суперсет</span> два движения подряд без отдыха: собрать пару можно кнопкой «в суперсет» в карточке, разбить — «разбить пару». Если в паре одна группа мышц, рабочий вес пересчитывается вниз: мышца там не отдыхает</div>
        <div><span class="badge b-dim">≈</span> разминка: подход легче 80% рабочего веса. Он не занимает слот плана, не считается недобором и вес движения не двигает — двадцать килограммов при рабочих ста это не упавшие силовые</div>
      </div>`;
}
