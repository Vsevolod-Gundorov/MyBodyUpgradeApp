// Две темы оформления: node --test tests/theme.test.mjs
// Главное, что здесь защищается: вторая тема не теряет слов и иконок.
// Пропущенный ключ словаря или имя иконки не роняют приложение — они тихо
// подставляют фэнтезийный вариант, и «Чистая» превращается вполусагу. Ловим тестом.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { THEMES, THEME_ORDER, DEFAULT_THEME, themeOf, say, LEX, LEX_KEYS } from "../data/theme.js";
import { PLAIN_ICONS, PLAIN_VB } from "../data/icons-plain.js";
import { GAME_ICONS } from "../data/icons.js";
import { ACHIEVEMENTS } from "../data/achievements.js";
import { PROGRAM, ARCHIVED_WORKOUTS } from "../data/program.js";

test("тем ровно две, обе описаны полностью", () => {
  assert.deepEqual(THEME_ORDER, Object.keys(THEMES));
  assert.ok(THEMES[DEFAULT_THEME], "тема по умолчанию должна существовать");
  assert.equal(DEFAULT_THEME, "saga", "по умолчанию остаётся исходное оформление");
  for (const id of THEME_ORDER) {
    const t = THEMES[id];
    assert.equal(t.id, id, `${id}: id не совпадает с ключом`);
    assert.ok(t.name && t.note, `${id}: нет названия или описания`);
    assert.ok(/^#[0-9a-f]{6}$/i.test(t.color), `${id}: цвет строки состояния должен быть hex`);
    assert.equal(t.swatch.length, 4, `${id}: в образце четыре цвета`);
    t.swatch.forEach((c) => assert.ok(/^#[0-9a-f]{6}$/i.test(c), `${id}: плохой цвет ${c}`));
    assert.ok(["game", "line"].includes(t.iconSet), `${id}: неизвестный набор иконок`);
  }
  assert.equal(themeOf("чего-то нет").id, DEFAULT_THEME, "неизвестная тема откатывается к исходной");
});

test("словарь: ни один ключ не потерян ни в одной теме", () => {
  for (const id of THEME_ORDER) {
    for (const k of LEX_KEYS) {
      assert.ok(LEX[id] && LEX[id][k] != null, `${id}: нет ключа ${k}`);
      assert.ok(String(LEX[id][k]).trim().length, `${id}/${k}: пустая строка`);
    }
    // лишних ключей тоже быть не должно: это опечатка, которая никогда не сработает
    for (const k of Object.keys(LEX[id])) {
      assert.ok(LEX_KEYS.includes(k), `${id}: ключ ${k} есть только здесь`);
    }
  }
});

test("say(): берёт слово темы, а неизвестное отдаёт понятным образом", () => {
  assert.equal(say("plain", "tabQuests"), "Тренировки");
  assert.equal(say("saga", "tabQuests"), "Квесты");
  assert.equal(say("нет такой темы", "tabQuests"), "Квесты", "неизвестная тема — исходный словарь");
  assert.equal(say("plain", "нет-такого-ключа"), "нет-такого-ключа", "неизвестный ключ виден на экране, а не падает");
});

test("в «Чистой» не остаётся фэнтезийных слов", () => {
  const BAD = /квест|босс|сага|герой|геро[ия]|руна|руны|клинок|врат|знак отличия|знаки отличия|арсенал/i;
  for (const [k, v] of Object.entries(LEX.plain)) {
    assert.ok(!BAD.test(v), `plain/${k}: «${v}» — это из саги`);
  }
  // и наоборот: исходная тема остаётся собой
  assert.match(LEX.saga.tabQuests, /Квесты/);
});

test("штриховой набор: валидные фрагменты SVG без вложенного <svg>", () => {
  assert.match(PLAIN_VB, /^0 0 \d+ \d+$/);
  const names = Object.keys(PLAIN_ICONS);
  assert.ok(names.length >= 100, `иконок всего ${names.length}`);
  for (const [k, v] of Object.entries(PLAIN_ICONS)) {
    assert.ok(v && v.length > 10, `${k}: пустая иконка`);
    assert.ok(!/<svg|<\/svg>/.test(v), `${k}: внутрь попал целый <svg>`);
    assert.ok(!/<!--/.test(v), `${k}: внутрь попал комментарий`);
    assert.ok(/^<(path|circle|rect|line|polyline|polygon|ellipse|g)\b/.test(v), `${k}: не похоже на фигуру — ${v.slice(0, 30)}`);
    assert.ok(!/fill="(?!none)/.test(v), `${k}: у штриховой иконки не должно быть заливки`);
  }
});

test("все иконки, которые приложение реально рисует, есть в обоих наборах", () => {
  const used = new Set();
  // иконки квестов текущего цикла и архива
  PROGRAM.weeks.forEach((wk) => wk.workouts.forEach((w) => used.add(w.icon || "anvil")));
  (ARCHIVED_WORKOUTS || []).forEach((w) => used.add(w.icon || "anvil"));
  // иконки достижений
  ACHIEVEMENTS.forEach((a) => used.add(a.icon));
  // иконки вкладок — из разметки, чтобы тест ловил и правку index.html
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  for (const m of html.matchAll(/data-icon="([^"]+)"/g)) used.add(m[1]);

  const missing = [...used].filter((n) => !PLAIN_ICONS[n]);
  assert.deepEqual(missing, [], `в «Чистой» нет иконок: ${missing.join(", ")}`);
  // алиасы приложения (hammer → muscle и т.п.) тоже должны существовать в исходном наборе
  const noGame = [...used].filter((n) => !GAME_ICONS[n]);
  assert.ok(noGame.every((n) => PLAIN_ICONS[n]), `нет ни в одном наборе: ${noGame.join(", ")}`);
});

test("подключение темы: разметка и стили на месте", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /css\/theme-plain\.css/, "таблица стилей второй темы не подключена");
  assert.match(html, /bodyupgrade\.theme/, "тема должна ставиться до первой отрисовки, иначе мигает");

  const css = readFileSync(new URL("../css/theme-plain.css", import.meta.url), "utf8");
  // каждое правило обязано быть заперто внутри своей темы, иначе протечёт в «Сагу»
  const leaks = css.split("\n")
    .filter((l) => /\{\s*$/.test(l) && !l.trim().startsWith("/*"))
    .filter((l) => !/data-theme="plain"/.test(l));
  assert.deepEqual(leaks, [], `правила без привязки к теме: ${leaks.join(" | ")}`);
  for (const id of THEME_ORDER) {
    if (id === DEFAULT_THEME) continue;
    assert.ok(css.includes(`[data-theme="${id}"]`), `нет стилей темы ${id}`);
  }
});
