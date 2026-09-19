// Перенос журнала между браузером и Telegram: node --test tests/transfer.test.mjs
// Главное требование: перенос не имеет права ничего потерять или задвоить.
import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeTransfer, decodeTransfer, mergeState } from "../js/transfer.js";

const session = (id, date, xp = 100, sets = 3) => ({
  id, workoutId: "w1u", date, at: `${date}T10:00:00.000Z`, score: 90, xp,
  entries: { bench: Array.from({ length: sets }, () => ({ w: 80, r: 8 })) },
});

const browserState = () => ({
  hero: { name: "Всеволод", title: "Одинокий Гриндер", bodyweight: 93 },
  xp: 300,
  sessions: [session("a", "2026-08-01"), session("b", "2026-08-04"), session("c", "2026-08-07")],
  achievements: {
    "first-blood": { count: 1, first: "2026-08-01", last: "2026-08-01", log: [{ date: "2026-08-01", note: "первый квест" }] },
    tonnage: { count: 3, first: "2026-08-01", last: "2026-08-07", log: [{ date: "2026-08-07", note: "8.2 т" }] },
  },
  nutrition: { log: { "2026-08-01": { items: [{ n: "рис", g: 200 }], water: 2 } }, recent: [], foodStats: { rice: { food: { n: "рис" }, count: 4, last: "2026-08-01" } } },
  buffs: { active: { creatine: 10 }, custom: [{ id: "cust1", name: "Своё" }], stock: { creatine: 40 }, log: { "2026-08-01": { "creatine@am": true } } },
  plan: { w1u: { swap: { squat: "legpress" } } },
  settings: { sound: false, haptics: true, offSearch: true },
  cycleStart: 2,
  meta: { exports: 2, imports: 0 },
  rev: 41,
});

test("код переноса переживает упаковку и распаковку", async () => {
  const json = JSON.stringify(browserState());
  const code = await encodeTransfer(json);
  assert.match(code, /^BU[01]\./, "код должен быть узнаваем по началу");
  assert.ok(!/[^A-Za-z0-9._-]/.test(code), "в коде только символы, которые переживут мессенджер");
  assert.equal(await decodeTransfer(code), json);
});

test("код сжимается и терпит переносы строк из чата", async () => {
  const json = JSON.stringify(browserState());
  const code = await encodeTransfer(json);
  assert.ok(code.length < json.length, `код (${code.length}) должен быть короче журнала (${json.length})`);
  const mangled = code.match(/.{1,60}/g).join("\n") + "\n ";
  assert.equal(await decodeTransfer(mangled), json);
});

test("чужая строка отвергается понятной ошибкой", async () => {
  await assert.rejects(() => decodeTransfer("просто текст"), /код переноса/);
  await assert.rejects(() => decodeTransfer(""), /код переноса/);
});

test("перенос в пустой журнал забирает всё", () => {
  const { state, stats } = mergeState({ sessions: [], achievements: {} }, browserState());
  assert.equal(state.sessions.length, 3);
  assert.equal(stats.sessions, 3);
  assert.equal(state.xp, 300, "опыт пересчитан по квестам");
  assert.equal(state.hero.bodyweight, 93, "в пустой журнал переезжает и герой");
  assert.equal(state.cycleStart, 2);
  assert.deepEqual(state.plan.w1u.swap, { squat: "legpress" });
  assert.equal(state.buffs.active.creatine, 10);
  assert.equal(Object.keys(state.achievements).length, 2);
});

test("повторный перенос того же кода ничего не задваивает", () => {
  const first = mergeState({ sessions: [] }, browserState()).state;
  const { state, stats } = mergeState(first, browserState());
  assert.equal(state.sessions.length, 3, "квесты опознаются по id");
  assert.equal(stats.sessions, 0);
  assert.equal(state.xp, 300, "опыт не удваивается");
  assert.equal(state.achievements.tonnage.count, 3, "счётчик повторов не складывается");
  assert.equal(state.achievements.tonnage.log.length, 1, "причины повторов не дублируются");
});

test("свежие тренировки в Telegram не затираются переносом из браузера", () => {
  const local = {
    sessions: [session("tg1", "2026-09-10", 120)],
    achievements: { tonnage: { count: 5, first: "2026-09-10", last: "2026-09-10", log: [{ date: "2026-09-10", note: "9 т" }] } },
    hero: { name: "Гриндер", bodyweight: 95 },
    settings: { sound: true, haptics: false, offSearch: false },
    plan: { w2l: { add: ["curl"] } },
    buffs: { stock: { creatine: 10 } },
    rev: 7,
  };
  const { state } = mergeState(local, browserState());
  assert.equal(state.sessions.length, 4, "свой квест остался, три пришли");
  assert.equal(state.xp, 420);
  assert.deepEqual(state.sessions.map((s) => s.id), ["a", "b", "c", "tg1"], "история идёт по датам");
  assert.equal(state.hero.bodyweight, 95, "актуальный вес — из того журнала, в который переносим");
  assert.equal(state.settings.offSearch, false, "настройки приватности не откатываются");
  assert.deepEqual(state.plan, { w1u: { swap: { squat: "legpress" } }, w2l: { add: ["curl"] } });
  assert.equal(state.buffs.stock.creatine, 10, "остаток баффов — текущий, а не из прошлой копии");
  assert.equal(state.achievements.tonnage.count, 5);
  assert.equal(state.achievements.tonnage.first, "2026-08-01", "первая дата — самая ранняя из двух");
  assert.equal(state.achievements.tonnage.last, "2026-09-10");
  assert.equal(state.achievements.tonnage.log.length, 2, "причины повторов слиты");
});

test("незаполненная копия квеста не вытесняет заполненную", () => {
  const rich = { sessions: [session("a", "2026-08-01", 100, 5)] };
  const poor = { sessions: [session("a", "2026-08-01", 100, 0)] };
  assert.equal(Object.values(mergeState(rich, poor).state.sessions[0].entries.bench).length, 5);
  assert.equal(Object.values(mergeState(poor, rich).state.sessions[0].entries.bench).length, 5);
});

test("дневники питания и баффов сливаются по дням", () => {
  const local = {
    sessions: [session("tg1", "2026-09-10")],
    nutrition: { log: { "2026-09-10": { items: [{ n: "творог", g: 300 }], water: 3 } } },
    buffs: { log: { "2026-09-10": { "creatine@am": true } } },
  };
  const { state, stats } = mergeState(local, browserState());
  assert.deepEqual(Object.keys(state.nutrition.log).sort(), ["2026-08-01", "2026-09-10"]);
  assert.equal(stats.nutritionDays, 1);
  assert.equal(state.nutrition.foodStats.rice.count, 4);
  assert.deepEqual(Object.keys(state.buffs.log).sort(), ["2026-08-01", "2026-09-10"]);
  assert.equal(stats.buffDays, 1);
});

test("подробный день питания выигрывает у пустого", () => {
  const detailed = { nutrition: { log: { "2026-08-01": { items: [{ n: "рис" }, { n: "курица" }] } } } };
  const thin = { nutrition: { log: { "2026-08-01": { items: [] } } } };
  assert.equal(mergeState(thin, detailed).state.nutrition.log["2026-08-01"].items.length, 2);
  assert.equal(mergeState(detailed, thin).state.nutrition.log["2026-08-01"].items.length, 2);
});

test("слияние не портится на мусоре и пустоте", () => {
  for (const bad of [null, undefined, {}, { sessions: "нет" }, { achievements: 5 }]) {
    const { state } = mergeState(bad, browserState());
    assert.equal(state.sessions.length, 3);
    const back = mergeState(browserState(), bad);
    assert.equal(back.state.sessions.length, 3);
    assert.equal(back.state.xp, 300);
  }
});

test("счётчик импортов растёт, ревизия не откатывается назад", () => {
  const { state } = mergeState({ sessions: [], meta: { exports: 1, imports: 3 }, rev: 9 }, browserState());
  assert.equal(state.meta.imports, 4);
  assert.equal(state.meta.exports, 3);
  assert.ok(state.rev >= 41, "ревизия не должна уехать назад после переноса");
});

test("полный путь: код из браузера разворачивается в журнал Telegram", async () => {
  const code = await encodeTransfer(JSON.stringify(browserState()));
  const { state, stats } = mergeState({ sessions: [], hero: { name: "Герой" } }, JSON.parse(await decodeTransfer(code)));
  assert.equal(stats.sessions, 3);
  assert.equal(state.xp, 300);
  assert.equal(state.hero.name, "Всеволод");
});
