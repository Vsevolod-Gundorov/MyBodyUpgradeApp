// Растяжка: данные программы целы, неделя засчитывается только за A и B, после разгрузки —
// цикл с недели 2, тесты пишутся по неделе цикла, кривой журнал с сервера не роняет экран.
import { test } from "node:test";
import assert from "node:assert/strict";

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { S } = await import("../js/model/store.js");
const D = await import("../data/stretch.js");
const M = await import("../js/model/stretch.js");

test("каждое упражнение: 5 дозировок по неделям, таймер — 5 положительных секунд", () => {
  const ids = new Set();
  for (const w of D.STRETCH_ORDER) for (const x of D.stretchItems(w)) {
    assert.ok(!ids.has(x.id), `id ${x.id} уникален`); ids.add(x.id);
    assert.equal(x.dose.length, 5, x.id);
    x.dose.forEach((d) => assert.ok(typeof d === "string" && d.length, x.id));
    if (x.sec) { assert.equal(x.sec.length, 5, x.id); x.sec.forEach((s) => assert.ok(Number.isInteger(s) && s > 0, x.id)); }
    assert.ok(x.cues, x.id);
  }
  assert.equal(D.stretchItems("A").length, 16);
  assert.equal(D.stretchItems("B").length, 19);
  assert.equal(D.STRETCH_WEEKS.length, D.STRETCH_CYCLE_WEEKS);
  assert.equal(D.PELVIC_DAILY.length, D.STRETCH_CYCLE_WEEKS);
  D.PELVIC_DAILY.forEach((d) => d.items.forEach(([s]) => assert.ok(D.PELVIC_SIGNS.some((p) => p.s === s), s)));
});

test("длинная статика растёт по таблице цикла: 60 → 75 → 90 → 90–120 → 60", () => {
  const pigeon = D.stretchItems("A").find((x) => x.id === "a11");
  assert.deepEqual(pigeon.sec, [60, 75, 90, 120, 60]);
  assert.match(pigeon.dose[3], /^90–120 с/);
  const couch = D.stretchItems("A").find((x) => x.id === "a8");
  assert.deepEqual(couch.sec, [90, 90, 90, 120, 60], "поза с 90 с не укорачивается");
});

test("дозировка делится на чипы", () => {
  assert.deepEqual(D.doseParts("90–120 с → PAILs 10 с → RAILs 10 с, на сторону"), ["90–120 с", "PAILs 10 с", "RAILs 10 с", "на сторону"]);
  assert.deepEqual(D.doseParts("10 качаний + 60 с"), ["10 качаний", "60 с"]);
  assert.deepEqual(D.doseParts(""), []);
});

test("видео — только поиск YouTube, запрос экранирован", () => {
  assert.equal(D.videoUrl("couch stretch PAILs RAILs"), "https://www.youtube.com/results?search_query=couch%20stretch%20PAILs%20RAILs");
  assert.equal(D.videoUrl('"><script>&x=1'), "https://www.youtube.com/results?search_query=%22%3E%3Cscript%3E%26x%3D1");
  assert.equal(D.videoUrl(""), "");
});

test("неделя: одной тренировки мало, A + B — следующая, после 5 — цикл с недели 2", () => {
  assert.deepEqual(D.nextStretchWeek({ week: 1, cycle: 1 }, new Set(["A"])), { week: 1, cycle: 1 });
  assert.deepEqual(D.nextStretchWeek({ week: 1, cycle: 1 }, new Set(["A", "B"])), { week: 2, cycle: 1 });
  assert.deepEqual(D.nextStretchWeek({ week: 5, cycle: 1 }, new Set(["A", "B"])), { week: 2, cycle: 2 });
});

test("журнал: отметки, завершение, переход недели", () => {
  S.stretch = undefined;
  assert.equal(M.stretchNow().week, 1);
  assert.equal(M.toggleMark("A", "a1"), true);
  assert.equal(M.toggleMark("A", "zz"), false, "чужой id не отмечается");
  assert.deepEqual([...M.marksOf("A")], ["a1"]);
  let r = M.finishStretch("A", "2026-10-20");
  assert.deepEqual(r, { week: 1, cycle: 1, advanced: false, left: "B" });
  assert.equal(M.marksOf("A").size, 0, "отметки сброшены");
  assert.equal(S.stretch.log[0].done, 1);
  r = M.finishStretch("A", "2026-10-21");
  assert.equal(r.advanced, false, "повтор A неделю не закрывает");
  r = M.finishStretch("B", "2026-10-22");
  assert.deepEqual(r, { week: 2, cycle: 1, advanced: true, left: null });
  assert.equal(M.doneThisWeek().size, 0, "новая неделя — пустая");
  S.stretch.week = 5;
  M.finishStretch("A"); r = M.finishStretch("B");
  assert.deepEqual([r.week, r.cycle], [2, 2]);
  assert.equal(M.finishStretch("C"), null);
});

test("кривые данные с сервера не ломают раздел", () => {
  S.stretch = { week: 99, cycle: -3, marks: { A: ["a1", "a1", "<img>", 5], B: "x" }, log: [null, { date: "bad", w: "A" }, { date: "2026-10-01", w: "Z" }, { date: "2026-10-01", w: "B", week: 3, cycle: 1 }], tests: [{ id: "fold", v: "1", date: "2026-10-01" }, { id: "fold", v: 4, date: "2026-10-01" }] };
  const st = M.stretchNow();
  assert.deepEqual([st.week, st.cycle], [1, 1]);
  assert.deepEqual(st.marks, { A: ["a1"], B: [] });
  assert.equal(st.log.length, 1);
  assert.equal(st.tests.length, 1);
  S.stretch = [];
  assert.equal(M.stretchNow().week, 1);
});

test("тесты: одна запись на неделю цикла, пределы, сдвиг с учётом «меньше — лучше»", () => {
  S.stretch = undefined;
  assert.ok(M.saveTest("fold", 12, "2026-10-01"));
  assert.ok(M.saveTest("fold", 10, "2026-10-02"));
  assert.equal(S.stretch.tests.length, 1, "повтор в ту же неделю заменяет");
  S.stretch.week = 5;
  M.saveTest("fold", 7, "2026-11-01");
  M.saveTest("squat", 9999);
  const r = M.testResults();
  assert.deepEqual(r.fold, { v: 7, prev: 10, delta: -3, better: true });
  assert.equal(r.squat.v, 300, "больше предела не записывается");
  assert.equal(M.saveTest("nope", 1), false);
  assert.equal(M.saveTest("fold", "abc"), false);
  assert.ok(M.isTestWeek(1) && M.isTestWeek(5) && !M.isTestWeek(3));
});

test("растяжка мешает тяжёлым движениям: A — присед и становая, B — жим", () => {
  const w = { exercises: [{ lift: "squat", reps: [3, 5] }, { lift: "bench", reps: [10, 12] }, { lift: "deadlift", reps: [5, 6] }] };
  assert.deepEqual(M.stretchClash(w), { A: ["squat", "deadlift"], B: [] });
  assert.deepEqual(M.stretchClash(null), { A: [], B: [] });
});
