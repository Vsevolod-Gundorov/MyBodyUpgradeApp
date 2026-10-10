// Контроллер экрана тренировки.
import { isWarmup, moveLabel, warmupLadder } from "../../data/progression.js";
import { LIFT_NAMES, TYPE_NAMES, groupLoad, sessionLoad } from "../../data/program.js";
import { exById, setDone, similarTo } from "../../data/exercises.js";
import { activeSeconds, fmtDuration, pushTick } from "../timing.js";
import { openPairPicker, openPoolPicker, showExerciseDetail, showInfo, showMethod, showVerdict } from "./overlays.js";
import { startRest, stopRestSilent, timedSets } from "./rest.js";
import { render, setBack, setCycleSub, setView, withLoader } from "./router.js";
import { today } from "../core/format.js";
import { saferAlternatives } from "../../data/complaints.js";
import { checkAchievements } from "../model/achievements.js";
import { activeNow, answerCheck, exNote, takeNotes, toCheck } from "../model/health.js";
import { WEEK_OF, planOf, setPlan } from "../model/catalog.js";
import { markTrainingDay } from "../model/nutrition.js";
import { S, save } from "../model/store.js";
import { L, questName } from "../model/theme.js";
import { bestE1RM, feelToday, invalidateE1RM, lastDone, repZone, scoreSession, setFeelToday, smartRest, spaceFor, workoutOf } from "../model/training.js";
import { app } from "../view/dom.js";
import { fxTap } from "../view/fx.js";
import { openComplaints, openExerciseNote } from "./health.js";
import { countView, dotsView, exerciseCardView, healthBoxView, roundLabelView, roundRowView, setRowView, supersetCardView, workoutHelpView, workoutView } from "../view/workout.js";

export let questTimerId = null;         // интервал часов квеста (перерисовывается на каждый render)

export let stickWatchers = [];          // следят, прилипла ли раскрытая карточка к шапке

/* ================= ЭКРАН ТРЕНИРОВКИ ================= */
export function renderWorkout(wid) {
  const w = workoutOf(wid);
  if (!w) { setView("cycle"); render(); return; }
  const entries = S.drafts[wid] || {};
  // предзаполнение из последней сессии этого workout
  const lastSession = [...S.sessions].reverse().find((s) => s.workoutId === wid);

  // таймер квеста идёт по отметкам активности, а не с момента открытия экрана:
  // заглянуть в состав днём и потренироваться вечером — это не шестичасовая тренировка
  if (!S.questTicks) S.questTicks = {};
  if (!S.questStart) S.questStart = {};
  S.questStart[wid] = S.questStart[wid] || Date.now();   // справочно: когда квест открыли впервые

  const sl = sessionLoad(w.exercises);
  const LOAD_TXT = { low: "лёгкий", mid: "средний", high: "тяжёлый" };
  const wk = WEEK_OF[wid];
  // концентрация: какой группе в этом квесте достаётся больше всего подходов
  const gl = groupLoad(w.exercises);
  const hot = gl.filter((g) => g.level !== "low");
  app.innerHTML = workoutView({ LOAD_TXT, hot, sl, w, wk });

  document.getElementById("add-ex").onclick = () => openPoolPicker({ title: "Добавить движение", wid, exclude: w.exercises.map((x) => x.id),
    onPick: (id) => { const pl = planOf(wid); setPlan(wid, { add: [...(pl.add || []), id], hide: (pl.hide || []).filter((h) => h !== id) }); fxTap(); renderWorkout(wid); } });

  const leaveQuest = () => withLoader(() => { setView("cycle"); setCycleSub(null); render(); });
  setBack(leaveQuest);
  document.getElementById("back").onclick = leaveQuest;

  const questInfo = () => showInfo({
    title: questName(w), eyebrow: `${TYPE_NAMES[w.type]} · ${w.title}`,
    body: workoutHelpView({ LOAD_TXT, gl, hot, sl, w }),
  });
  document.getElementById("q-help").onclick = questInfo;
  const warnBadge = document.getElementById("q-warn");
  if (warnBadge) warnBadge.onclick = questInfo;
  // самочувствие пересобирает квест: от него зависят рабочий вес, число подходов и отдых
  app.querySelectorAll(".feel").forEach((b) => b.onclick = () => {
    if (b.dataset.feel === feelToday()) return;
    setFeelToday(b.dataset.feel); fxTap(); renderWorkout(wid);
  });

  // часы квеста (интервал самоочищается, когда элемент исчезает при смене экрана)
  clearInterval(questTimerId);
  const upQt = () => {
    const el = document.getElementById("quest-timer");
    if (!el) { clearInterval(questTimerId); return; }
    const b = el.querySelector("b");
    const ticks = (S.questTicks && S.questTicks[wid]) || [];
    // до первого подхода часы стоят на нуле и приглушены: тренировка ещё не началась
    if (b) b.textContent = ticks.length ? fmtDuration(activeSeconds(ticks, { now: Date.now() })) : "0:00";
    el.classList.toggle("idle", !ticks.length);
    el.title = ticks.length ? "Чистое время тренировки" : "Часы пойдут с первого подхода";
  };
  upQt();
  questTimerId = setInterval(upQt, 1000);

  // отметка работы: ставится при заполнении подходов, из них и складывается длительность
  const markActivity = () => {
    const prev = (S.questTicks && S.questTicks[wid]) || [];
    const next = pushTick(prev);
    if (next.length !== prev.length) { S.questTicks[wid] = next; save(); }
  };

  // жалобы: «как плечо?» и что сейчас облегчается
  const hb = document.getElementById("health-box");
  if (hb) {
    hb.innerHTML = healthBoxView({ check: toCheck(), active: activeNow(), today: today() });
    hb.querySelectorAll("[data-hc]").forEach((b) => b.onclick = () => {
      answerCheck(b.dataset.hc, b.dataset.ans); invalidateE1RM(); save(); fxTap(); renderWorkout(wid);
    });
    const mg = hb.querySelector("#hb-manage");
    if (mg) mg.onclick = () => openComplaints(() => renderWorkout(wid));
  }
  // замена при жалобе: сначала то, что больную зону не грузит
  const swapSuggest = (id) => {
    const sim = similarTo(id, 20);
    const act = activeNow();
    if (!act.length) return similarTo(id);
    const safe = new Set(saferAlternatives(id, act, sim.map((x) => x.id)));
    return [...sim.filter((x) => safe.has(x.id)), ...sim.filter((x) => !safe.has(x.id))].slice(0, 12);
  };

  const list = document.getElementById("ex-list");
  // высота шапки — по ней раскрытая карточка встаёт ровно под неё
  const qh = document.querySelector(".qhead");
  const headLine = qh ? Math.round(qh.getBoundingClientRect().height) : 56;
  document.documentElement.style.setProperty("--qhead-h", `${headLine}px`);
  stickWatchers.forEach((o) => o.disconnect());
  stickWatchers = [];

  // суперсет — одна сцепка: партнёры встают рядом, в общей рамке и с буквами А/Б,
  // чтобы с одного взгляда было видно, что с чем чередовать
  const groups = [];
  const placed = new Set();
  w.exercises.forEach((ex) => {
    if (placed.has(ex.id)) return;
    const pair = ex.ss ? w.exercises.filter((x) => x.ss === ex.ss) : [ex];
    pair.forEach((x) => placed.add(x.id));
    groups.push(pair);
  });

  const addCard = (ex, i, parent) => {
    const el = document.createElement("div");
    el.className = `ex ${ex.main ? "main-ex" : ""}`;
    el.dataset.ex = ex.id;
    const saved = entries[ex.id] || [];
    const src = exById(ex.id) || ex;
    // что делать: один вес на подход и коридор повторов
    const target = ex.w || 0;
    const repTxt = ex.reps[0] === ex.reps[1] ? `${ex.reps[0]}` : `${ex.reps[0]}–${ex.reps[1]}`;
    const wNoteShort = { "на каждую руку": "на руку", "на каждую ногу": "на ногу", "довесок к своему весу": "довесок" }[ex.wNote] || "";
    const floor = (ex.wp && ex.wp.floor) || 0;
    // к тяжёлой базе подходят лесенкой, к изоляции — одной ступенью, если вообще
    const heavy = src.tier === 1 || (src.cns || 0) >= 2;
    const prev = lastDone(ex);
    const mv = moveLabel(ex.wp);
    const dots = (n) => dotsView(n, ex.sets);

    el.innerHTML = exerciseCardView({ ex, floor, heavy, mv, prev, repTxt, saved, src, target, wNoteShort, note: exNote(wid, ex.id) });
    const mark = document.createElement("div");
    mark.className = "ex-mark";
    parent.appendChild(mark);
    parent.appendChild(el);
    // пока карточка на своём месте — она полная; прилипла к шапке — ужимается
    // до главного: название, цель и подходы. Иначе закреп съедает пол-экрана
    if (window.IntersectionObserver) {
      const io = new IntersectionObserver(
        ([e]) => el.classList.toggle("stuck", !e.isIntersecting),
        { rootMargin: `-${headLine + 2}px 0px 0px 0px`, threshold: 0 });
      io.observe(mark);
      stickWatchers.push(io);
    }

    const head = el.querySelector(".ex-head");
    head.onclick = () => {
      const open = !el.classList.contains("open");
      // раскрытая карточка висит под шапкой, поэтому раскрытой может быть только одна
      if (open) list.querySelectorAll(".ex.open").forEach((x) => {
        x.classList.remove("open");
        const h = x.querySelector(".ex-head"); if (h) h.setAttribute("aria-expanded", "false");
      });
      el.classList.toggle("open", open);
      head.setAttribute("aria-expanded", open);
      if (open) {
        const line = (document.querySelector(".qhead") || {}).getBoundingClientRect
          ? document.querySelector(".qhead").getBoundingClientRect().height : 56;
        const y = window.scrollY + el.getBoundingClientRect().top - line - 6;
        if (el.getBoundingClientRect().top < line + 4) window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
      }
    };

    const setsBox = el.querySelector(".sets");
    const status = el.querySelector(".ex-status");
    const dotsBox = el.querySelector(".ex-dots");

    function ensure(id) { if (!S.drafts[wid]) S.drafts[wid] = {}; if (!S.drafts[wid][id]) S.drafts[wid][id] = []; return S.drafts[wid][id]; }
    // подходы плана всегда на экране: видно, сколько осталось, и вес уже подставлен
    function slots() {
      const arr = ensure(ex.id);
      // строк ровно столько, чтобы осталось место под все рабочие подходы:
      // записал разминку — план не съелся, появилась ещё одна пустая строка
      const need = ex.sets + arr.filter(warm).length;
      while (arr.length < need) arr.push({ w: target, r: 0 });
      return arr;
    }
    const filled = (s) => setDone(s, src);
    // разминка: заметно легче рабочего веса. Слот плана не занимает, недобором не считается.
    // По виду строки разминку видно сразу по весу, в счёт идут только записанные
    const warmLook = (s) => isWarmup(s, target, spaceFor(src));
    const warm = (s) => filled(s) && warmLook(s);
    const workDone = (list) => list.filter((s) => filled(s) && !warm(s)).length;
    // попал ли подход в коридор повторов: видно сразу, не пересчитывая в уме
    const hitClass = (s) => {
      if (!filled(s)) return "";
      if (warm(s)) return "warm";                           // разминка — не про силу
      if (floor && s.w < floor) return "low";               // вес ниже пола — подход не рабочий
      return s.r >= ex.reps[1] ? "hit" : (s.r >= ex.reps[0] ? "mid" : "low");
    };

    // Строки подходов живут долго: мы их не пересоздаём, а обновляем на месте.
    // Иначе уход фокуса с поля (а он случается, как только палец коснулся соседнего)
    // сносит узел из-под этого самого пальца — тап уходит в никуда, клавиатура
    // закрывается, и её приходится вызывать заново.
    function makeRow(si) {
      const row = document.createElement("div");
      row.className = "set-row";
      row.innerHTML = setRowView({ si });
      const wi = row.querySelector(".s-w"), ri = row.querySelector(".s-r");
      const cur = () => slots()[si] || { w: 0, r: 0 };
      wi.oninput = () => {
        const s = cur();
        s.w = parseFloat(wi.value.replace(",", ".")) || 0;
        // повесил другой рабочий вес — он поедет в оставшиеся подходы. Разминочный
        // вес не тянем: иначе лесенка в первой строке обнулила бы весь план
        if (!warmLook(s)) slots().forEach((x, k) => { if (k > si && !filled(x) && !warmLook(x)) x.w = s.w; });
        markActivity(); save(); upd();
      };
      ri.oninput = () => { cur().r = parseInt(ri.value) || 0; markActivity(); save(); upd(); };
      // умный отдых: запись подхода завершена (вес и повторы заданы)
      const maybeRest = () => {
        const s = cur();
        if (filled(s) && !timedSets.has(s)) {
          timedSets.add(s);
          markActivity();
          startRest(smartRest(ex, s, ex.wp), `${ex.name} · ${repZone(s.r)}`);
        }
      };
      const done = () => { maybeRest(); drawSets(); };
      ri.onchange = done;
      wi.onchange = () => { if (cur().r > 0) done(); };
      ri.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); ri.blur(); } };
      wi.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); ri.focus(); } };
      row.querySelector(".s-clear").onclick = () => {
        const arr = slots(), s = arr[si];
        if (!s) return;
        timedSets.delete(s);
        if (si >= ex.sets) arr.splice(si, 1); else { s.w = 0; s.r = 0; }
        save(); drawSets(); upd();
      };
      return row;
    }
    function drawSets() {
      const arr = slots();
      const active = arr.findIndex((s) => !filled(s));   // первый незакрытый подход
      while (setsBox.children.length > arr.length) setsBox.lastChild.remove();
      while (setsBox.children.length < arr.length) setsBox.appendChild(makeRow(setsBox.children.length));
      let no = 0;
      arr.forEach((s, si) => {
        const isWarm = warmLook(s);
        if (!isWarm) no++;
        const row = setsBox.children[si];
        row.className = `set-row ${hitClass(s)} ${si === active ? "active" : ""} ${no > ex.sets && !isWarm ? "extra" : ""}`;
        row.querySelector(".idx").textContent = isWarm ? "≈" : no;
        const wi = row.querySelector(".s-w"), ri = row.querySelector(".s-r");
        // поле, в котором сейчас печатают, не трогаем — иначе курсор прыгает
        if (document.activeElement !== wi) {
          wi.value = s.w || (ex.bwOnly ? 0 : "");
          wi.placeholder = placeholderW(si);
        }
        if (document.activeElement !== ri) {
          ri.value = s.r || "";
          ri.placeholder = s.hint || repTxt;
        }
        row.querySelector(".s-clear").textContent = filled(s) ? "✕" : "";
      });
    }
    function placeholderW(si) {
      // подсказка: цель на сегодня, иначе прошлый раз
      const was = lastSession && lastSession.entries && lastSession.entries[ex.id] && lastSession.entries[ex.id][si];
      return target || (was && was.w) || (ex.bwOnly ? "0" : "");
    }
    function upd() {
      const n = workDone(slots());
      status.innerHTML = countView(n, ex.sets);
      status.classList.toggle("ok", n >= ex.sets);
      el.classList.toggle("done", n >= ex.sets);
      if (dotsBox) dotsBox.innerHTML = dots(n);
    }
    // разминка встаёт на место текущего подхода: лесенка 40/60/80% под тяжёлую базу,
    // одна ступень в половину рабочего — под остальное
    const warmBtn = el.querySelector(".add-warm");
    if (warmBtn) warmBtn.onclick = () => {
      const arr = slots();
      const at = arr.findIndex((s) => !filled(s));
      const step = ex.wp && ex.wp.step ? ex.wp.step : 2.5;
      const rows = heavy ? warmupLadder(target, step)
        : [{ w: Math.max(step, Math.round((target * 0.5) / step) * step), r: 0 }];
      arr.splice(at < 0 ? arr.length : at, 0, ...rows.map((x) => ({ w: x.w, r: 0, hint: x.r || 0 })));
      markActivity(); save(); drawSets(); upd();
      const row = setsBox.querySelectorAll(".set-row")[at < 0 ? arr.length - rows.length : at];
      const input = row && row.querySelector(".s-r");
      if (input) input.focus();
    };
    el.querySelector(".add-set").onclick = () => {
      const arr = slots();
      const last = [...arr].reverse().find(filled);
      arr.push({ w: last ? last.w : target, r: 0 });
      markActivity(); save(); drawSets(); upd();
      const inputs = setsBox.querySelectorAll(".set-row:last-child input");
      if (inputs[1]) inputs[1].focus();
    };

    drawSets(); upd();

    // инструменты: заменить / разбор / убрать
    el.querySelector("[data-note]").onclick = () => openExerciseNote(wid, ex, w.exercises, () => renderWorkout(wid));
    const safeBtn = el.querySelector("[data-safe]");
    if (safeBtn) safeBtn.onclick = (e) => { e.stopPropagation(); el.querySelector("[data-swap]").click(); };
    el.querySelector("[data-swap]").onclick = () => openPoolPicker({
      title: `Замена: ${ex.name}`, wid, suggest: swapSuggest(ex.id), exclude: w.exercises.map((x) => x.id),
      onPick: (id) => {
        const pl = planOf(wid);
        const orig = ex.swappedFrom || ex.id;
        const swap = { ...(pl.swap || {}) };
        if (ex.added) {                              // добавленное движение меняем прямо в списке add
          setPlan(wid, { add: (pl.add || []).map((a) => (a === ex.id ? id : a)) });
        } else {
          if (id === orig) delete swap[orig]; else swap[orig] = id;
          setPlan(wid, { swap });
        }
        fxTap(); renderWorkout(wid);
      },
    });
    el.querySelector("[data-info]").onclick = () => showExerciseDetail(ex.id, { onChange: () => renderWorkout(wid) });
    el.querySelector("[data-pair]").onclick = () => openPairPicker(wid, ex, w.exercises);
    el.querySelectorAll("[data-method]").forEach((m) => m.onclick = (e) => { e.stopPropagation(); showMethod(m.dataset.method); });
    el.querySelector("[data-drop]").onclick = () => {
      const pl = planOf(wid);
      if (ex.added) setPlan(wid, { add: (pl.add || []).filter((a) => a !== ex.id) });
      else setPlan(wid, { hide: [...(pl.hide || []), ex.swappedFrom || ex.id] });
      if (S.drafts[wid]) delete S.drafts[wid][ex.id];
      fxTap(); save(); renderWorkout(wid);
    };

    if (i === 0 && !saved.length) { el.classList.add("open"); head.setAttribute("aria-expanded", "true"); }
  };

  // Суперсет — одна карточка на пару, а не две рядом: работают их кругами,
  // и счётчик должен считать круги, а не подходы по отдельности.
  const addSuperCard = (pair, i, parent) => {
    const el = document.createElement("div");
    el.className = "ex ss-card";
    el.dataset.ex = pair.map((x) => x.id).join("+");
    const rounds = Math.max(...pair.map((x) => x.sets));
    // пара на одну группу — это двойной подход: мышца не отдыхает, и вес уже снижен
    const sameMuscle = !!pair[0].ssSameMuscle;
    const meta = pair.map((ex) => {
      const src = exById(ex.id) || ex;
      return {
        ex, src,
        target: ex.w || 0,
        floor: (ex.wp && ex.wp.floor) || 0,
        repTxt: ex.reps[0] === ex.reps[1] ? `${ex.reps[0]}` : `${ex.reps[0]}–${ex.reps[1]}`,
        note: { "на каждую руку": "на руку", "на каждую ногу": "на ногу", "довесок к своему весу": "довесок" }[ex.wNote] || "",
      };
    });
    const dots = (n) => dotsView(n, rounds);
    const filledIn = (m, s) => setDone(s, m.src);
    const warmIn = (m, s) => filledIn(m, s) && isWarmup(s, m.target, spaceFor(m.src));
    const hitIn = (m, s) => {
      if (!filledIn(m, s)) return "";
      if (warmIn(m, s)) return "warm";
      if (m.floor && s.w < m.floor) return "low";
      return s.r >= m.ex.reps[1] ? "hit" : (s.r >= m.ex.reps[0] ? "mid" : "low");
    };
    const rowsOf = (m) => {
      if (!S.drafts[wid]) S.drafts[wid] = {};
      const arr = (S.drafts[wid][m.ex.id] ||= []);
      while (arr.length < rounds) arr.push({ w: m.target, r: 0 });
      return arr;
    };
    // круг закрыт, когда оба движения пары записаны рабочим подходом
    const roundDone = (k) => meta.every((m) => { const s = rowsOf(m)[k]; return s && filledIn(m, s) && !warmIn(m, s); });
    const roundsDone = () => { let n = 0; const total = rowsOf(meta[0]).length; for (let k = 0; k < total; k++) if (roundDone(k)) n++; return n; };

    el.innerHTML = supersetCardView({ meta, pair, rounds, sameMuscle });
    parent.appendChild(el);

    const head = el.querySelector(".ex-head");
    const status = el.querySelector(".ex-status");
    const dotsBox = el.querySelector(".ex-dots");
    const roundsBox = el.querySelector(".ss-rounds");

    function upd() {
      const n = roundsDone();
      status.innerHTML = countView(n, rounds);
      status.classList.toggle("ok", n >= rounds);
      el.classList.toggle("done", n >= rounds);
      dotsBox.innerHTML = dots(n);
    }
    // Круги, как и обычные подходы, живут долго: узлы не пересоздаются, а
    // обновляются на месте — иначе тап по соседнему полю приходится на удалённый
    // узел, и клавиатура закрывается сама
    function makeRound(k) {
      const wrap = document.createElement("div");
      wrap.className = "ss-round";
      wrap.innerHTML = roundLabelView({ k });
      meta.forEach((m) => {
        const row = document.createElement("div");
        row.className = "set-row ss-row";
        row.innerHTML = roundRowView({ m });
        const wi = row.querySelector(".s-w"), ri = row.querySelector(".s-r");
        const cur = () => rowsOf(m)[k] || { w: 0, r: 0 };
        wi.oninput = () => {
          const s = cur();
          s.w = parseFloat(wi.value.replace(",", ".")) || 0;
          if (!isWarmup(s, m.target, spaceFor(m.src))) rowsOf(m).forEach((x, kk) => { if (kk > k && !filledIn(m, x) && !isWarmup(x, m.target, spaceFor(m.src))) x.w = s.w; });
          markActivity(); save(); upd();
        };
        ri.oninput = () => { cur().r = parseInt(ri.value) || 0; markActivity(); save(); upd(); };
        // отдых один на пару: он начинается, когда круг закрыт целиком
        const maybeRest = () => {
          const s = cur();
          if (!roundDone(k) || timedSets.has(s)) return;
          meta.forEach((mm) => timedSets.add(rowsOf(mm)[k]));
          markActivity();
          startRest(smartRest(m.ex, s, m.ex.wp), `круг ${k + 1} · ${meta.map((mm) => mm.ex.short || mm.ex.name).join(" + ")}`);
        };
        const done = () => { maybeRest(); draw(); };
        ri.onchange = done;
        wi.onchange = () => { if (cur().r > 0) done(); };
        ri.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); ri.blur(); } };
        wi.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); ri.focus(); } };
        row.querySelector(".s-clear").onclick = () => {
          const s = cur();
          timedSets.delete(s);
          if (k >= rounds) meta.forEach((mm) => rowsOf(mm).splice(k, 1));
          else { s.w = 0; s.r = 0; }
          save(); draw(); upd();
        };
        wrap.appendChild(row);
      });
      return wrap;
    }
    function draw() {
      meta.forEach(rowsOf);
      const total = rowsOf(meta[0]).length;
      let active = 0;
      while (active < total && roundDone(active)) active++;
      while (roundsBox.children.length > total) roundsBox.lastChild.remove();
      while (roundsBox.children.length < total) roundsBox.appendChild(makeRound(roundsBox.children.length));
      for (let k = 0; k < total; k++) {
        const wrap = roundsBox.children[k];
        wrap.className = `ss-round ${roundDone(k) ? "done" : ""} ${k === active ? "active" : ""}`;
        wrap.querySelector(".ssr-l i").textContent = roundDone(k) ? "✓" : "";
        meta.forEach((m, j) => {
          const s = rowsOf(m)[k];
          const row = wrap.querySelectorAll(".set-row")[j];
          row.className = `set-row ss-row ${hitIn(m, s)}`;
          const wi = row.querySelector(".s-w"), ri = row.querySelector(".s-r");
          if (document.activeElement !== wi) {
            wi.value = s.w || (m.ex.bwOnly ? 0 : "");
            wi.placeholder = m.target || (m.ex.bwOnly ? 0 : "");
          }
          if (document.activeElement !== ri) {
            ri.value = s.r || "";
            ri.placeholder = m.repTxt;
          }
          row.querySelector(".s-clear").textContent = filledIn(m, s) ? "✕" : "";
        });
      }
    }

    head.onclick = () => {
      const open = !el.classList.contains("open");
      if (open) list.querySelectorAll(".ex.open").forEach((x) => {
        x.classList.remove("open");
        const h = x.querySelector(".ex-head"); if (h) h.setAttribute("aria-expanded", "false");
      });
      el.classList.toggle("open", open);
      head.setAttribute("aria-expanded", open);
      if (open && el.getBoundingClientRect().top < headLine + 4) {
        window.scrollTo({ top: Math.max(0, window.scrollY + el.getBoundingClientRect().top - headLine - 6), behavior: "smooth" });
      }
    };
    el.querySelector(".add-set").onclick = () => {
      meta.forEach((m) => { const arr = rowsOf(m); const last = [...arr].reverse().find((x) => filledIn(m, x)); arr.push({ w: last ? last.w : m.target, r: 0 }); });
      markActivity(); save(); draw(); upd();
    };
    el.querySelectorAll("[data-info]").forEach((b) => b.onclick = () => showExerciseDetail(b.dataset.info, { onChange: () => renderWorkout(wid) }));
    el.querySelectorAll("[data-unpair]").forEach((b) => b.onclick = () => {
      const pl = planOf(wid);
      const key = b.dataset.unpair;
      // ручную связку убираем из списка, шаблонную — помечаем разбитой
      const manual = (pl.pair || []).filter(([a, c]) => !(pair.some((x) => x.id === a) && pair.some((x) => x.id === c)));
      setPlan(wid, { pair: manual, unpair: [...new Set([...(pl.unpair || []), key])] });
      fxTap(); renderWorkout(wid);
    });
    el.querySelectorAll("[data-swap]").forEach((b) => b.onclick = () => {
      const id = b.dataset.swap;
      const cur = pair.find((x) => x.id === id);
      openPoolPicker({
        title: `Замена: ${cur.name}`, wid, suggest: swapSuggest(id), exclude: w.exercises.map((x) => x.id),
        onPick: (nid) => {
          const pl2 = planOf(wid);
          const orig = cur.swappedFrom || id;
          const swap = { ...(pl2.swap || {}) };
          if (nid === orig) delete swap[orig]; else swap[orig] = nid;
          setPlan(wid, { swap });
          fxTap(); renderWorkout(wid);
        },
      });
    });

    if (window.IntersectionObserver) {
      const mark = document.createElement("div");
      mark.className = "ex-mark";
      parent.insertBefore(mark, el);
      const io = new IntersectionObserver(([e]) => el.classList.toggle("stuck", !e.isIntersecting),
        { rootMargin: `-${headLine + 2}px 0px 0px 0px`, threshold: 0 });
      io.observe(mark);
      stickWatchers.push(io);
    }

    draw(); upd();
    if (i === 0 && !roundsDone()) { el.classList.add("open"); head.setAttribute("aria-expanded", "true"); }
  };

  let idx = 0;
  groups.forEach((pair) => {
    if (pair.length < 2) addCard(pair[0], idx++, list);
    else addSuperCard(pair, idx++, list);
  });

  // вернуть состав по умолчанию, если атлет что-то менял
  const pl = planOf(wid);
  if ((pl.hide || []).length || Object.keys(pl.swap || {}).length || (pl.add || []).length
      || (pl.pair || []).length || (pl.unpair || []).length) {
    const reset = document.createElement("button");
    reset.className = "btn-ghost reset-plan";
    reset.textContent = "↺ Вернуть состав по умолчанию";
    reset.onclick = () => { delete S.plan[wid]; save(); fxTap(); renderWorkout(wid); };
    list.appendChild(reset);
  }

  document.getElementById("finish").onclick = () => {
    // пустые слоты плана в журнал не идут: подход есть, только если он записан
    const e = {};
    for (const [id, arr] of Object.entries(S.drafts[wid] || {})) {
      const done = (arr || []).filter((s) => setDone(s, exById(id))).map(({ w: wt, r }) => ({ w: wt, r }));
      if (done.length) e[id] = done;
    }
    if (!Object.keys(e).length) { alert(L("questEmpty")); return; }
    const res = scoreSession(w, e);
    // рекорды: лучший расчётный 1ПМ по движениям квеста ДО этой сессии
    const prBefore = {};
    w.exercises.forEach((ex) => { if (ex.lift) prBefore[ex.lift] = Math.max(prBefore[ex.lift] || 0, bestE1RM(ex.lift)); });
    const firstClear = S.sessions.filter((s) => s.workoutId === wid).length === 0;
    let tonn = 0; Object.values(e).forEach((arr) => arr.forEach(({ w: wt, r }) => (tonn += (wt || 0) * (r || 0))));
    const durationSec = activeSeconds((S.questTicks && S.questTicks[wid]) || [], { now: Date.now() });
    // пауза перед этим квестом (для «Возвращения») — по дате последней сессии
    const lastDate = S.sessions.length ? [...S.sessions].sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0].date : null;
    const gapDays = lastDate ? Math.round((new Date(today() + "T00:00:00Z") - new Date(lastDate + "T00:00:00Z")) / 864e5) : 0;
    const now = new Date();
    // снимок состава: чтобы прошлый квест в «Хрониках» показывал то, что реально делалось
    // rir нужен прогрессии: по нему схемы разных недель пересчитываются друг в друга
    const snapshot = w.exercises.map((ex) => ({ id: ex.id, name: ex.name, sets: ex.sets, reps: ex.reps, rir: ex.rir, main: !!ex.main, lift: ex.lift, tier: ex.tier, role: ex.role, deload: !!ex.deload, prior: ex.prior || 0, ease: ex.ease ? ex.ease.k : 0 }));
    markTrainingDay(today());   // нормы питания на сегодня — как для дня тренировки
    S.sessions.push({ id: crypto.randomUUID(), workoutId: wid, date: today(), at: now.toISOString(), feel: feelToday(), verdict: res.verdict, cls: res.cls, score: res.score, xp: res.xp, durationSec, timing: "active", exercises: snapshot, entries: e, ...(() => { const n = takeNotes(wid); return n ? { notes: n } : {}; })() });
    S.xp += res.xp;
    invalidateE1RM();
    delete S.drafts[wid];
    if (S.questStart) delete S.questStart[wid];
    if (S.questTicks) delete S.questTicks[wid];
    clearInterval(questTimerId); stopRestSilent();
    const prAfter = {}; Object.keys(prBefore).forEach((l) => (prAfter[l] = bestE1RM(l)));
    const prLifts = Object.keys(prAfter).filter((l) => prAfter[l] > (prBefore[l] || 0) + 0.4);
    const mainEx = w.exercises.find((ex) => ex.main);
    let totalReps = 0; Object.values(e).forEach((arr) => arr.forEach(({ w: wt, r }) => { if (wt && r) totalReps += r; }));
    const prDetails = prLifts.map((l) => ({ lift: l, name: LIFT_NAMES[l] || l, before: prBefore[l] || 0, after: prAfter[l], main: !!(mainEx && mainEx.lift === l) }));
    const awarded = checkAchievements({
      type: "session",
      session: { score: res.score, doneSets: res.doneSets, plannedSets: res.plannedSets, tonn, durationSec,
        prLifts, prDetails, prMain: !!(mainEx && mainEx.lift && prLifts.includes(mainEx.lift)), firstClear,
        hour: now.getHours(), feel: feelToday(), totalReps, gapDays, workoutId: wid,
        quest: questName(w), timeStr: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
        durationStr: durationSec ? fmtDuration(durationSec) : "" },
    }, { silent: true });
    save();
    showVerdict(res, awarded, durationSec);
  };
}
