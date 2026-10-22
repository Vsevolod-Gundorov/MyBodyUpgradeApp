// Добор в браузере: тренировку разбили на две — сделанное закрывается, несделанное
// собирается в добор, он стоит первым в «Тренировках», открывается только с несделанным,
// а его завершение пишется второй частью той же тренировки.
// Запуск: статический сервер на 127.0.0.1:8765 (python3 -m http.server 8765) и node tests/e2e/carry.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";

const BASE = process.env.BASE || "http://127.0.0.1:8765";
const OUT = process.argv[2] || "";
const state = { hero: { name: "Атлет", bodyweight: 97 }, sessions: [], settings: { theme: process.env.THEME || "plain", sound: false, haptics: false, offSearch: false },
  profile: { sex: "m", birthYear: 1994, height: 180, activity: "moderate", direction: "cut", pace: "normal", program: "balanced", custom: null,
    experience: "intermediate", adjust: 0, override: null, maxes: { bench: 100, squat: 130, deadlift: 160, ohp: 60 }, maxesSource: "estimated" } };
const fails = [];
const check = (ok, msg) => { console.log(`${ok ? "ok  " : "FAIL"} ${msg}`); if (!ok) fails.push(msg); };

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", deviceScaleFactor: OUT ? 2 : 1 });
await ctx.route(/telegram\.org|openfoodfacts/, (r) => r.abort());
await ctx.addInitScript((s) => { if (!localStorage.getItem("bodyupgrade.v1")) { localStorage.setItem("bodyupgrade.v1", s); localStorage.setItem("bodyupgrade.theme", JSON.parse(s).settings.theme); } }, JSON.stringify(state));
const p = await ctx.newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
p.on("dialog", (d) => d.accept());
const wait = (ms = 700) => p.waitForTimeout(ms);
const shot = async (n) => { if (OUT) await p.screenshot({ path: `${OUT}/${n}.png` }); };
const journal = () => p.evaluate(() => JSON.parse(localStorage.getItem("bodyupgrade.v1")));

// подход в открытой карточке: этого достаточно, чтобы движение считалось начатым
async function logSet() {
  const w = p.locator(".ex.open .set-row .s-w").first(), r = p.locator(".ex.open .set-row .s-r").first();
  await w.fill("60"); await r.fill("8"); await p.keyboard.press("Tab"); await wait(250);
}

await p.goto(`${BASE}/#cycle`); await wait(1200);
// сколько движений в тренировке — по бейджу карточки (суперсет — одна карточка на два движения)
const total = parseInt(await p.locator(".wcard.next .badge", { hasText: "упр" }).textContent(), 10);
await p.click(".wcard.next"); await wait(900);
await logSet();
await p.locator(".ex .ex-head").nth(1).click(); await wait(300);
await logSet();

await p.click("#finish"); await wait(400);
check(await p.locator(".fin-card").isVisible(), "при несделанных движениях открывается окно завершения");
check(await p.locator(".fin-row").count() === total - 2, `в списке несделанного ${total - 2} движений из ${total}`);
check(await p.getAttribute("#fin-split", "aria-pressed") === "false", "перенос выключен, пока не включили");
await p.click("#fin-split"); await wait(200);
await shot("1-finish-sheet");
await p.click("#fin-go"); await wait(700);
check(/Перенесено/.test(await p.locator(".v-note").textContent()), "в итоге сказано про перенос");
await shot("2-verdict");
let j = await journal();
check(j.sessions.length === 1 && j.sessions[0].split === true && Object.keys(j.sessions[0].entries).length === 2, "первая часть записана с пометкой split");
check(j.sessions[0].exercises.length === 2, "в снимке первой части — только сделанное");
const carryIds = Object.keys(j.carry || {});
check(carryIds.length === 1, "добор собран");

await p.click(".v-close"); await wait(1000);
check(await p.locator(".wcard.carry").count() === 1, "добор стоит в «Тренировках»");
await shot("3-cycle");
check(parseInt(await p.locator(".wcard.carry .badge", { hasText: "упр" }).textContent(), 10) === total - 2, "в карточке добора — число несделанных");
await p.click(".wcard.carry"); await wait(900);
check((await journal()).sessions.length === 1 && await p.locator(".ex").count() > 0 && await p.locator(".ex").count() < total, "в доборе только несделанное");
await shot("4-carry-workout");
await logSet();
await p.click("#finish"); await wait(400);
await p.click("#fin-go"); await wait(700);   // остальное не переносим
j = await journal();
check(j.sessions.length === 2 && j.sessions[1].carry === true && j.sessions[1].workoutId === j.sessions[0].workoutId, "добор записан второй частью той же тренировки");
check(!Object.keys(j.carry || {}).length && !(j.plan || {})[carryIds[0]], "закрытый добор убран вместе с его планом");
await p.click(".v-close"); await wait(1000);
check(await p.locator(".wcard.carry").count() === 0, "в «Тренировках» добора больше нет");
check(await p.locator(".wcard.next").getAttribute("data-w") !== j.sessions[0].workoutId, "следующая по плану — другая тренировка");

// добор можно убрать, не делая
await p.click(".wcard.next"); await wait(900);
await logSet();
await p.click("#finish"); await wait(400); await p.click("#fin-split"); await p.click("#fin-go"); await wait(700);
await p.click(".v-close"); await wait(1000);
await p.click(".wcard-wrap [data-drop]"); await wait(400);
check(await p.locator(".wcard.carry").count() === 0 && !Object.keys((await journal()).carry || {}).length, "добор убирается крестиком");

check(!errs.length, `ошибок на странице нет${errs.length ? ": " + errs.join("; ") : ""}`);
await b.close();
console.log(fails.length ? `\nпровалено: ${fails.length}` : "\nдобор работает");
process.exit(fails.length ? 1 : 0);
