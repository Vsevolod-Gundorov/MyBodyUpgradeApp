// Длительность тренировки: node --test tests/timing.test.mjs
// Баг, из-за которого тест существует: таймер считал от открытия квеста, и «заглянул
// днём — потренировался вечером» превращалось в шестичасовую тренировку.
import { test } from "node:test";
import assert from "node:assert/strict";
import { activeSeconds, pushTick, fmtDuration, durationTrusted, BREAK_MS } from "../js/timing.js";

const T0 = Date.UTC(2026, 8, 19, 18, 0, 0);
const min = (n) => n * 60e3;

test("считается время между подходами, а не время на экране", () => {
  // подходы каждые 3 минуты в течение получаса
  const ticks = Array.from({ length: 11 }, (_, i) => T0 + min(3 * i));
  assert.equal(activeSeconds(ticks), 30 * 60);
});

test("открыл квест днём, тренировался вечером — днёвное окно в зачёт не идёт", () => {
  const ticks = [T0, T0 + min(360), T0 + min(363), T0 + min(366)];  // заглянул, потом через 6 часов работа
  assert.equal(activeSeconds(ticks), 6 * 60, "считаем только вечерние 6 минут");
});

test("перерыв ровно на границе ещё считается, а секундой дольше — уже нет", () => {
  assert.equal(activeSeconds([T0, T0 + BREAK_MS]), BREAK_MS / 1000);
  assert.equal(activeSeconds([T0, T0 + BREAK_MS + 1000]), 0);
});

test("несколько разрывов вырезаются по отдельности", () => {
  const ticks = [
    T0, T0 + min(5), T0 + min(10),        // 10 минут работы
    T0 + min(70), T0 + min(75),           // час перерыва, потом ещё 5 минут
    T0 + min(200), T0 + min(204),         // и ещё 4 минуты после долгой паузы
  ];
  assert.equal(activeSeconds(ticks), 19 * 60);
});

test("живой таймер учитывает текущий незакрытый интервал и замирает на долгой паузе", () => {
  const ticks = [T0, T0 + min(10)];
  assert.equal(activeSeconds(ticks, { now: T0 + min(12) }), 12 * 60, "идёт отдых — время капает");
  assert.equal(activeSeconds(ticks, { now: T0 + min(40) }), 10 * 60, "ушёл на полчаса — счётчик стоит");
});

test("пустые и кривые отметки не ломают счёт", () => {
  for (const bad of [null, undefined, [], [T0], ["нет", NaN, 0, -5]]) assert.equal(activeSeconds(bad), 0);
  assert.equal(activeSeconds([T0 + min(10), T0]), 10 * 60, "порядок отметок не важен");
});

test("отметки не пишутся чаще раза в 20 секунд и не копятся без предела", () => {
  let t = pushTick([], T0);
  t = pushTick(t, T0 + 5000);
  assert.equal(t.length, 1, "набор веса в поле не должен плодить отметки");
  t = pushTick(t, T0 + 25000);
  assert.equal(t.length, 2);
  let many = [];
  for (let i = 0; i < 700; i++) many = pushTick(many, T0 + i * 30e3);
  assert.equal(many.length, 600, "список обрезается");
  assert.equal(many[many.length - 1], T0 + 699 * 30e3, "свежие отметки сохраняются");
});

test("длительность печатается по-человечески", () => {
  assert.equal(fmtDuration(0), "0:00");
  assert.equal(fmtDuration(45), "0:45");
  assert.equal(fmtDuration(4500), "1:15:00");
  assert.equal(fmtDuration(6798), "1:53:18");
  assert.equal(fmtDuration(21111), "5:51:51");
});

test("старым записям время не верим", () => {
  assert.equal(durationTrusted({ durationSec: 4500, timing: "active" }), true);
  assert.equal(durationTrusted({ durationSec: 21111 }), false, "записи до починки таймера");
  assert.equal(durationTrusted(null), false);
});

test("час работы с обычными перерывами укладывается в знак «Молниеносный»", () => {
  // 24 подхода по 2,5 минуты цикл — ровно час
  const ticks = Array.from({ length: 25 }, (_, i) => T0 + i * 150e3);
  const sec = activeSeconds(ticks);
  assert.equal(sec, 3600);
  assert.ok(sec <= 3600, "раньше сюда попадало время до прихода в зал, и знак был недостижим");
});
