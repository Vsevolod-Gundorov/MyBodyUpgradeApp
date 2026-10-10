// Сквозная проверка вкладки питания в браузере: каталог сервера, Open Food Facts
// (подставной), предохранитель 8 поисков в минуту, экранирование, приёмы пищи.
// Сервер — tools/dev-server.mjs на живом Postgres. Не в CI: нужен браузер и база.
//
//   BASE=http://127.0.0.1:8787 BOT_TOKEN=… DATABASE_URL=… node tests/e2e/foods.mjs <outdir>
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { mkdirSync } from "node:fs";
import pg from "pg";
import { signInitData } from "../helpers/telegram-sign.mjs";

const OUT = process.argv[2] || "e2e-foods";
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || "http://127.0.0.1:8787";
const USER = { id: 700000777, username: "vsevolod214", first_name: "Всеволод" };
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "ok  " : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
await db.query("DELETE FROM users WHERE id = $1::bigint", [USER.id]);
await db.query("DELETE FROM rate_limits");
// в каталоге уже есть продукт, который кто-то ел раньше
await db.query(`INSERT INTO foods (code, name, k, p, f, cb, fb, sv) VALUES ('4607001771234', 'Творог 5% · Простоквашино', 121, 17, 5, 1.8, 0, 180)
                ON CONFLICT (code) DO NOTHING`);

const fakeSdk = (user) => `window.Telegram = { WebApp: {
  platform: "ios", version: "8.0", initData: ${JSON.stringify(signInitData({ botToken: process.env.BOT_TOKEN, user }))},
  initDataUnsafe: { user: ${JSON.stringify(user)} }, isVersionAtLeast: () => true, ready() {}, expand() {}, disableVerticalSwipes() {},
  setHeaderColor() {}, setBackgroundColor() {}, lockOrientation() {}, onEvent() {}, contentSafeAreaInset: {}, safeAreaInset: {},
  BackButton: { show() {}, hide() {} }, HapticFeedback: { impactOccurred() {}, notificationOccurred() {} },
  CloudStorage: { getItems(k, cb) { cb(null, {}); }, setItem(k, v, cb) { cb && cb(null, true); }, removeItems(k, cb) { cb && cb(null, true); } } } };`;

// подставной Open Food Facts: считаем запросы
const offQueries = [];
const OFF_PRODUCTS = [
  { code: "4600000000888", product_name: "Сырок глазированный", brands: "Б.Ю. Александров", nutriments: { "energy-kcal_100g": 407, proteins_100g: 8.5, fat_100g: 26.8, carbohydrates_100g: 32.5 } },
  { code: "4600000000555", product_name: "<img src=x onerror=window.__pwned=1>Опасный", nutriments: { "energy-kcal_100g": 100, proteins_100g: 5, fat_100g: 5, carbohydrates_100g: 8 } },
];

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.route(/telegram\.org/, (r) => r.fulfill({ contentType: "text/javascript", body: fakeSdk(USER) }));
// профиль уже заполнен — иначе первым откроется мастер знакомства
await ctx.addInitScript((id) => { const k = `bodyupgrade.v1.u${id}`; if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify({ rev: 1,
  profile: { sex: "m", birthYear: 1996, height: 180, activity: "moderate", direction: "recomp", pace: "normal", program: "balanced", custom: null, experience: "intermediate", adjust: 0, override: null, maxes: { bench: 147, squat: 170, deadlift: 195, ohp: 100 }, maxesSource: "journal", createdAt: "2026-09-01T10:00:00.000Z", updatedAt: "2026-09-01T10:00:00.000Z" }, })); }, USER.id);
await ctx.route(/openfoodfacts\.org\/cgi\/search\.pl/, (r) => {
  offQueries.push(new URL(r.request().url()).searchParams.get("search_terms"));
  r.fulfill({ contentType: "application/json", body: JSON.stringify({ products: OFF_PRODUCTS }) });
});
const page = await ctx.newPage();
const errors = [], api = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => { if (r.url().includes("/api/foods")) api.push({ method: r.method(), url: r.url(), body: r.postData() }); });
const w = (ms = 400) => page.waitForTimeout(ms);

await page.goto(BASE + "/#resources");
for (let i = 0; i < 30 && !(await page.evaluate(() => document.getElementById("sync-badge") || true)); i++) await w(200);
await w(1500);   // сверка с сервером и регистрация

/* 1. каталог сервера */
await page.click('.mh-add[data-add="breakfast"]'); await w();
await page.locator("#fs-q").pressSequentially("твор прост", { delay: 40 }); await w(700);
const names = await page.locator(".fs-name").allTextContents();
check("каталог: найден по части слов из сервера", names.some((n) => n.startsWith("Творог 5% · Простоквашино")), names.join(" | "));
check("каталог: запрос ушёл на свой /api/foods", api.some((r) => r.method === "GET" && r.url.includes("/api/foods?q=")));
const quick = await page.locator(".fs-row", { hasText: "Простоквашино" }).locator("[data-quick] span").textContent();
check("каталог: «+» предлагает порцию с упаковки", quick.trim() === "180 г", quick);
await page.screenshot({ path: `${OUT}/1-catalog.png` });

/* 2. OFF только по паузе: печатаем по букве — один запрос */
offQueries.length = 0;
await page.fill("#fs-q", "");
await page.locator("#fs-q").pressSequentially("сырок", { delay: 120 }); await w(1500);
check("OFF: один запрос на слово, а не на каждую букву", offQueries.length === 1, `${offQueries.length}: ${offQueries.join(", ")}`);
check("OFF: продукт в выдаче", (await page.locator(".fs-name").allTextContents()).some((n) => n.startsWith("Сырок глазированный")));
check("экранирование: название с HTML — просто текст", (await page.locator(".fs-list img").count()) === 0 && !(await page.evaluate(() => window.__pwned)));
check("лицензия OFF указана", (await page.locator(".fs-attr").count()) === 1);
await page.screenshot({ path: `${OUT}/2-off.png` });

/* 3. добавление продукта OFF: на сервер уходит только штрихкод */
api.length = 0;
await page.locator(".fs-row", { hasText: "Сырок глазированный" }).locator("[data-quick]").click(); await w(800);
const post = api.find((r) => r.method === "POST");
check("каталог: сервер просят перепроверить продукт — только штрихкод", post && post.body === JSON.stringify({ code: "4600000000888" }), post && post.body);
check("тост с «Отменить»", await page.locator("#fs-toast").isVisible());
await page.screenshot({ path: `${OUT}/3-added.png` });

/* 4. предохранитель: не больше 8 поисков OFF в минуту */
offQueries.length = 0;
for (let i = 0; i < 10; i++) { await page.fill("#fs-q", `продукт ${i}`); await page.press("#fs-q", "Enter"); await w(250); }
const status = await page.locator(".fs-status").allTextContents();
check("OFF: девятый и десятый поиск за минуту не ушли", offQueries.length <= 7, `${offQueries.length} новых (всего с первым — ${offQueries.length + 1})`);
check("OFF: человеку сказано, сколько ждать", status.some((s) => /ещё \d+ с/.test(s)), status.join(" | "));
await page.screenshot({ path: `${OUT}/4-limit.png` });

/* 5. итог дня: приём пищи, клетчатка и вода */
await page.click("#fs-done"); await w(800);
const st = await page.evaluate((id) => JSON.parse(localStorage.getItem(`bodyupgrade.v1.u${id}`)), USER.id);
const day = st.nutrition.log[new Date().toISOString().slice(0, 10)];
const syrok = day.items.find((i) => i.n.startsWith("Сырок"));
check("запись: приём пищи — завтрак, значения на 100 г, штрихкод", syrok && syrok.meal === "breakfast" && syrok.k === 407 && syrok.code === "4600000000888");
check("в завтраке видна запись и калории", (await page.locator('.meal[data-meal="breakfast"] .meal-item').count()) === 1);
await page.screenshot({ path: `${OUT}/5-day.png`, fullPage: true });

/* 6. журнал с записью уехал на сервер */
await w(3500);
const { rows } = await db.query("SELECT data FROM journals WHERE user_id = $1::bigint", [USER.id]);
const srvDay = rows[0] && rows[0].data.nutrition.log[new Date().toISOString().slice(0, 10)];
check("журнал на сервере с приёмом пищи", srvDay && srvDay.items.some((i) => i.meal === "breakfast" && i.n.startsWith("Сырок")));
check("ошибок на странице нет", errors.length === 0, errors.join(" | "));

await b.close(); await db.end();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} проверок пройдено`);
process.exit(failed.length ? 1 : 0);
