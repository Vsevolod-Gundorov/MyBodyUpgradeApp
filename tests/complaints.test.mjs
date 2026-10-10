// Жалобы: словарь заметок, облегчение веса, прогрессия не откатывается, «как сейчас?».
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { AREAS, AREA_ORDER, activeComplaints, easeFor, parseComplaint, saferAlternatives, stressOf } from "../data/complaints.js";
import { EXERCISES, exById } from "../data/exercises.js";
import { progressionOf } from "../data/progression.js";

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { S } = await import("../js/model/store.js");
const H = await import("../js/model/health.js");
const { addDays, today } = await import("../js/core/format.js");

test("словарь: зона и сила из живой речи", () => {
  const p = (t) => parseComplaint(t).map((x) => `${x.area}:${x.level}`).join(",");
  assert.equal(p("болело плечо на последнем подходе"), "shoulder:pain");
  assert.equal(p("Болит поясница"), "lowback:pain");
  assert.equal(p("немного ноет колено"), "knee:mild", "смягчающее слово главнее");
  assert.equal(p("тянет в пояснице и щёлкает локоть"), "lowback:mild,elbow:mild");
  assert.equal(p("прострел в спину внизу"), "lowback:pain");
  assert.equal(p("запястье неприятно"), "wrist:mild");
  assert.equal(p("шею защемило"), "neck:pain");
  assert.equal(p("тазобедренный болит"), "hip:pain");
  assert.equal(p("колено"), "knee:mild", "просто зона без слов — дискомфорт");
  assert.equal(p("отличная тренировка, всё легко"), "");
  assert.equal(p(""), "");
});

test("карта нагрузок ссылается только на существующие движения", () => {
  for (const k of AREA_ORDER) for (const id of [...AREAS[k].high, ...AREAS[k].mid]) assert.ok(exById(id), `${k}: нет движения ${id}`);
  assert.equal(stressOf("ohp", "shoulder"), 2);
  assert.equal(stressOf("bench", "shoulder"), 1);
  assert.equal(stressOf("legcurl-s", "shoulder"), 0);
});

test("облегчение: боль сильнее дискомфорта, замена — только при боли в сильно грузящем", () => {
  const pain = [{ area: "shoulder", level: "pain" }], mild = [{ area: "shoulder", level: "mild" }];
  assert.deepEqual([easeFor("ohp", pain).k, easeFor("ohp", pain).swap], [0.7, true]);
  assert.deepEqual([easeFor("bench", pain).k, easeFor("bench", pain).swap], [0.85, false]);
  assert.equal(easeFor("ohp", mild).k, 0.85);
  assert.equal(easeFor("legcurl-s", pain), null, "ноги при больном плече не трогаем");
  // две жалобы — берётся сильнейшее облегчение
  assert.equal(easeFor("squat", [{ area: "knee", level: "mild" }, { area: "lowback", level: "pain" }]).k, 0.7);
  // замены: те, что зону грузят меньше
  const alt = saferAlternatives("ohp", pain, ["db-ohp", "lat-raise", "cable-lat-raise", "machine-press"]);
  assert.ok(!alt.includes("db-ohp") && alt.includes("lat-raise"), alt.join(","));
});

test("жалоба гаснет через 21 день без подтверждения и сразу — если прошло", () => {
  const d = "2026-10-10";
  const list = [{ area: "knee", level: "mild", date: "2026-09-10", checkedAt: "2026-09-10" }, { area: "neck", level: "pain", date: "2026-10-01", checkedAt: "2026-10-01" },
    { area: "elbow", level: "pain", date: "2026-10-05", checkedAt: "2026-10-05", resolvedAt: "2026-10-08" }];
  assert.deepEqual(activeComplaints(list, d).map((c) => c.area), ["neck"]);
});

test("прогрессия: облегчённая тренировка рабочий максимум не двигает", () => {
  const plan = { sets: 3, reps: [8, 10], rir: 1 };
  const s = (date, w, r, ease = 0) => ({ date, sets: [{ w, r }, { w, r }, { w, r }], plan: { ...plan, ease } });
  const base = [s("2026-09-01", 100, 10), s("2026-09-04", 102.5, 10)];
  const normal = progressionOf(base, { reps: [8, 10], rir: 1, sets: 3 });
  const eased = progressionOf([...base, s("2026-09-08", 70, 10, 0.7)], { reps: [8, 10], rir: 1, sets: 3 });
  assert.equal(eased.move, "eased");
  assert.equal(eased.target, normal.target, "после бережной недели вес возвращается к прежнему");
  // назначенный вес при жалобе — ниже на коэффициент
  const now = progressionOf(base, { reps: [8, 10], rir: 1, sets: 3, ease: 0.7 });
  assert.ok(Math.abs(now.target - normal.target * 0.7) <= 2.5, `${now.target} vs ${normal.target}`);
  // если, несмотря на жалобу, отработал полный вес, — подход судится как обычно
  const full = progressionOf([...base, s("2026-09-08", 105, 10, 0.85)], { reps: [8, 10], rir: 1, sets: 3 });
  assert.notEqual(full.move, "eased");
});

beforeEach(() => { S.health = { complaints: [] }; S.exNotes = {}; });

test("модель: заметка с жалобой, повтор по той же зоне, «как сейчас?»", () => {
  const t = today(), y = addDays(t, -1);
  const got = H.saveExNote("w1", "ohp", "болело плечо", []);
  assert.equal(got.length, 1); assert.equal(H.exNote("w1", "ohp"), "болело плечо");
  assert.equal(H.easeToday("ohp").k, 0.7);
  // вторая заметка по той же зоне — не новая жалоба, а уточнение
  H.saveExNote("w1", "lat-raise", "плечо немного ноет", []);
  assert.equal(H.activeNow().length, 1);
  assert.equal(H.activeNow()[0].level, "pain", "сила не понижается сама — только ответом «прошло»");
  // сегодня заведено — сегодня не спрашиваем; вчерашнее — спрашиваем
  assert.equal(H.toCheck().length, 0);
  H.activeNow()[0].checkedAt = y;
  const c = H.toCheck()[0];
  assert.ok(c);
  H.answerCheck(c.id, "same");
  assert.equal(H.toCheck().length, 0, "ответил — сегодня больше не спрашиваем");
  H.answerCheck(c.id, "gone");
  assert.equal(H.activeNow().length, 0); assert.equal(H.easeToday("ohp"), null);
  // заметки тренировки уезжают в сессию
  assert.deepEqual(H.takeNotes("w1"), { ohp: "болело плечо", "lat-raise": "плечо немного ноет" });
  assert.equal(H.takeNotes("w1"), null);
});

test("каждое движение пула классифицировано хотя бы по одной зоне или безопасно для всех", () => {
  // проверка здравого смысла: тяжёлые базы точно что-то грузят
  for (const e of EXERCISES.filter((x) => x.cns >= 2)) assert.ok(AREA_ORDER.some((k) => stressOf(e.id, k) > 0), `${e.id} не грузит ни одну зону`);
});
