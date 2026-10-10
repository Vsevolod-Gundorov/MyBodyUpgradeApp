// Эталонный прогон интерфейса: node tests/e2e/golden.mjs <папка-для-снимков>
//
// Нужен для больших перестроек кода (переход на MVC и дальше). Проходит все экраны
// и основные действия в обеих темах на ЗАМОРОЖЕННОМ времени и случайности и
// сохраняет разметку экранов и итоговый журнал. Перестройка считается чистой,
// только если снимки до и после совпадают байт в байт.
//
// Не входит в обычный `node --test tests/*.mjs`: нужен браузер (Playwright)
// и запущенный статический сервер на 127.0.0.1:8765.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PROGRAM, buildExercises } from "../../data/program.js";

const OUT = process.argv[2];
if (!OUT) { console.error("укажи папку для снимков"); process.exit(2); }
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || "http://127.0.0.1:8765";

// ---------- богатый, но детерминированный журнал ----------
function seed() {
  const sessions = [];
  let n = 0;
  const day = (i) => new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10);
  PROGRAM.weeks.slice(0, 3).forEach((wk, wi) => wk.workouts.forEach((w) => {
    const list = buildExercises(w);
    const entries = {};
    list.forEach((e) => {
      const base = e.tier === 1 ? 100 : e.tier === 2 ? 55 : 25;
      const wt = Math.round((base * (1 + wi * 0.03)) / 2.5) * 2.5;
      entries[e.id] = [{ w: Math.round(wt * 0.5 / 2.5) * 2.5, r: 5 }, ...Array.from({ length: e.sets }, () => ({ w: wt, r: e.reps[1] }))];
    });
    const d = day(n * 2); n++;
    sessions.push({ id: `sess-${n}`, workoutId: w.id, date: d, at: `${d}T18:00:00.000Z`, feel: n % 5 ? "norm" : "tired",
      verdict: "Отработано", cls: "verdict-gold", score: 80 + (n % 20), xp: 120, durationSec: 3600 + n * 60, timing: "active",
      exercises: list.map((e) => ({ id: e.id, name: e.name, sets: e.sets, reps: e.reps, rir: e.rir, main: !!e.main,
        lift: e.lift, tier: e.tier, role: e.role, deload: !!e.deload, prior: e.prior })), entries });
  }));
  const log = {};
  for (let i = 0; i < 12; i++) log[day(i)] = { dayType: i % 2 ? "rest" : "training", water: 1500 + i * 100,
    items: [{ n: "Куриная грудка (варёная)", g: 200, amt: 200, unit: "г", k: 165, p: 31, f: 3.6, cb: 0, fb: 0, src: "base" },
            { n: "Рис белый (варёный)", g: 250, amt: 250, unit: "г", k: 130, p: 2.7, f: 0.3, cb: 28, fb: 0.4, src: "base" }] };
  return {
    hero: { name: "Всеволод", title: "Одинокий Гриндер", bodyweight: 97 }, xp: 4200, sessions, drafts: {}, cycleStart: 0,
    questStart: {}, questTicks: {}, plan: { w1u: { swap: {}, add: [], hide: [], pair: [["lat-raise", "face-pull"]] } },
    workReset: {}, feel: null,
    settings: { sound: false, haptics: false, offSearch: false, theme: "saga" },
    buffs: { active: { creatine: 5, arginine: 7, omega3: 2 }, checkedAt: "2026-09-20", log: { [day(11)]: { "creatine@Утро": true } },
      stock: { creatine: 40 }, custom: [] },
    nutrition: { log, recent: [], foodStats: {} }, statuses: [], achievements: {},
    meta: { exports: 0, imports: 0 }, rev: 40, updatedAt: "2026-09-25T10:00:00.000Z", sync: { syncedRev: 0, at: null },
  };
}

// ---------- заморозка времени и случайности: снимок не должен зависеть от запуска ----------
const FREEZE = `(() => {
  const T0 = Date.UTC(2026, 8, 28, 9, 30, 0);
  let tick = 0;
  const RealDate = Date;
  class FrozenDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(T0 + tick); }
    static now() { return T0 + tick; }
  }
  FrozenDate.UTC = RealDate.UTC; FrozenDate.parse = RealDate.parse;
  globalThis.Date = FrozenDate;
  let s = 42; Math.random = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  let u = 0; crypto.randomUUID = () => "uuid-" + String(++u).padStart(4, "0");
  // speechSynthesis/AudioContext не трогаем: звук выключен в настройках
})();`;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 414, height: 900 } });
await ctx.addInitScript(FREEZE);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { const t = m.text(); if (m.type() === "error" && !/ERR_TUNNEL|telegram\.org|Failed to load resource/.test(t)) errors.push(t); });
await page.route(/telegram\.org/, (r) => r.abort());
await page.route(/openfoodfacts/, (r) => r.abort());

await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.evaluate((s) => { localStorage.clear(); localStorage.setItem("bodyupgrade.v1", JSON.stringify(s)); }, seed());
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(500);

let step = 0;
const wait = (ms = 450) => page.waitForTimeout(ms);
const norm = (h) => h
  .replace(/style="--qhead-h:[^"]*"/g, "")
  .replace(/\s+/g, " ");
async function snap(name) {
  const html = await page.evaluate(() => ({
    app: document.getElementById("app")?.innerHTML || "",
    over: document.getElementById("overlay-root")?.innerHTML || "",
    tabs: [...document.querySelectorAll(".tab")].map((t) => t.className + "|" + t.innerText).join("\n"),
    theme: document.documentElement.dataset.theme || "",
  }));
  const file = `${String(++step).padStart(2, "0")}-${name}.html`;
  writeFileSync(join(OUT, file), [`THEME ${html.theme}`, "TABS", html.tabs, "APP", norm(html.app), "OVERLAY", norm(html.over)].join("\n"));
}
const tab = async (v) => { await page.click(`.tabbar [data-view="${v}"]`); await wait(); };
const closeOverlays = async () => { await page.evaluate(() => document.querySelectorAll("#overlay-root .overlay").forEach((o) => o.remove())); await wait(150); };
const openWeek = (n) => page.evaluate((k) => { const h = [...document.querySelectorAll(".week-head")].find((x) => x.dataset.week === String(k)); if (h && h.getAttribute("aria-expanded") !== "true") h.click(); }, n);

async function flow(theme) {
  // тема: через настоящий переключатель в профиле
  await tab("profile");
  const cur = await page.evaluate(() => document.documentElement.dataset.theme);
  if (cur !== theme) { await page.click(`[data-theme-pick="${theme}"]`); await wait(); }
  await snap(`${theme}-profile`);
  await page.click("#ach-all"); await wait(); await snap(`${theme}-achievements`);
  const first = await page.$("#overlay-root .ach-row");
  if (first) { await first.click(); await wait(); await snap(`${theme}-achievement-detail`); }
  await closeOverlays();

  await tab("cycle"); await snap(`${theme}-cycle`);
  for (const n of [2, 3, 4, 5]) { await openWeek(n); await wait(120); }
  await snap(`${theme}-cycle-all-weeks`);
  await page.click("#cycle-help"); await wait(); await snap(`${theme}-cycle-help`); await closeOverlays();

  await page.click("#open-pool"); await wait(); await snap(`${theme}-pool`);
  await page.fill("#pool-q", "жим"); await wait(); await snap(`${theme}-pool-search`);
  const row = await page.$("#app [data-ex], #app .pool-row, #app .ex-row");
  if (row) { await row.click(); await wait(); await snap(`${theme}-pool-detail`); }
  await closeOverlays();
  await page.evaluate(() => document.getElementById("back")?.click()); await wait();
  await page.evaluate(() => document.getElementById("back")?.click()); await wait();

  await tab("cycle"); await openWeek(1); await wait(150);
  await page.evaluate(() => [...document.querySelectorAll(".wcard")].find((c) => c.dataset.w === "w1u").click()); await wait(700);
  await snap(`${theme}-workout`);
  // ввод подхода в открытую карточку
  const w = await page.$(".ex.open .set-row .s-w"); const r = await page.$(".ex.open .set-row .s-r");
  if (w && r) { await w.fill("100"); await r.fill("5"); await page.keyboard.press("Tab"); await wait(300); }
  await snap(`${theme}-workout-set`);
  const add = await page.$(".ex.open .add-set"); if (add) { await add.click(); await wait(250); }
  await snap(`${theme}-workout-addset`);
  await page.click('.feel[data-feel="tired"]'); await wait(600); await snap(`${theme}-workout-tired`);
  await page.click('.feel[data-feel="norm"]'); await wait(600);
  await page.click("#q-help"); await wait(); await snap(`${theme}-workout-help`); await closeOverlays();
  // после пересборки квеста ни одна карточка может быть не раскрыта — раскрываем вторую
  if (!(await page.$(".ex.open"))) { await page.evaluate(() => document.querySelectorAll("#ex-list > .ex:not(.ss-card) .ex-head")[1]?.click()); await wait(300); }
  await snap(`${theme}-workout-card2`);
  const pair = await page.$(".ex.open [data-pair]"); if (pair) { await pair.click(); await wait(); await snap(`${theme}-pair-picker`); await closeOverlays(); }
  const swap = await page.$(".ex.open [data-swap]"); if (swap) { await swap.click(); await wait(); await snap(`${theme}-swap-picker`); await closeOverlays(); }
  await page.click("#finish"); await wait(900); await snap(`${theme}-verdict`); await closeOverlays();

  await tab("buffs"); await snap(`${theme}-buffs`);
  const dose = await page.$(".dose-item"); if (dose) { await dose.click(); await wait(); await snap(`${theme}-buffs-taken`); }
  const fold = await page.$(".cat-fold > summary"); if (fold) { await fold.click(); await wait(200); await snap(`${theme}-buffs-catalog`); }

  await tab("resources"); await snap(`${theme}-resources`);
  // добавление: «+» у обеда → поиск → порция → добавить (экран поиска остаётся открытым) → «Готово»
  const addLunch = await page.$('#app .mh-add[data-add="lunch"]');
  if (addLunch) {
    await addLunch.click(); await wait();
    await page.fill("#fs-q", "кур"); await wait(500); await snap(`${theme}-food-search`);
    await page.click(".fs-row [data-open]"); await wait(); await snap(`${theme}-portion`);
    await page.click("#portion-add"); await wait();
    await page.click("#fs-done"); await wait(); await closeOverlays(); await snap(`${theme}-resources-after`);
  }

  await tab("progress"); await snap(`${theme}-progress`);
  const log = await page.$(".log-row"); if (log) { await log.click(); await wait(); await snap(`${theme}-session-detail`); await closeOverlays(); }
}

await flow("saga");
await flow("plain");

// ---------- сенсорный экран: полоска «Готово» над клавиатурой ----------
// На десктопе её нет вовсе, поэтому отдельный контекст с касаниями
{
  const tctx = await b.newContext({ viewport: { width: 414, height: 900 }, hasTouch: true, isMobile: true });
  await tctx.addInitScript(FREEZE);
  const tp = await tctx.newPage();
  tp.on("pageerror", (e) => errors.push("touch pageerror: " + e.message));
  await tp.route(/telegram\.org/, (r) => r.abort());
  await tp.goto(BASE, { waitUntil: "domcontentloaded" });
  await tp.evaluate((s) => { localStorage.clear(); localStorage.setItem("bodyupgrade.v1", JSON.stringify(s)); }, seed());
  await tp.reload({ waitUntil: "load" }); await tp.waitForTimeout(500);
  await tp.click('.tabbar [data-view="cycle"]'); await tp.waitForTimeout(600);
  await tp.evaluate(() => { const h = [...document.querySelectorAll(".week-head")].find((x) => x.dataset.week === "1"); if (h && h.getAttribute("aria-expanded") !== "true") h.click(); });
  await tp.waitForTimeout(250);
  await tp.evaluate(() => [...document.querySelectorAll(".wcard")].find((c) => c.dataset.w === "w1l").click()); await tp.waitForTimeout(800);
  await tp.focus(".ex.open .s-w"); await tp.waitForTimeout(300);
  const kb = await tp.evaluate(() => { const k = document.querySelector(".kbd-bar"); return k ? `${k.className}|${k.innerHTML}|body.kbd=${document.body.classList.contains("kbd")}` : "нет полоски"; });
  await tp.click(".kbd-done"); await tp.waitForTimeout(600);
  const after = await tp.evaluate(() => `фокус=${document.activeElement && document.activeElement.tagName}|body.kbd=${document.body.classList.contains("kbd")}`);
  writeFileSync(join(OUT, `${String(++step).padStart(2, "0")}-touch-keyboard.txt`), `${kb}\n${after}\n`);
  await tctx.close();
}

const state = await page.evaluate(() => localStorage.getItem("bodyupgrade.v1"));
writeFileSync(join(OUT, "zz-journal.json"), JSON.stringify(JSON.parse(state), null, 1));
writeFileSync(join(OUT, "zz-errors.txt"), errors.join("\n"));
console.log(`снимков: ${step}, ошибок в консоли: ${errors.length}`);
if (errors.length) console.log(errors.slice(0, 5).join("\n"));
await b.close();
