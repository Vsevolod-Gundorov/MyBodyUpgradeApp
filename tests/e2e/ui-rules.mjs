// Проверка правил интерфейса (docs/UI_RULES.md, «Проверка перед выкладкой») на профиле:
//   • строки двух колонок блока «Питание» — на одной высоте до пикселя;
//   • содержимое не выходит за края карточек, подписи не обрезаны;
//   • заголовки блоков — 40 px, кнопка — по центру той же строки;
//   • нажимаемое — не меньше 40 px.
// Обе темы, ширина 360, 390 и 430. Данные синтетические.
// Запуск: статический сервер на 127.0.0.1:8765 (python3 -m http.server 8765) и node tests/e2e/ui-rules.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";

const BASE = process.env.BASE || "http://127.0.0.1:8765";
const today = new Date().toISOString().slice(0, 10);
const state = (theme) => ({
  hero: { name: "Атлет", bodyweight: 90 }, sessions: [], settings: { theme, sound: false, haptics: false, offSearch: false },
  profile: { sex: "m", birthYear: 1994, height: 180, activity: "moderate", direction: "cut", pace: "normal", program: "balanced", custom: null,
    experience: "intermediate", adjust: 0, override: null, maxes: { bench: 100, squat: 130, deadlift: 160, ohp: 60 }, maxesSource: "estimated" },
  nutrition: { log: { [today]: { dayType: "training", items: [{ n: "Курица", g: 300, k: 165, p: 31, f: 3.6, cb: 0 }, { n: "Рис", g: 250, k: 130, p: 2.7, f: 0.3, cb: 28 }], water: 500 } } },
});

const b = await chromium.launch();
const fails = [];
for (const theme of ["plain", "saga"]) for (const width of [360, 390, 430]) {
  const ctx = await b.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block" });
  await ctx.route(/telegram\.org|openfoodfacts/, (r) => r.abort());
  await ctx.addInitScript(([s, th]) => { if (!localStorage.getItem("bodyupgrade.v1")) { localStorage.setItem("bodyupgrade.v1", s); localStorage.setItem("bodyupgrade.theme", th); } }, [JSON.stringify(state(theme)), theme]);
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(`${BASE}/#profile`); await p.waitForTimeout(1200);
  const r = await p.evaluate(() => {
    const bad = [];
    const days = [...document.querySelectorAll(".pfn-day")];
    if (days.length !== 2) bad.push("в блоке «Питание» не две колонки");
    else {
      const ys = (el) => [...el.querySelectorAll(".pfn-tag,.pfn-name,.pfn-kcal,.pfn-ksub,.pfn-day > .pfn-bar,.pfn-m .pfn-ico,.pfn-mn,.pfn-mv,.pfn-m .pfn-bar")]
        .map((x) => Math.round(x.getBoundingClientRect().top - el.getBoundingClientRect().top));
      const a = ys(days[0]), c = ys(days[1]);
      if (a.length !== c.length) bad.push("колонки питания устроены по-разному");
      a.forEach((y, i) => { if (y !== c[i]) bad.push(`строка ${i} колонок питания: ${y} и ${c[i]}`); });
    }
    document.querySelectorAll(".pfn-day, .pf-card, .panel").forEach((el) => {
      const box = el.getBoundingClientRect();
      if ([...el.querySelectorAll("*")].some((c) => { const q = c.getBoundingClientRect(); return q.width && (q.right > box.right + 0.5 || q.left < box.left - 0.5); })) bad.push(`вылезает за край: ${el.className}`);
    });
    document.querySelectorAll(".pfn-mn, .pfn-mv, .pfn-name, .pfn-ksub, .blk-title").forEach((t) => { if (t.scrollWidth > t.clientWidth + 1) bad.push(`обрезано: ${t.textContent.trim()}`); });
    document.querySelectorAll(".blk-head").forEach((h) => {
      const hb = h.getBoundingClientRect(), t = h.querySelector(".blk-title").getBoundingClientRect();
      if (Math.round(hb.height) !== 40) bad.push(`заголовок блока ${Math.round(hb.height)} px`);
      if (Math.abs(t.top + t.height / 2 - hb.top - 20) > 1) bad.push("название блока не по центру строки");
      if (h.children.length > 1) { const a = h.lastElementChild.getBoundingClientRect(); if (Math.abs(a.top + a.height / 2 - hb.top - 20) > 1) bad.push("кнопка блока не по центру строки"); }
    });
    document.querySelectorAll("#app button").forEach((bt) => { const q = bt.getBoundingClientRect(); if (q.width && (q.height < 40 || q.width < 40)) bad.push(`мелкая кнопка ${bt.id || bt.className} ${Math.round(q.width)}×${Math.round(q.height)}`); });
    return bad;
  });
  [...errs, ...r].forEach((m) => fails.push(`${theme} ${width}: ${m}`));
  console.log(`${r.length || errs.length ? "FAIL" : "ok  "} ${theme} ${width}`);
  await ctx.close();
}
await b.close();
fails.forEach((f) => console.log("  " + f));
console.log(fails.length ? `\nнарушений: ${fails.length}` : "\nправила интерфейса соблюдены");
process.exit(fails.length ? 1 : 0);
