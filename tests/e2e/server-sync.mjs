// Сквозная проверка синхронизации с сервером в настоящем браузере.
// Внутри «Telegram» — подставной SDK с честно подписанным initData; сервер — tools/dev-server.mjs
// на живом Postgres. Не в CI: нужен браузер и база.
//
//   BASE=http://127.0.0.1:8787 BOT_TOKEN=… DATABASE_URL=… [SEED=journal.json] node tests/e2e/server-sync.mjs <outdir>
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { mkdirSync, readFileSync } from "node:fs";
import pg from "pg";
import { signInitData } from "../helpers/telegram-sign.mjs";

const OUT = process.argv[2] || "e2e-out";
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || "http://127.0.0.1:8787";
const BOT = process.env.BOT_TOKEN;
const OWNER = { id: 700000214, username: "vsevolod214", first_name: "Всеволод" };
const GUEST = { id: 700000999, username: "not_invited", first_name: "Гость" };
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "ok  " : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };

const seed = process.env.SEED ? JSON.parse(readFileSync(process.env.SEED, "utf8")) : {
  hero: { name: "Всеволод", title: "Одинокий Гриндер", bodyweight: 93 }, xp: 1200, rev: 340,
  sessions: Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, workoutId: "A", date: `2026-09-${String(i + 1).padStart(2, "0")}`, verdict: "ok", entries: { squat: [{ w: 100 + i, r: 5 }] } })),
  settings: { sound: false, haptics: true, offSearch: true, theme: "plain" },
};
seed.rev = Math.max(seed.rev || 0, 340);
const SEED_SESSIONS = seed.sessions.length;

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
await db.query("DELETE FROM users WHERE id = ANY($1::bigint[])", [[OWNER.id, GUEST.id]]).catch(() => {});   // журналы и версии — каскадом
await db.query("DELETE FROM journals WHERE user_id = ANY($1::bigint[])", [[OWNER.id, GUEST.id]]).catch(() => {});
await db.query("DELETE FROM journal_versions WHERE user_id = ANY($1::bigint[])", [[OWNER.id, GUEST.id]]).catch(() => {});
await db.query("DELETE FROM rate_limits").catch(() => {});
const serverRow = async () => (await db.query("SELECT rev, data FROM journals WHERE user_id = $1::bigint", [OWNER.id])).rows[0];

// подставной Telegram: всё, чем пользуется js/telegram.js, плюс облако в памяти страницы
const fakeSdk = (user) => `
  (() => {
    const cloud = JSON.parse(sessionStorage.getItem("fakeCloud") || "{}");
    const keep = () => sessionStorage.setItem("fakeCloud", JSON.stringify(cloud));
    window.Telegram = { WebApp: {
      platform: "ios", version: "8.0", initData: ${JSON.stringify(signInitData({ botToken: BOT, user }))},
      initDataUnsafe: { user: ${JSON.stringify(user)} },
      isVersionAtLeast: () => true, ready() {}, expand() {}, disableVerticalSwipes() {}, setHeaderColor() {}, setBackgroundColor() {}, lockOrientation() {},
      onEvent() {}, contentSafeAreaInset: {}, safeAreaInset: {}, viewportStableHeight: 900,
      BackButton: { show() {}, hide() {} }, HapticFeedback: { impactOccurred() {}, notificationOccurred() {} },
      CloudStorage: {
        getItems(keys, cb) { const o = {}; keys.forEach((k) => { if (k in cloud) o[k] = cloud[k]; }); setTimeout(() => cb(null, o), 5); },
        setItem(k, v, cb) { cloud[k] = v; keep(); setTimeout(() => cb && cb(null, true), 5); },
        removeItems(keys, cb) { keys.forEach((k) => delete cloud[k]); keep(); setTimeout(() => cb && cb(null, true), 5); },
      },
    } };
  })();`;

const b = await chromium.launch();
async function device(user, { local = null, dialog = "accept" } = {}) {
  const ctx = await b.newContext({ viewport: { width: 414, height: 900 } });
  await ctx.route(/telegram\.org/, (r) => r.fulfill({ contentType: "text/javascript", body: fakeSdk(user) }));
  await ctx.route(/openfoodfacts/, (r) => r.abort());
  const page = await ctx.newPage();
  const api = [];
  page.on("request", (r) => { if (r.url().includes("/api/")) api.push({ method: r.method(), url: r.url(), auth: r.headers().authorization || "" }); });
  page.dialogs = [];
  page.on("dialog", (d) => { page.dialogs.push(d.message()); dialog === "accept" ? d.accept() : d.dismiss(); });
  if (local) await ctx.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v); }, [`bodyupgrade.v1.u${user.id}`, JSON.stringify(local)]);
  await page.goto(BASE + "/#profile");
  return { ctx, page, api };
}
const badge = (page) => page.locator("#sync-badge").textContent();
const settle = async (page, want = "синхронизировано") => {
  for (let i = 0; i < 40; i++) { if ((await badge(page)) === want) return true; await page.waitForTimeout(250); }
  return false;
};
const shot = (page, name) => page.locator("#sync-badge").locator("xpath=ancestor::div[contains(concat(' ',normalize-space(@class),' '),' panel ')][1]").screenshot({ path: `${OUT}/${name}` });
const local = (page, id) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), `bodyupgrade.v1.u${id}`);

/* 1. Первый запуск у владельца: журнал с телефона переезжает на сервер */
const d1 = await device(OWNER, { local: seed });
check("переезд: статус «синхронизировано»", await settle(d1.page));
let row = await serverRow();
check("переезд: журнал на сервере", !!row && row.data.sessions.length === SEED_SESSIONS, row ? `${row.data.sessions.length} тренировок, rev ${row.rev}` : "нет строки");
const ver = (await db.query("SELECT reason FROM journal_versions WHERE user_id = $1::bigint ORDER BY id LIMIT 1", [OWNER.id])).rows[0];
check("переезд: помечен в истории версий", ver && ver.reason === "migrate");
const pre = await d1.page.evaluate((k) => localStorage.getItem(k), `bodyupgrade.v1.u${OWNER.id}.before-server`);
check("переезд: копия журнала «до» осталась на устройстве", !!pre && JSON.parse(pre).sessions.length === SEED_SESSIONS);
check("подпись уходит только на свой /api/", d1.api.length > 0 && d1.api.every((r) => r.url.startsWith(BASE + "/api/") && r.auth.startsWith("tma ")));
check("на сервере нет служебных отметок устройства", row && row.data.sync === undefined);
await shot(d1.page, "1-migrated.png");

/* 2. Второе устройство того же человека: журнал приезжает сам, без вопросов */
const d2 = await device(OWNER);
check("второе устройство: синхронизировано", await settle(d2.page));
const l2 = await local(d2.page, OWNER.id);
check("второе устройство: журнал с сервера", l2.sessions.length === SEED_SESSIONS && d2.page.dialogs.length === 0, `${l2.sessions.length} тренировок, вопросов: ${d2.page.dialogs.length}`);
await shot(d2.page, "2-second-device.png");

/* 3. Правка на втором устройстве уезжает на сервер */
await d2.page.click("#edit-bw");
await d2.page.fill("#bw-in", "91.5");
await d2.page.click("#bw-save");
await settle(d2.page, "сохраняю…");
check("правка: отправлена", await settle(d2.page));
row = await serverRow();
check("правка: вес 91.5 на сервере", row.data.hero.bodyweight === 91.5, `rev ${row.rev}`);

/* 4. Первое устройство при следующем открытии забирает правку */
await d1.page.reload();
await settle(d1.page);
const l1 = await local(d1.page, OWNER.id);
check("первое устройство: правка приехала", l1.hero.bodyweight === 91.5 && d1.page.dialogs.length === 0);

/* 5. Конфликт: оба меняли, пока одно было без сети */
await d1.ctx.route(/\/api\//, (r) => r.abort());
await d1.page.evaluate(() => { document.getElementById("edit-bw").click(); });
await d1.page.fill("#bw-in", "90");
await d1.page.click("#bw-save");
check("без сети: статус честный, журнал на устройстве", await settle(d1.page, "нет сети · сохранено здесь"));
await shot(d1.page, "3-offline.png");
await d2.page.click("#edit-bw");
await d2.page.fill("#bw-in", "92");
await d2.page.click("#bw-save");
await settle(d2.page, "сохраняю…"); await settle(d2.page);
await d1.ctx.unroute(/\/api\//);
await d1.page.reload();
await settle(d1.page);
check("конфликт: человека спросили", d1.page.dialogs.some((m) => /и на этом устройстве, и на другом/.test(m)));
const l1c = await local(d1.page, OWNER.id);
check("конфликт: взята версия с сервера (OK)", l1c.hero.bodyweight === 92);
const bak = await d1.page.evaluate((k) => localStorage.getItem(k), `bodyupgrade.v1.u${OWNER.id}.before-pull`);
check("конфликт: своя версия сохранена резервной копией", !!bak && JSON.parse(bak).hero.bodyweight === 90);

/* 6. Новый человек. Без ALLOWED_USERS — заводится в базе сам при первом запуске;
      со списком и не в нём — сервер не пускает, приложение работает как раньше */
const open = !process.env.ALLOWED_USERS;
const g = await device(GUEST, { local: { ...seed, hero: { ...seed.hero, name: "Гость" } } });
const gUser = async () => (await db.query("SELECT username FROM users WHERE id = $1::bigint", [GUEST.id])).rows;
const gRow = async () => (await db.query("SELECT 1 FROM journals WHERE user_id = $1::bigint", [GUEST.id])).rows;
if (open) {
  check("новый: синхронизировано", await settle(g.page));
  check("новый: сам завёлся в базе при запуске", (await gUser()).length === 1 && (await gUser())[0].username === GUEST.username);
  check("новый: его журнал на сервере", (await gRow()).length === 1);
  await shot(g.page, "4-new-user.png");
} else {
  check("гость: «нет доступа к серверу»", await settle(g.page, "нет доступа к серверу"));
  check("гость: в базе его нет", (await gUser()).length === 0 && (await gRow()).length === 0);
  await shot(g.page, "4-not-invited.png");
}
const gl = await local(g.page, GUEST.id);
check("журнал на устройстве цел", gl.sessions.length === SEED_SESSIONS);

/* 7. Обычный браузер без Telegram — ни одного запроса к серверу */
const plainCtx = await b.newContext({ viewport: { width: 414, height: 900 } });
await plainCtx.route(/telegram\.org/, (r) => r.abort());
const plain = await plainCtx.newPage();
const plainApi = [];
plain.on("request", (r) => { if (r.url().includes("/api/")) plainApi.push(r.url()); });
await plain.goto(BASE + "/#profile");
await plain.waitForTimeout(1500);
check("вне Telegram: к серверу не обращается", plainApi.length === 0);

/* 8. Подделка: чужой initData со страницы не проходит */
const forged = await d1.page.evaluate(async () => (await fetch("/api/journal", { headers: { authorization: "tma user=%7B%22id%22%3A1%7D&auth_date=1&hash=" + "a".repeat(64) } })).status);
check("подделанная подпись — 401", forged === 401);
const health = await d1.page.evaluate(async () => (await fetch("/api/health")).json());
check("/api/health: rls", health.ok === true && health.rls === true, JSON.stringify(health));

await b.close();
await db.end();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} проверок пройдено`);
process.exit(failed.length ? 1 : 0);
