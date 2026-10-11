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
  assert.ok(safeAvatarUrl("https://cdn4.telesco.pe/file/x.jpg"), "CDN, на который Телеграм перенаправляет userpic");
  assert.equal(safeAvatarUrl("https://telesco.pe.evil.example/x.jpg"), null);
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

/* ---------------- сервер: фото берётся у бота, токен наружу не уходит ---------------- */
import { imageType, pickSize, userPhoto, AVATAR_MAX_BYTES } from "../server/telegram.js";

const TOKEN = "123456789:" + "A".repeat(35);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]);

function fakeBot({ photos = [[{ file_id: "s", width: 160, height: 160 }, { file_id: "b", width: 640, height: 640 }]], path = "profile_photos/file_1.jpg", body = JPEG, status = 200 } = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    const method = url.split("/").pop();
    const reply = (obj) => ({ status: 200, json: async () => obj });
    if (url.includes("/file/bot")) return { status, arrayBuffer: async () => body };
    if (method === "getUserProfilePhotos") return reply({ ok: true, result: { total_count: photos.length, photos } });
    if (method === "getFile") return reply({ ok: true, result: { file_id: JSON.parse(init.body).file_id, file_path: path } });
    return reply({ ok: false, error_code: 404 });
  };
  return { fetchImpl, calls };
}

test("тип картинки — по байтам, а не по заголовку", () => {
  assert.equal(imageType(JPEG), "image/jpeg");
  assert.equal(imageType(Buffer.from("<svg onload=alert(1)></svg>")), null);
  assert.equal(imageType(Buffer.from("<html><script>x</script></html>")), null);
});

test("размер — самый маленький от 160 px", () => {
  assert.equal(pickSize([{ file_id: "a", width: 640 }, { file_id: "b", width: 160 }, { file_id: "c", width: 320 }]).file_id, "b");
  assert.equal(pickSize([{ file_id: "a", width: 100 }]).file_id, "a", "маленькое лучше, чем ничего");
  assert.equal(pickSize([]), null);
});

test("фото приходит data:URL, своего пользователя, без лишних запросов", async () => {
  const bot = fakeBot();
  const photo = await userPhoto(TOKEN, "777", { fetchImpl: bot.fetchImpl });
  assert.match(photo, /^data:image\/jpeg;base64,/);
  assert.equal(JSON.parse(bot.calls[0].init.body).user_id, 777);
  assert.equal(JSON.parse(bot.calls[1].init.body).file_id, "s", "берём маленький размер");
  assert.equal(bot.calls.length, 3);
  assert.ok(bot.calls.every((c) => c.url.startsWith("https://api.telegram.org/")), "ходим только в Telegram");
  assert.ok(!photo.includes(TOKEN));
});

test("нет фото, подозрительный путь, не картинка, слишком большой файл — null", async () => {
  assert.equal(await userPhoto(TOKEN, "1", fakeBot({ photos: [] })), null);
  for (const path of ["../../etc/passwd", "a/../b.jpg", "x.jpg?y=1", "https://evil/x.jpg", "a b.jpg"]) {
    const bot = fakeBot({ path });
    assert.equal(await userPhoto(TOKEN, "1", bot), null, path);
    assert.equal(bot.calls.length, 2, `${path}: файл не скачивается`);
  }
  assert.equal(await userPhoto(TOKEN, "1", fakeBot({ body: Buffer.from("<svg onload=alert(1)>") })), null);
  assert.equal(await userPhoto(TOKEN, "1", fakeBot({ body: Buffer.concat([JPEG, Buffer.alloc(AVATAR_MAX_BYTES)]) })), null);
});

test("ошибка Telegram не выдаёт токен", async () => {
  const bot = fakeBot({ status: 404 });
  await assert.rejects(userPhoto(TOKEN, "1", bot), (e) => !String(e.message).includes(TOKEN) && e.code === 404);
});

/* ---------------- клиент: принимается только безопасная картинка ---------------- */
const mem = new Map();
globalThis.localStorage = globalThis.localStorage || { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { safeDataUrl, avatarOutcome } = await import("../js/model/avatar.js");
const { avatarNoteText } = await import("../js/view/profile.js");

test("от сервера берём только data:image jpeg/png/webp", () => {
  assert.ok(safeDataUrl("data:image/jpeg;base64,/9j/4AAQ=="));
  for (const bad of ["data:image/svg+xml;base64,PHN2Zz4=", "data:text/html;base64,PGI+", "javascript:alert(1)",
    "https://evil.example/x.jpg", 'data:image/jpeg;base64,AA"><script>', null, 5, "data:image/jpeg;base64," + "A".repeat(300000)]) {
    assert.equal(safeDataUrl(bad), null, String(bad).slice(0, 40));
  }
  assert.doesNotMatch(avatarView({ photo: "javascript:alert(1)", name: "X" }), /<img/, "вид сам не вставит чужую схему");
});

test("причина, почему фото нет, — понятным языком", () => {
  const ok = avatarOutcome({ status: 200, json: { photo: "data:image/jpeg;base64,/9j/" } });
  assert.equal(ok.state, "ok");
  assert.equal(avatarOutcome({ status: 200, json: { photo: null, reason: "none" } }).state, "none");
  assert.equal(avatarOutcome({ status: 0, json: null }).state, "offline");
  assert.deepEqual(avatarOutcome({ status: 502, json: { error: "telegram_unavailable", tg: 400 } }), { state: "error", code: 400 });
  assert.equal(avatarOutcome({ status: 200, json: { photo: "javascript:alert(1)" } }).state, "error", "мусор вместо картинки — сбой, а не фото");
  assert.match(avatarNoteText({ state: "none" }), /Конфиденциальность/);
  assert.match(avatarNoteText({ state: "error", code: 400 }), /код 400/);
  assert.match(avatarNoteText({ state: "error", code: "<b>" }), /код 0/, "в текст попадает только число");
});

test("сервер называет причину, если фото нет", async () => {
  const { userPhotoInfo } = await import("../server/telegram.js");
  assert.deepEqual(await userPhotoInfo(TOKEN, "1", fakeBot({ photos: [] })), { photo: null, reason: "none" });
  assert.equal((await userPhotoInfo(TOKEN, "1", fakeBot({ path: "../x" }))).reason, "path");
  assert.equal((await userPhotoInfo(TOKEN, "1", fakeBot({ body: Buffer.from("<svg>" + "x".repeat(20)) }))).reason, "type");
});
