// Service worker: быстрый запуск и запуск без сети.
//
// Что делает:
//   • код приложения (index.html, js, css, data, основные шрифты) лежит в кэше
//     версии VERSION и отдаётся мгновенно, без сети;
//   • новая версия после деплоя скачивается в фоне целиком и включается со следующего
//     открытия — старые и новые модули не смешиваются (в приложении нет ленивых import());
//   • данные никогда не кэшируются: /api/* (журнал, каталог, напоминания), Telegram и
//     Open Food Facts идут мимо — синхронизация и вход работают как без воркера;
//   • прочие свои файлы (редкие шрифты, сканер штрихкодов) — из сети, копия на случай офлайна.
// Список файлов и версия — tools/build-sw.mjs.

// @@manifest-start
const VERSION = "78a19909975beee4";
const PRECACHE = [
  "assets/fonts/cormorant-500-cyrillic.woff2",
  "assets/fonts/cormorant-500-latin.woff2",
  "assets/fonts/cormorant-600-cyrillic.woff2",
  "assets/fonts/cormorant-600-latin.woff2",
  "assets/fonts/cormorant-700-cyrillic.woff2",
  "assets/fonts/cormorant-700-latin.woff2",
  "assets/fonts/jetbrainsmono-400-cyrillic.woff2",
  "assets/fonts/jetbrainsmono-400-latin.woff2",
  "assets/fonts/jetbrainsmono-600-cyrillic.woff2",
  "assets/fonts/jetbrainsmono-600-latin.woff2",
  "assets/fonts/manrope-400-cyrillic.woff2",
  "assets/fonts/manrope-400-latin.woff2",
  "assets/fonts/manrope-500-cyrillic.woff2",
  "assets/fonts/manrope-500-latin.woff2",
  "assets/fonts/manrope-600-cyrillic.woff2",
  "assets/fonts/manrope-600-latin.woff2",
  "assets/fonts/manrope-700-cyrillic.woff2",
  "assets/fonts/manrope-700-latin.woff2",
  "assets/logo.svg",
  "assets/textures/filigree.svg",
  "assets/textures/frame.svg",
  "assets/textures/grain.svg",
  "assets/textures/leather.svg",
  "css/fonts.css",
  "css/styles.css",
  "css/theme-plain.css",
  "data/achievements.js",
  "data/barcode.js",
  "data/bodymap.js",
  "data/complaints.js",
  "data/exercises.js",
  "data/icons-achievements.js",
  "data/icons-exercise.js",
  "data/icons-plain.js",
  "data/icons-ui.js",
  "data/icons.js",
  "data/nutrition.js",
  "data/profile.js",
  "data/program.js",
  "data/progression.js",
  "data/reminders.js",
  "data/theme.js",
  "index.html",
  "js/controller/body.js",
  "js/controller/buffs.js",
  "js/controller/cycle.js",
  "js/controller/foods.js",
  "js/controller/health.js",
  "js/controller/keyboard.js",
  "js/controller/nutplan.js",
  "js/controller/onboarding.js",
  "js/controller/overlays.js",
  "js/controller/pool.js",
  "js/controller/profile.js",
  "js/controller/progress.js",
  "js/controller/reminders.js",
  "js/controller/resources.js",
  "js/controller/rest.js",
  "js/controller/router.js",
  "js/controller/scanner.js",
  "js/controller/snack.js",
  "js/controller/workout.js",
  "js/core/format.js",
  "js/main.js",
  "js/model/achievements.js",
  "js/model/buffs.js",
  "js/model/catalog.js",
  "js/model/foods.js",
  "js/model/health.js",
  "js/model/hero.js",
  "js/model/nutrition.js",
  "js/model/profile.js",
  "js/model/reminders.js",
  "js/model/server.js",
  "js/model/store.js",
  "js/model/sync.js",
  "js/model/theme.js",
  "js/model/training.js",
  "js/model/weekly.js",
  "js/telegram.js",
  "js/theme-boot.js",
  "js/timing.js",
  "js/view/body.js",
  "js/view/buffs.js",
  "js/view/components.js",
  "js/view/cycle.js",
  "js/view/dom.js",
  "js/view/fx.js",
  "js/view/icons.js",
  "js/view/nutplan.js",
  "js/view/onboarding.js",
  "js/view/overlays.js",
  "js/view/pool.js",
  "js/view/profile.js",
  "js/view/progress.js",
  "js/view/resources.js",
  "js/view/scanner.js",
  "js/view/workout.js"
];
// @@manifest-end
const SHELL = `shell-${VERSION}`;
const RUNTIME = "runtime-v1";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // мимо HTTP-кэша браузера: в кэш версии кладём ровно то, что сейчас на сервере
    await cache.addAll(PRECACHE.map((u) => new Request(u, { cache: "reload" })));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith("shell-") && key !== SHELL) await caches.delete(key);
    await self.clients.claim();
  })());
});

const SHELL_SET = new Set(PRECACHE);

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;            // Telegram, Open Food Facts — мимо
  if (url.pathname.startsWith("/api/")) return;                // данные — только из сети
  if (url.pathname === "/sw.js") return;

  if (req.mode === "navigate") {
    event.respondWith(fromShell("index.html").then((r) => r || fetch(req)));
    return;
  }
  const path = url.pathname.replace(/^\//, "");
  if (SHELL_SET.has(path)) {
    event.respondWith(fromShell(path).then((r) => r || fetch(req)));
    return;
  }
  // остальное своё: сеть, а без неё — последняя копия
  event.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok && res.type === "basic") { const c = await caches.open(RUNTIME); c.put(req, res.clone()); }
      return res;
    } catch (e) {
      const hit = await caches.match(req, { cacheName: RUNTIME });
      if (hit) return hit;
      throw e;
    }
  })());
});

async function fromShell(path) {
  const cache = await caches.open(SHELL);
  return cache.match(path, { ignoreSearch: true });
}
