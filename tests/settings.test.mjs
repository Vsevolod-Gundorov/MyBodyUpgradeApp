// Настройки экрана и звука, язык интерфейса, новые достижения по питанию.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DICT, ENUM_EN, LANGS, tr } from "../data/i18n.js";
import { LEX, LEX_KEYS, PLAIN_EN, say } from "../data/theme.js";
import { ACH_BY_ID, ACH_EN, visibleAchievements } from "../data/achievements.js";
import { ACTIVITY, DIRECTIONS, EXPERIENCE, PROGRAMS } from "../data/profile.js";

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { S } = await import("../js/model/store.js");
const M = await import("../js/model/settings.js");
const { inBand } = await import("../js/model/achievements.js");

test("английский словарь не теряет ни одного ключа", () => {
  assert.deepEqual(Object.keys(DICT.en).sort(), Object.keys(DICT.ru).sort());
  for (const k of LEX_KEYS) assert.ok(k in PLAIN_EN, `нет английского для ${k}`);
  assert.deepEqual(Object.keys(LEX.plain).sort(), Object.keys(PLAIN_EN).sort());
  assert.equal(tr("xx", "settings"), "Настройки", "неизвестный язык — русский");
  assert.equal(tr("en", "нет-такого"), "нет-такого");
  assert.equal(say("plain", "tabHero", "en"), "Profile");
  assert.equal(say("saga", "tabHero", "en"), "Hero");
  assert.equal(say("saga", "pool", "ru"), "Арсенал движений", "русский не изменился");
});

test("у каждой цели, программы, образа жизни и опыта есть английское название", () => {
  for (const [group, src] of [["direction", DIRECTIONS], ["program", PROGRAMS], ["activity", ACTIVITY], ["experience", EXPERIENCE]]) {
    for (const id of Object.keys(src)) assert.ok(ENUM_EN[group][id], `${group}.${id}`);
  }
  // всё, что видно в «Чистой», переведено
  for (const a of visibleAchievements("plain")) assert.ok(ACH_EN[a.id], `достижение ${a.id} без перевода`);
});

test("настройки: мусор из журнала не ломает экран", () => {
  S.settings = { lang: "de", brightness: "9999", uiSize: "giant", volume: -50 };
  assert.equal(M.langNow(), "ru");
  assert.equal(M.brightnessNow(), 130, "ярче 130% — уже засвет");
  assert.equal(M.sizeNow(), "m");
  assert.equal(M.volumeNow(), 0);
  S.settings = { brightness: "abc", volume: null };
  assert.equal(M.brightnessNow(), 100);
  assert.equal(M.volumeNow(), 70, "не задано — прежняя громкость");
  M.setBrightness(10); assert.equal(M.brightnessNow(), 60, "темнее 60% — уже не видно");
  M.setLang("en"); assert.equal(M.langNow(), "en"); M.setLang("<script>"); assert.equal(M.langNow(), "en");
  M.setSize("xl"); assert.equal(M.displayNow().zoom, 1.2);
  assert.deepEqual(JSON.parse(localStorage.getItem(M.DISPLAY_KEY)), { lang: "en", zoom: 1.2, bright: 60 }, "копия для запуска без мигания");
  assert.equal(M.T("settings"), "Settings");
  M.setLang("ru");
  assert.ok(Object.keys(LANGS).length === 2);
});

test("жиры и углеводы в норме: ±15%, на кето — только «не больше»", () => {
  assert.ok(inBand(84, 84) && inBand(72, 84) && inBand(96, 84));
  assert.ok(!inBand(70, 84) && !inBand(100, 84));
  assert.ok(inBand(10, 30, true), "кето: 10 г углеводов при норме 30 — в цели");
  assert.ok(!inBand(40, 30, true));
  assert.ok(!inBand(5, 0), "без нормы — не в цели");
  for (const id of ["kcal1", "fat30", "carbs7", "fiber30", "water7"]) assert.ok(ACH_BY_ID[id], id);
});
