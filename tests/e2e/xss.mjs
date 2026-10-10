// Атакующий прогон интерфейса: журнал, где каждое поле, которое может задать человек
// или подсунуть импортированный файл, — XSS-нагрузка. Проходим все экраны и окна и
// проверяем DOM: ни одного внедрённого тега и ни одного атрибута-обработчика (on*).
// CSP и так не дала бы встроенному коду выполниться — здесь проверяется первый рубеж:
// экранирование. Запуск: BASE=http://127.0.0.1:8787 node tests/e2e/xss.mjs <папка-для-снимков>
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE || "http://127.0.0.1:8787";
const OUT = process.argv[2] || "xss-out";
mkdirSync(OUT, { recursive: true });

const X = (tag) => `<img src=x data-xss="${tag}" onerror="window.__xss.push('${tag}')"><b data-xss="${tag}">${tag}</b>`;
const A = (tag) => `x" data-xss="${tag}" onfocus="window.__xss.push('${tag}')" autofocus="`;
const iso = (d) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
const T = iso(0), Y = iso(1);

const seed = {
  hero: { name: X("hero.name"), title: X("hero.title"), bodyweight: 90 },
  xp: 500,
  settings: { theme: "plain", sound: false, haptics: false },
  profile: { sex: "m", birthYear: 1996, height: 182, activity: "moderate", direction: "cut", pace: "slow", program: "balanced", custom: null, experience: "intermediate", adjust: 0, override: null, maxes: { bench: 147, squat: 170, deadlift: 195, ohp: 100 }, maxesSource: "journal" },
  sessions: [
    { id: A("session.id"), workoutId: X("session.workoutId"), date: Y, verdict: X("session.verdict"), cls: A("session.cls"), score: 90, xp: 100,
      exercises: [{ id: "bench", name: X("snapshot.name"), sets: 3, reps: [4, 6], lift: "bench" }, { id: A("snapshot.id"), name: X("snapshot.name2"), sets: 2, reps: [8, 10] }],
      entries: { bench: [{ w: 100, r: 5 }], [A("snapshot.id")]: [{ w: 10, r: 10 }] }, notes: { bench: X("session.note") } },
  ],
  buffs: {
    active: { creatine: 5, cust1: 1 }, checkedAt: Y, stock: { creatine: 2 }, log: {},
    custom: [{ id: "cust1", name: X("buff.name"), real: X("buff.real"), unit: X("buff.unit"), cat: X("buff.cat"), effect: X("buff.effect"), hint: X("buff.hint"), icon: A("buff.icon"), dose: 1, times: ["Утро"] }],
  },
  nutrition: {
    log: {
      [Y]: { dayType: "rest", water: 0, items: [{ n: X("food.yesterday"), g: 100, amt: 100, unit: "г", k: 100, p: 5, f: 5, cb: 5, fb: 1, meal: "breakfast" }] },
      [T]: { dayType: "rest", water: 250, items: [
        { n: X("food.name"), g: 100, amt: 100, unit: X("food.unit"), k: 120, p: 10, f: 5, cb: 8, fb: 2, meal: "lunch", src: "my", id: A("food.id") },
        { n: X("food.meal"), g: 50, amt: 50, unit: "г", k: 100, p: 1, f: 1, cb: 1, meal: A("food.mealattr") }] },
    },
    recent: [],
    custom: [{ id: A("custom.id"), n: X("custom.name"), k: 100, p: 10, f: 1, cb: 5, fb: 1, src: "my", recipe: { items: [{ id: "x", n: X("recipe.item"), g: 100, k: 100, p: 1, f: 1, cb: 1, fb: 0 }], total: 100 } }],
    foodStats: { "s1": { food: { id: "s1", n: X("stats.food"), k: 50, p: 1, f: 1, cb: 1, src: "my" }, count: 3, last: Date.now(), amt: 100, unit: "г" } },
  },
  achievements: { flawless: { count: 2, first: Y, last: Y, log: [{ date: Y, note: X("ach.note") }] }, awakened: { count: 1, first: Y, last: Y, log: [{ date: Y, note: X("ach.note2") }] } },
  health: { complaints: [{ id: A("complaint.id"), area: "shoulder", level: "pain", date: iso(2), checkedAt: iso(2), exId: "bench", note: X("complaint.note"), resolvedAt: null }] },
  reminders: { supp: true, rest: false, times: { "Утро": A("reminder.time") } },
  body: { weights: [{ date: iso(10), kg: 91 }, { date: Y, kg: 90 }] },
  plan: {}, drafts: {}, meta: {}, statuses: [],
};

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.route(/telegram\.org|openfoodfacts/, (r) => r.abort());
await ctx.addInitScript(([s]) => {
  window.__xss = [];
  if (!localStorage.getItem("bodyupgrade.v1")) { localStorage.setItem("bodyupgrade.v1", s); localStorage.setItem("bodyupgrade.theme", "plain"); }
}, [JSON.stringify(seed)]);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const W = (ms = 500) => page.waitForTimeout(ms);
const found = new Map();

async function scan(where) {
  const hits = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("*")) {
      for (const a of el.attributes) if (/^on/i.test(a.name)) out.push(`${el.tagName}[${a.name}] ${el.getAttribute("data-xss") || ""}`);
      if (el.hasAttribute("data-xss")) out.push(`${el.tagName} data-xss=${el.getAttribute("data-xss")}`);
    }
    return [...out, ...window.__xss.map((t) => `executed:${t}`)];
  });
  for (const h of hits) if (!found.has(h)) found.set(h, where);
}
const tryStep = async (where, fn) => { try { await fn(); await W(); await scan(where); } catch (e) { errors.push(`${where}: ${e.message.split("\n")[0]}`); } };
const close = () => page.evaluate(() => document.querySelectorAll("#overlay-root > *").forEach((e) => e.remove()));

await page.goto(BASE + "/", { waitUntil: "domcontentloaded" }); await W(1500); await scan("start");
for (const v of ["profile", "cycle", "buffs", "resources", "progress"]) await tryStep(`tab:${v}`, () => page.click(`.tab[data-view="${v}"]`));
await tryStep("profile", () => page.click('.tab[data-view="profile"]'));
await tryStep("achievements", () => page.click("#ach-all"));
await tryStep("achievement detail", async () => { await page.locator(".ach-row").first().click(); });
await close();
await tryStep("progress", () => page.click('.tab[data-view="progress"]'));
await tryStep("session detail", () => page.locator(".log-row").first().click());
await close();
await tryStep("weight history", () => page.click("#wc-hist"));
await close();
await tryStep("lift rows", async () => { await page.fill("#lr-q", ""); for (const g of await page.locator("[data-g]").all()) await g.click(); });
await tryStep("resources", () => page.click('.tab[data-view="resources"]'));
await tryStep("portion of poisoned item", () => page.locator(".meal-item").first().click());
await close();
await tryStep("food sheet", () => page.locator(".mh-add").first().click());
await tryStep("food sheet mine", () => page.click('.fs-tab[data-tab="mine"]'));
await tryStep("food search", () => page.fill("#fs-q", "img"));
await tryStep("dish editor", async () => { await page.fill("#fs-q", ""); await page.click('.fs-tab[data-tab="mine"]'); await page.locator(".fs-row [data-open]").first().click(); });
await close();
await tryStep("buffs", () => page.click('.tab[data-view="buffs"]'));
await tryStep("buff catalog", () => page.locator(".cat-fold summary").click());
await tryStep("cycle", () => page.click('.tab[data-view="cycle"]'));
await tryStep("workout", () => page.click(".wcard.next"));
await tryStep("note sheet", async () => { if (!(await page.locator(".ex.main-ex.open").count())) await page.locator(".ex.main-ex .ex-head").click(); await page.locator(".ex.main-ex [data-note]").click(); await page.fill("#nt-text", X("typed.note")); await page.click("#nt-save"); });
await tryStep("workout after note", async () => { await page.locator(".ex-head").first().click(); });
await page.screenshot({ path: `${OUT}/xss-workout.png` });
await browser.close();

console.log(`проверено экранов: много · ошибок на странице: ${errors.length}`);
errors.forEach((e) => console.log("  ошибка:", e));
if (found.size) { console.log(`ВНЕДРЕНИЙ: ${found.size}`); for (const [h, where] of found) console.log(`  ${where}: ${h}`); process.exit(1); }
console.log("ок: ни одного внедрённого тега или обработчика");
