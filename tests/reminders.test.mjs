// Напоминания: проверка настроек, расписание, тексты, сборка из активных добавок.
import { test } from "node:test";
import assert from "node:assert/strict";
import { REST_MAX_WAIT_SEC, buildSlots, cleanText, dueSlots, localClock, restMessage, slotKey, suppMessage, validateSettings } from "../data/reminders.js";

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { S } = await import("../js/model/store.js");
const RM = await import("../js/model/reminders.js");
const B = await import("../js/model/buffs.js");

const ok = (o) => ({ supp: true, rest: false, tz: 180, slots: [{ slot: "Утро", at: 480, items: [{ id: "creatine", text: "Креатин 5 г" }] }], ...o });

test("настройки: принимается только ожидаемое", () => {
  assert.ok(validateSettings(ok()).ok);
  const bad = [null, [], "x", { ...ok(), extra: 1 }, ok({ tz: 1.5 }), ok({ rest: 1 }), ok({ slots: {} }),
    ok({ slots: [{ slot: "Утро", at: 1440, items: [{ id: "a", text: "b" }] }] }),
    ok({ slots: [{ slot: "Утро", at: 60, items: [] }] }),
    ok({ slots: [{ slot: "Утро", at: 60, items: [{ id: "a b", text: "x" }] }] }),
    ok({ slots: [{ slot: "Утро", at: 60, items: [{ id: "a", text: "   " }] }] }),
    ok({ slots: [{ slot: "Утро", at: 60, items: [{ id: "a", text: "x" }] }, { slot: "Утро", at: 70, items: [{ id: "a", text: "x" }] }] }),
    ok({ slots: [{ slot: "До трен.", at: 60, items: [{ id: "a", text: "x" }] }] })];
  bad.forEach((b, i) => assert.equal(validateSettings(b).ok, false, `случай ${i}`));
  // длинное и с невидимыми символами — обрезается и чистится
  const v = validateSettings(ok({ slots: [{ slot: "Утро", at: 480, items: [{ id: "a", text: "x‮\u0000" + "я".repeat(200) }] }] }));
  assert.ok(v.ok); assert.equal(v.value.slots[0].items[0].text.length, 60); assert.doesNotMatch(v.value.slots[0].items[0].text, /[‮\u0000]/);
});

test("расписание: окно в час после времени слота, по местному времени", () => {
  const s = { tz_min: 180, slots: [{ slot: "Утро", at: 480, items: [{ id: "c", text: "К" }] }, { slot: "Вечер", at: 1140, items: [{ id: "c", text: "К" }] }] };
  const at = (h, m) => Date.UTC(2026, 9, 10, h - 3, m);   // местное время UTC+3
  assert.deepEqual(dueSlots(s, at(7, 59)), []);
  assert.equal(dueSlots(s, at(8, 0))[0].slot, "Утро");
  assert.equal(dueSlots(s, at(8, 59)).length, 1);
  assert.deepEqual(dueSlots(s, at(9, 0)), []);
  assert.equal(dueSlots(s, at(19, 30))[0].slot, "Вечер");
  // день меняется по местной полуночи, а не по UTC
  assert.equal(localClock(Date.UTC(2026, 9, 10, 22, 30), 180).day, "2026-10-11");
  assert.equal(slotKey("2026-10-10", "Перед сном"), "supp:2026-10-10:3");
});

test("тексты сообщений: без разметки, коротко", () => {
  const m = suppMessage("Утро", [{ text: "Креатин 5 г" }, { text: "<b>Омега</b>" }]);
  assert.match(m, /утро/); assert.match(m, /• Креатин 5 г/); assert.match(m, /<b>Омега<\/b>/, "текст как есть — Bot API без parse_mode его не разметит");
  assert.equal(restMessage(""), "⏱ Отдых закончился — пора подход");
  assert.match(restMessage("Жим · 100 кг\n\nспам"), /Жим · 100 кг спам$/, "одна строка");
  assert.equal(cleanText("a​b"), "a b");
  assert.ok(REST_MAX_WAIT_SEC + 60 < 300, "ожидание и удаление укладываются в лимит функции");
});

test("сборка расписания из активных добавок; «до/после тренировки» по часам не напоминаем", () => {
  const slots = buildSlots([
    { id: "creatine", name: "Креатин", dose: 5, unit: "г", times: ["Утро"] },
    { id: "caffeine", name: "Кофеин", dose: 150, unit: "мг", times: ["До трен."] },
    { id: "zma", name: "ZMA", dose: 1, unit: "капс", times: ["Перед сном", "Утро"] },
  ], { "Утро": "07:30" });
  assert.deepEqual(slots.map((s) => [s.slot, s.at, s.items.map((i) => i.text)]), [
    ["Утро", 450, ["Креатин 5 г", "ZMA 1 капс"]],
    ["Перед сном", 1350, ["ZMA 1 капс"]],
  ]);
});

test("клиент: что уходит на сервер и когда вкладка добавок подсвечивается", () => {
  S.buffs = { active: { creatine: 5 }, log: {}, stock: {}, custom: [] };
  S.reminders = { supp: true, rest: true, times: { "Утро": "06:00" } };
  const p = RM.reminderPayload(new Date("2026-10-10T12:00:00+03:00"));
  assert.equal(p.supp, true); assert.equal(p.rest, true);
  assert.ok(Number.isInteger(p.tz));
  assert.equal(p.slots[0].slot, "Утро"); assert.equal(p.slots[0].at, 360);
  assert.ok(validateSettings(p).ok, "клиент собирает ровно то, что сервер примет");
  // выключено — расписание не отправляется вовсе
  S.reminders.supp = false;
  assert.deepEqual(RM.reminderPayload().slots, []);
  // подсветка: время приёма прошло, а он не отмечен
  assert.equal(B.buffsActionable(new Date(2026, 9, 10, 5, 0)), false, "до 06:00 — тихо");
  assert.equal(B.buffsActionable(new Date(2026, 9, 10, 7, 0)), true);
  const day = new Date(2026, 9, 10, 7, 0);
  const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  S.buffs.log[iso] = { "creatine@Утро": true };
  // отмечено (если сегодня совпадает с днём проверки) — тихо
  if (iso === new Date().toISOString().slice(0, 10)) assert.equal(B.buffsActionable(day), false);
  // запас на исходе — подсвечиваем
  S.buffs = { active: { creatine: 5 }, log: {}, stock: { creatine: 2 }, custom: [] };
  assert.equal(B.buffsActionable(new Date(2026, 9, 10, 5, 0)), true);
  // нет активных добавок — никогда
  S.buffs = { active: {}, log: {}, stock: {}, custom: [] };
  assert.equal(B.buffsActionable(new Date(2026, 9, 10, 23, 0)), false);
});
