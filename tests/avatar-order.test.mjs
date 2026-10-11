// Регрессия: Telegram прислал photo_url, а его картинка не грузится (CDN Телеграма).
// Фото, которое сервер взял у бота, должно показываться поверх этой ссылки —
// иначе человек видит «Фото обновлено», а на экране по-прежнему буква.
import { test } from "node:test";
import assert from "node:assert/strict";

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
globalThis.window = { Telegram: { WebApp: { platform: "ios", initData: "", initDataUnsafe: { user: { id: 5, first_name: "В", photo_url: "https://t.me/i/userpic/320/v.jpg" } } } } };
const M = await import("../js/model/avatar.js");

test("пока сервер не ответил — ссылка Телеграма", () => {
  assert.equal(M.avatarNow(), "https://t.me/i/userpic/320/v.jpg");
});

test("фото от сервера важнее ссылки из данных запуска", () => {
  const photo = "data:image/jpeg;base64,/9j/4AAQ";
  localStorage.setItem("bodyupgrade.avatar", JSON.stringify({ uid: "5", at: Date.now(), photo }));
  assert.equal(M.avatarNow(), photo);
});

test("фото другого аккаунта на этом телефоне не показывается", () => {
  localStorage.setItem("bodyupgrade.avatar", JSON.stringify({ uid: "6", at: Date.now(), photo: "data:image/jpeg;base64,/9j/" }));
  assert.equal(M.avatarNow(), "https://t.me/i/userpic/320/v.jpg");
});
