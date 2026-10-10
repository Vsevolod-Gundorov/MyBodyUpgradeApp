// «Чистая» редакция: старые заметки журнала получений и имена тренировок — без фэнтези.
import { test } from "node:test";
import assert from "node:assert/strict";

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { S } = await import("../js/model/store.js");
const T = await import("../js/model/theme.js");
const { ARCHIVED_WORKOUTS, archivedExName } = await import("../data/program.js");

const FANTASY = /квест|босс|Столпы|Титан|Клинок|Корни|дар судьбы|побед подряд/;

test("заметки журнала: в «Чистой» переведены, в «Саге» — как записаны", () => {
  S.settings.theme = "plain";
  assert.equal(T.plainText("10 квестов позади"), "10 тренировок");
  assert.equal(T.plainText("8,4 т · «Столпы Земли»"), "8,4 т");
  assert.equal(T.plainText("92% · «Корни Титана»"), "92%");
  assert.equal(T.plainText("5 побед подряд"), "5 подряд на 85%+");
  assert.equal(T.plainText("дар судьбы · «Клинок Титанов»"), "бонус");
  assert.equal(T.plainText("жим 150 кг · «Мой день»"), "жим 150 кг · «Мой день»", "не босс — не трогаем");
  assert.equal(T.plainText(""), "");
  S.settings.theme = "saga";
  assert.equal(T.plainText("10 квестов позади"), "10 квестов позади");
});

test("архивные тренировки в «Чистой» называются по делу, движения — по-русски", () => {
  S.settings.theme = "plain";
  for (const w of ARCHIVED_WORKOUTS) {
    const n = T.questName(w);
    assert.ok(n && !FANTASY.test(n), `${w.id}: «${n}»`);
  }
  assert.equal(archivedExName("calves"), "Икры");
  assert.equal(archivedExName("nope"), "");
});
