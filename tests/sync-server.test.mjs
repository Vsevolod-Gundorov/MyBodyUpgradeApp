// Решения синхронизации журнала с сервером: кто свежее, когда спросить, когда переносить.
import { test } from "node:test";
import assert from "node:assert/strict";

// модели нужен localStorage только при загрузке; в Node его нет — даём пустую заглушку
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { canon, decideServer, isBlank, serverPayload } = await import("../js/model/server.js");
const { defaultState } = await import("../js/model/store.js");

test("первый запуск с сервером: есть записи — переносим, пусто — нечего переносить", () => {
  assert.equal(decideServer({ rev: 500, base: null }, null), "migrate");
  assert.equal(decideServer({ rev: 0, base: null }, null), "none");
  assert.equal(decideServer({ rev: 2, base: null }, null, false, true), "none", "ревизию подняла служебная запись при запуске");
});

test("новое устройство при журнале на сервере — молча забирает, не спрашивая", () => {
  assert.equal(decideServer({ rev: 2, base: null }, { rev: 500 }, false, true), "pull");
  assert.equal(decideServer({ rev: 0, base: null }, { rev: 500 }), "pull");
});

test("обычная работа: изменения здесь — отправить, на другом устройстве — забрать, ничего — ничего", () => {
  assert.equal(decideServer({ rev: 501, base: 500 }, { rev: 500 }), "push");
  assert.equal(decideServer({ rev: 500, base: 500 }, { rev: 503 }), "pull");
  assert.equal(decideServer({ rev: 500, base: 500 }, { rev: 500 }), "none");
});

test("правки и здесь, и там — спросить; одинаковые ревизии с разным содержимым — тоже спросить", () => {
  assert.equal(decideServer({ rev: 502, base: 500 }, { rev: 501 }), "conflict");
  assert.equal(decideServer({ rev: 501, base: 500 }, { rev: 501 }), "conflict", "совпадение номеров не значит совпадение журналов");
  assert.equal(decideServer({ rev: 501, base: 500 }, { rev: 501 }, true), "none", "а вот совпадение содержимого — значит");
  assert.equal(decideServer({ rev: 300, base: null }, { rev: 500 }), "conflict", "старое устройство с данными, ещё не сверявшееся");
});

test("сравнение журналов не зависит от порядка ключей (Postgres jsonb их переставляет)", () => {
  assert.equal(canon({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: null } }), canon({ a: { c: null, d: [1, { x: 1, y: 2 }] }, b: 1 }));
  assert.notEqual(canon({ a: [1, 2] }), canon({ a: [2, 1] }));
  assert.equal(canon({ a: undefined, b: 1 }), canon({ b: 1 }));
});

test("на сервер уходит журнал без служебных отметок устройства", () => {
  const s = { ...defaultState(), rev: 7, sync: { syncedRev: 7, serverRev: 6 } };
  const p = serverPayload(s);
  assert.equal(p.sync, undefined);
  assert.equal(p.rev, 7);
  assert.deepEqual(p.hero, s.hero);
  assert.ok(isBlank(defaultState()));
  assert.ok(!isBlank({ ...defaultState(), sessions: [{ id: 1 }] }));
  assert.ok(!isBlank({ ...defaultState(), nutrition: { log: { "2026-10-01": {} } } }));
});
