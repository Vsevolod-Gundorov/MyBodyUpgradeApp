// Аватарка из Телеграма: берётся только https-адрес с хостов самого Телеграма.
// Подменённые данные запуска не должны ни грузить картинку с чужого сервера
// (и раскрывать ему IP атлета), ни подсовывать javascript:/data: в разметку.
import { test } from "node:test";
import assert from "node:assert/strict";
import { safeAvatarUrl } from "../js/telegram.js";
import { avatarView } from "../js/view/profile.js";

test("адреса Телеграма проходят", () => {
  assert.equal(safeAvatarUrl("https://t.me/i/userpic/320/abc.jpg"), "https://t.me/i/userpic/320/abc.jpg");
  assert.ok(safeAvatarUrl("https://cdn4.cdn-telegram.org/file/x.jpg"));
  assert.ok(safeAvatarUrl("https://cdn5.telegram-cdn.org/file/x.jpg"));
});

test("всё остальное — нет", () => {
  for (const bad of [
    "http://t.me/i/userpic/320/abc.jpg", "javascript:alert(1)", "data:image/svg+xml,<svg onload=alert(1)>",
    "https://evil.example/x.jpg", "https://t.me.evil.example/x.jpg", "https://evilt.me/x.jpg",
    "https://user:pass@t.me/x.jpg", "https://t.me:8443/x.jpg", "//t.me/x.jpg", "", null, 42, "https://t.me/" + "a".repeat(600),
  ]) assert.equal(safeAvatarUrl(bad), null, String(bad).slice(0, 60));
});

test("в разметку адрес и инициалы попадают экранированными", () => {
  const html = avatarView({ photo: 'https://t.me/x.jpg?"><script>', name: "<img src=x onerror=alert(1)>" });
  assert.doesNotMatch(html, /<script>|<img src=x/);
  assert.match(html, /referrerpolicy="no-referrer"/, "Телеграму не уходит адрес страницы");
  assert.match(avatarView({ photo: null, name: "Всеволод Гундоров" }), /ВГ/);
});
