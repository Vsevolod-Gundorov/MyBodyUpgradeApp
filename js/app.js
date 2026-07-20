import { PROGRAM, BASELINES, LIFT_NAMES } from "../data/program.js";

/* ================= состояние (БД = localStorage + экспорт в JSON-файл) ================= */
const DB_KEY = "bodyupgrade.v1";

const defaultState = () => ({
  hero: { name: "Всеволод", title: "Кузнец Собственного Тела", bodyweight: 93 },
  xp: 0,
  sessions: [], // { id, workoutId, date, verdict, score, xp, entries: { exId: [{w, r}] } }
  drafts: {},   // workoutId -> entries (незавершённые)
});

let S = load();
function load() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return Object.assign(defaultState(), JSON.parse(raw));
  } catch (e) { /* повреждённые данные — начинаем заново */ }
  return defaultState();
}
function save() { localStorage.setItem(DB_KEY, JSON.stringify(S)); }

/* ================= справочники ================= */
const WORKOUTS = {};
const WEEK_OF = {};
PROGRAM.weeks.forEach((wk) => wk.workouts.forEach((w) => { WORKOUTS[w.id] = w; WEEK_OF[w.id] = wk; }));
const ORDER = PROGRAM.weeks.flatMap((wk) => wk.workouts.map((w) => w.id));

const epley = (w, r) => (r >= 1 ? w * (1 + r / 30) : 0);
const fmt = (n) => (Math.round(n * 10) / 10).toString().replace(".", ",");
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => { const [y, m, d] = iso.split("-"); return `${d}.${m}.${String(y).slice(2)}`; };

/* ================= скоринг: отработал или схалявил ================= */
function scoreSession(workout, entries) {
  let plannedSets = 0, doneSets = 0, weightPts = 0, weightMax = 0;
  workout.exercises.forEach((ex) => {
    const sets = (entries[ex.id] || []).filter((s) => s.w > 0 && s.r > 0);
    plannedSets += ex.sets;
    doneSets += Math.min(sets.length, ex.sets);
    if (ex.w && ex.w[0] > 0) {
      const weight = ex.main ? 2 : 1;
      weightMax += weight;
      if (sets.length) {
        const top = Math.max(...sets.map((s) => s.w));
        if (top >= ex.w[0]) weightPts += weight;            // работал в своей вилке
        else if (top >= ex.w[0] * 0.85) weightPts += weight * 0.6; // ниже вилки
        else weightPts += weight * 0.3;                     // сильно ниже
      }
    }
  });
  const coverage = plannedSets ? doneSets / plannedSets : 0;
  const intensity = weightMax ? weightPts / weightMax : 1;
  const score = Math.round(100 * (0.65 * coverage + 0.35 * intensity));
  let verdict, cls, flavor;
  if (score >= 85) { verdict = "Испытание пройдено"; cls = "verdict-gold"; flavor = "Кузница приняла твою работу. Сталь стала крепче."; }
  else if (score >= 60) { verdict = "Достойно, но не всё"; cls = "verdict-mid"; flavor = "Огонь горел, но не все угли прогорели. В следующий раз — до конца."; }
  else { verdict = "Схалтурил, странник"; cls = "verdict-fail"; flavor = "Молот едва коснулся наковальни. Кузница помнит всё."; }
  const xp = Math.round(score * 1.2 + doneSets * 2);
  return { score, verdict, cls, flavor, xp, doneSets, plannedSets };
}

/* ================= вычисление статов героя ================= */
function bestE1RM(lift, upto = Infinity) {
  let best = 0;
  S.sessions.forEach((s, i) => {
    if (i > upto) return;
    const w = WORKOUTS[s.workoutId]; if (!w) return;
    w.exercises.forEach((ex) => {
      if (ex.lift !== lift) return;
      (s.entries[ex.id] || []).forEach(({ w: wt, r }) => { if (wt && r) best = Math.max(best, epley(wt, Math.min(r, 10))); });
    });
  });
  return best;
}

function heroStats() {
  const lifts = {};
  let strengthGain = 0;
  Object.keys(BASELINES).forEach((k) => {
    const cur = Math.max(bestE1RM(k), 0);
    lifts[k] = { base: BASELINES[k], cur: cur || BASELINES[k] };
    strengthGain += Math.max(0, (lifts[k].cur - BASELINES[k]) / BASELINES[k]);
  });
  const level = Math.floor(Math.sqrt(S.xp / 40)) + 1;
  const nextXp = 40 * Math.pow(level, 2);
  const prevXp = 40 * Math.pow(level - 1, 2);
  const lvlProgress = Math.min(1, (S.xp - prevXp) / Math.max(1, nextXp - prevXp));

  // Сила: старт 62, растёт от прибавок e1RM
  const str = Math.min(99, Math.round(62 + strengthGain * 220));
  // Выносливость: средний тоннаж последних 6 сессий (т)
  const tonn = S.sessions.slice(-6).map((s) => {
    let t = 0; Object.values(s.entries).forEach((sets) => sets.forEach(({ w, r }) => (t += (w || 0) * (r || 0))));
    return t / 1000;
  });
  const avgT = tonn.length ? tonn.reduce((a, b) => a + b, 0) / tonn.length : 0;
  const endr = Math.min(99, Math.round(40 + avgT * 2.4));
  // Дисциплина: сессии за последние 14 дней против плана 6
  const cutoff = Date.now() - 14 * 864e5;
  const recent = S.sessions.filter((s) => new Date(s.date).getTime() >= cutoff).length;
  const disc = Math.min(99, Math.round((recent / 6) * 99));
  // Стойкость: средний счёт всех сессий
  const avgScore = S.sessions.length ? S.sessions.reduce((a, s) => a + s.score, 0) / S.sessions.length : 0;
  const grit = Math.round(avgScore * 0.99);

  return { level, lvlProgress, lifts, stats: { СИЛА: str, ВЫНОСЛ: endr, ДИСЦИПЛ: disc, СТОЙКОСТЬ: grit } };
}

function nextWorkoutId() {
  const done = new Set();
  S.sessions.forEach((s) => done.add(s.workoutId));
  // следующая по порядку с наименьшим числом прохождений
  const counts = ORDER.map((id) => S.sessions.filter((s) => s.workoutId === id).length);
  const min = Math.min(...counts);
  const idx = counts.indexOf(min);
  return ORDER[idx];
}

/* ================= роутинг ================= */
const app = document.getElementById("app");
const overlayRoot = document.getElementById("overlay-root");
let view = "profile";

document.querySelectorAll(".tab").forEach((t) =>
  t.addEventListener("click", () => { view = t.dataset.view; render(); })
);

function render() {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === view));
  window.scrollTo(0, 0);
  if (view === "profile") renderProfile();
  else if (view === "cycle") renderCycle();
  else if (view === "progress") renderProgress();
}

const runeSVG = `<svg viewBox="0 0 24 24"><path d="M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1z"/></svg>`;

/* ================= ПРОФИЛЬ ================= */
function renderProfile() {
  const h = heroStats();
  const ring = 2 * Math.PI * 52;
  const bw = S.hero.bodyweight;

  app.innerHTML = `
    <div class="hero-head">
      <div class="eyebrow">Кузница Тела · ${PROGRAM.cycleName}</div>
      <h1 class="display hero-name">${S.hero.name}</h1>
      <div class="hero-title">«${S.hero.title}»</div>
      <div class="level-ring">
        <svg viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(201,169,97,.15)" stroke-width="5"/>
          <circle cx="60" cy="60" r="52" fill="none" stroke="#c9a961" stroke-width="5"
            stroke-linecap="round" stroke-dasharray="${ring}" stroke-dashoffset="${ring * (1 - h.lvlProgress)}"/>
        </svg>
        <div class="lvl"><b>${h.level}</b><span>уровень</span></div>
      </div>
      <div class="dim small mono">${S.xp} XP · походов в кузницу: ${S.sessions.length}</div>
    </div>

    <div class="rune-divider">${runeSVG}</div>

    <div class="panel panel--ornate">
      <div class="eyebrow" style="margin-bottom:12px">Характеристики</div>
      <div class="statgrid">
        ${Object.entries(h.stats).map(([k, v]) => `
          <div class="stat">
            <span class="label">${k}</span>
            <span class="bar"><i style="width:${v}%"></i></span>
            <span class="val mono">${v}</span>
          </div>`).join("")}
      </div>
    </div>

    <div class="panel">
      <div class="eyebrow" style="margin-bottom:8px">Оружие героя · расчётный 1ПМ</div>
      ${Object.entries(h.lifts).map(([k, v]) => {
        const d = v.cur - v.base;
        return `<div class="kv"><span>${LIFT_NAMES[k]}</span>
          <span class="mono">${fmt(v.cur)} кг ${d > 0.5 ? `<span class="verdict-gold">+${fmt(d)}</span>` : `<span class="dim">база</span>`}</span></div>`;
      }).join("")}
      <div class="kv"><span>Вес героя</span><span class="mono">${bw} кг</span></div>
    </div>

    <div class="panel">
      <div class="eyebrow" style="margin-bottom:10px">Свиток данных</div>
      <div class="grid2">
        <button class="btn-ghost" id="btn-export">Экспорт JSON</button>
        <button class="btn-ghost" id="btn-import">Импорт JSON</button>
      </div>
      <input type="file" id="file-import" accept="application/json" hidden />
    </div>`;

  document.getElementById("btn-export").onclick = () => {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bodyupgrade-${today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const fileInput = document.getElementById("file-import");
  document.getElementById("btn-import").onclick = () => fileInput.click();
  fileInput.onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try { S = Object.assign(defaultState(), JSON.parse(rd.result)); save(); render(); }
      catch { alert("Свиток повреждён: это не JSON приложения."); }
    };
    rd.readAsText(f);
  };
}

/* ================= КУЗНИЦА (цикл) ================= */
function renderCycle() {
  const nextId = nextWorkoutId();
  app.innerHTML = `
    <div class="eyebrow">Кузница · план-факт</div>
    <h1 class="display">Путь цикла</h1>
    <p class="dim small" style="margin-top:4px">3 похода в неделю. Порядок 1→12 не ломать — чередование верх/низ хранит само себя.</p>
    ${PROGRAM.weeks.map((wk) => `
      <div class="week-block">
        <div class="week-tag ${wk.type === "объёмная" ? "vol" : ""}">
          <span class="dot"></span> Неделя ${wk.n} — ${wk.type} · ${wk.pattern}
        </div>
        ${wk.workouts.map((w) => {
          const done = S.sessions.filter((s) => s.workoutId === w.id);
          const last = done[done.length - 1];
          const isNext = w.id === nextId;
          return `
          <button class="wcard ${last ? "done" : ""}" data-w="${w.id}">
            <div class="row1">
              <span class="boss">${w.boss}${isNext ? ' <span class="verdict-gold small">◈ след.</span>' : ""}</span>
              ${last ? `<span class="verdict-chip ${last.cls}">${last.score}%</span>` : `<span class="dim small">—</span>`}
            </div>
            <div class="sub">${w.title} · ${w.exercises.length} упражнений${last ? ` · был ${fmtDate(last.date)}` : ""}</div>
          </button>`;
        }).join("")}
      </div>`).join("")}`;

  app.querySelectorAll(".wcard").forEach((c) => c.addEventListener("click", () => renderWorkout(c.dataset.w)));
}

/* ================= ЭКРАН ТРЕНИРОВКИ ================= */
function renderWorkout(wid) {
  const w = WORKOUTS[wid];
  const entries = S.drafts[wid] || {};
  // предзаполнение из последней сессии этого workout
  const lastSession = [...S.sessions].reverse().find((s) => s.workoutId === wid);

  app.innerHTML = `
    <div class="topbar">
      <button class="back-btn" id="back"><svg viewBox="0 0 24 24"><path d="M15 4l-8 8 8 8V4z"/></svg></button>
      <div>
        <div class="eyebrow">${WEEK_OF[wid].type === "объёмная" ? "объёмная" : "силовая"} · неделя ${WEEK_OF[wid].n}</div>
        <h2 class="display">${w.boss}</h2>
        <div class="dim small">${w.title}</div>
      </div>
    </div>
    <div id="ex-list"></div>
    <button class="finish-btn" id="finish">Завершить испытание</button>`;

  document.getElementById("back").onclick = () => { view = "cycle"; render(); };

  const list = document.getElementById("ex-list");
  w.exercises.forEach((ex, i) => {
    const el = document.createElement("div");
    el.className = `ex ${ex.main ? "main-ex" : ""}`;
    const saved = entries[ex.id] || [];
    el.innerHTML = `
      <button class="ex-head" aria-expanded="false">
        <span>
          <span class="name">${ex.name}</span>${ex.main ? ' <span class="main-badge">движение дня</span>' : ""}
          <div class="plan">План: ${ex.scheme} · ${ex.wNote || `${fmt(ex.w[0])}${ex.w[1] !== ex.w[0] ? "–" + fmt(ex.w[1]) : ""} кг`}</div>
        </span>
        <span class="ex-status ${saved.length ? "ok" : ""}">${saved.length ? saved.length + " подх." : "0 / " + ex.sets}</span>
      </button>
      <div class="ex-body">
        <div class="set-labels"><span>#</span><span>Вес, кг</span><span>Повторы</span><span></span></div>
        <div class="sets"></div>
        <button class="add-set">+ подход</button>
      </div>`;
    list.appendChild(el);

    const head = el.querySelector(".ex-head");
    head.onclick = () => {
      const open = el.classList.toggle("open");
      head.setAttribute("aria-expanded", open);
    };

    const setsBox = el.querySelector(".sets");
    const status = el.querySelector(".ex-status");

    function ensure(id) { if (!S.drafts[wid]) S.drafts[wid] = {}; if (!S.drafts[wid][id]) S.drafts[wid][id] = []; return S.drafts[wid][id]; }

    function drawSets() {
      const arr = ensure(ex.id);
      setsBox.innerHTML = "";
      arr.forEach((s, si) => {
        const row = document.createElement("div");
        row.className = "set-row";
        row.innerHTML = `
          <span class="idx mono">${si + 1}</span>
          <input inputmode="decimal" placeholder="${placeholderW(si)}" value="${s.w || ""}" aria-label="вес" />
          <input inputmode="numeric" placeholder="${ex.reps[0]}–${ex.reps[1]}" value="${s.r || ""}" aria-label="повторы" />
          <button class="del" aria-label="удалить">✕</button>`;
        const [wi, ri] = row.querySelectorAll("input");
        wi.oninput = () => { s.w = parseFloat(wi.value.replace(",", ".")) || 0; save(); upd(); };
        ri.oninput = () => { s.r = parseInt(ri.value) || 0; save(); upd(); };
        row.querySelector(".del").onclick = () => { arr.splice(si, 1); save(); drawSets(); upd(); };
        setsBox.appendChild(row);
      });
    }
    function placeholderW(si) {
      // подсказка: прошлый раз или нижняя граница вилки
      const prev = lastSession?.entries?.[ex.id]?.[si]?.w;
      return prev || ex.w[0] || "";
    }
    function upd() {
      const n = ensure(ex.id).filter((s) => s.w && s.r).length;
      status.textContent = n ? `${n} / ${ex.sets}` : `0 / ${ex.sets}`;
      status.classList.toggle("ok", n >= ex.sets);
    }
    el.querySelector(".add-set").onclick = () => {
      const arr = ensure(ex.id);
      const prevSet = arr[arr.length - 1];
      arr.push({ w: prevSet ? prevSet.w : 0, r: 0 });
      save(); drawSets(); upd();
      const inputs = setsBox.querySelectorAll(".set-row:last-child input");
      if (inputs[1]) inputs[1].focus();
    };

    drawSets(); upd();
    if (i === 0 && !saved.length) { el.classList.add("open"); head.setAttribute("aria-expanded", "true"); }
  });

  document.getElementById("finish").onclick = () => {
    const e = S.drafts[wid] || {};
    const anySets = Object.values(e).some((arr) => arr.some((s) => s.w && s.r));
    if (!anySets) { alert("Кузница пуста: запиши хотя бы один подход."); return; }
    const res = scoreSession(w, e);
    S.sessions.push({ id: crypto.randomUUID(), workoutId: wid, date: today(), verdict: res.verdict, cls: res.cls, score: res.score, xp: res.xp, entries: e });
    S.xp += res.xp;
    delete S.drafts[wid];
    save();
    showVerdict(res);
  };
}

function showVerdict(res) {
  const o = document.createElement("div");
  o.className = "overlay";
  o.innerHTML = `
    <div>
      <div class="seal"><svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="44" fill="none" stroke="${res.cls === "verdict-fail" ? "#b4543a" : "#c9a961"}" stroke-width="1.5"/>
        <path d="M50 14l9 18 20 3-14.5 14 3.5 20-18-9.5L32 69l3.5-20L21 35l20-3z"
          fill="none" stroke="${res.cls === "verdict-fail" ? "#b4543a" : "#e8cd82"}" stroke-width="1.5"/>
      </svg></div>
      <div class="v-title ${res.cls}">${res.verdict}</div>
      <div class="v-sub">${res.flavor}</div>
      <div class="v-xp">Счёт ${res.score}% · подходы ${res.doneSets}/${res.plannedSets} · +${res.xp} XP</div>
      <button class="v-close">Вернуться на путь</button>
    </div>`;
  overlayRoot.appendChild(o);
  o.querySelector(".v-close").onclick = () => { o.remove(); view = "cycle"; render(); };
}

/* ================= ХРОНИКИ (прогресс) ================= */
function renderProgress() {
  const liftSeries = {};
  Object.keys(BASELINES).forEach((k) => (liftSeries[k] = []));
  S.sessions.forEach((s) => {
    const w = WORKOUTS[s.workoutId]; if (!w) return;
    w.exercises.forEach((ex) => {
      if (!ex.lift) return;
      let best = 0;
      (s.entries[ex.id] || []).forEach(({ w: wt, r }) => { if (wt && r) best = Math.max(best, epley(wt, Math.min(r, 10))); });
      if (best) liftSeries[ex.lift].push({ date: s.date, v: best });
    });
  });

  app.innerHTML = `
    <div class="eyebrow">Хроники · рост силовых</div>
    <h1 class="display">Летопись героя</h1>
    <svg width="0" height="0"><defs><linearGradient id="goldfade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c9a961" stop-opacity=".35"/><stop offset="1" stop-color="#c9a961" stop-opacity="0"/>
    </linearGradient></defs></svg>
    <div id="charts"></div>
    <div class="rune-divider">${runeSVG}</div>
    <div class="panel">
      <div class="eyebrow" style="margin-bottom:8px">Последние походы</div>
      <div id="log"></div>
    </div>`;

  const charts = document.getElementById("charts");
  Object.entries(liftSeries).forEach(([k, arr]) => {
    const base = BASELINES[k];
    const pts = [{ date: "база", v: base }, ...arr];
    const last = pts[pts.length - 1].v;
    const d = last - base;
    const card = document.createElement("div");
    card.className = "panel chart-card";
    card.innerHTML = `
      <div class="head">
        <b>${LIFT_NAMES[k]}</b>
        <span class="delta ${d > 0.5 ? "up" : "flat"} mono">${fmt(last)} кг ${d > 0.5 ? "▲ +" + fmt(d) : ""}</span>
      </div>
      ${arr.length ? sparkline(pts.map((p) => p.v)) : `<div class="empty">Пока пусто. Первый поход в кузницу впишет сюда строку.</div>`}`;
    charts.appendChild(card);
  });

  const log = document.getElementById("log");
  const rows = [...S.sessions].reverse().slice(0, 12);
  log.innerHTML = rows.length
    ? rows.map((s) => `<div class="log-row">
        <span>${WORKOUTS[s.workoutId]?.boss || s.workoutId}</span>
        <span class="dim mono small">${fmtDate(s.date)}</span>
        <span class="${s.cls} mono">${s.score}%</span></div>`).join("")
    : `<div class="empty">Летопись чиста, странник.</div>`;
}

function sparkline(values) {
  const W = 320, H = 64, pad = 6;
  const min = Math.min(...values) * 0.98, max = Math.max(...values) * 1.02;
  const x = (i) => pad + (i * (W - 2 * pad)) / Math.max(1, values.length - 1);
  const y = (v) => H - pad - ((v - min) / Math.max(0.001, max - min)) * (H - 2 * pad);
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(values.length - 1).toFixed(1)},${H - pad} L${pad},${H - pad} Z`;
  const lastX = x(values.length - 1), lastY = y(values[values.length - 1]);
  return `<svg class="sparkline" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <path class="area" d="${area}"/><path class="line" d="${line}"/>
    <circle cx="${lastX}" cy="${lastY}" r="3"/></svg>`;
}

/* ================= старт ================= */
render();
