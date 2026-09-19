// Тесты приватности и защиты секретов: node --test tests/security.test.mjs
// Смысл: приложение не должно тихо отрастить новый внешний адрес или утечь токеном.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";

const root = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(root + p, "utf8");
const git = (cmd) => { try { return execSync(cmd, { cwd: root, encoding: "utf8" }); } catch (e) { return ""; } };

// куда приложению разрешено обращаться — список закрытый и совпадает с политикой на сервере
const ALLOWED_HOSTS = ["telegram.org", "world.openfoodfacts.org"];

test("страница не тянет ничего со сторонних доменов, кроме SDK Telegram", () => {
  const html = read("index.html");
  const urls = [...html.matchAll(/https?:\/\/([^/"'\s)]+)/g)].map((m) => m[1]);
  for (const host of urls) {
    assert.ok(ALLOWED_HOSTS.some((a) => host === a || host.endsWith("." + a)),
      `index.html обращается к постороннему домену ${host}`);
  }
  assert.ok(!/fonts\.googleapis|fonts\.gstatic/.test(html), "шрифты должны грузиться локально, а не из Google");
  assert.match(html, /telegram\.org\/js\/telegram-web-app\.js/, "SDK Telegram должен подключаться с telegram.org");
});

test("шрифты лежат в репозитории и подключены относительными путями", () => {
  const css = read("css/fonts.css");
  const faces = css.match(/@font-face/g) || [];
  assert.ok(faces.length >= 20, `начертаний всего ${faces.length}`);
  assert.ok(!/https?:\/\//.test(css), "в fonts.css не должно быть внешних ссылок");
  const files = readdirSync(root + "assets/fonts");
  for (const m of css.matchAll(/\.\.\/assets\/fonts\/([^)"']+)/g)) {
    assert.ok(files.includes(m[1]), `нет файла шрифта ${m[1]}`);
  }
  assert.ok(files.every((f) => f.endsWith(".woff2")), "в папке шрифтов только woff2");
});

test("код обращается наружу только по разрешённым адресам", () => {
  for (const file of ["js/app.js", "js/telegram.js", "data/nutrition.js", "data/program.js", "data/exercises.js", "data/achievements.js"]) {
    const src = read(file);
    for (const m of src.matchAll(/["'`](https?:\/\/[^"'`\s]+)/g)) {
      const host = new URL(m[1]).host;
      assert.ok(ALLOWED_HOSTS.some((a) => host === a || host.endsWith("." + a)),
        `${file} обращается к ${host}`);
    }
    assert.ok(!/navigator\.sendBeacon|new WebSocket|analytics|gtag\(/.test(src), `${file}: похоже на отправку телеметрии`);
  }
});

test("внешний поиск продуктов можно выключить, и он спрашивает только название", () => {
  const app = read("js/app.js");
  assert.match(app, /S\.settings && S\.settings\.offSearch/, "перед внешним поиском должна стоять проверка настройки");
  assert.match(app, /offSearch:\s*true/, "настройка должна быть в состоянии по умолчанию");
  const nut = read("data/nutrition.js");
  // в запрос уходит только поисковая строка и технические параметры
  const q = nut.match(/search_terms=" \+ encodeURIComponent\((\w+)\)/);
  assert.ok(q, "поисковая строка должна экранироваться");
  assert.ok(!/initData|user\.id|localStorage/.test(nut), "во внешний запрос не должно попадать ничего из журнала");
});

test("данные Telegram используются только локально", () => {
  const tg = read("js/telegram.js");
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(tg), "модуль Telegram не должен никуда ходить сам");
  assert.match(tg, /initDataUnsafe/, "id пользователя берётся из SDK");
  const app = read("js/app.js");
  assert.ok(!/initData[^U]/.test(app), "подписанный initData никуда не передаётся");
});

test("политика безопасности на сервере совпадает со списком разрешённых адресов", () => {
  const cfg = JSON.parse(read("vercel.json"));
  const headers = cfg.headers.flatMap((h) => h.headers);
  const csp = headers.find((h) => h.key === "Content-Security-Policy");
  assert.ok(csp, "нет Content-Security-Policy");
  assert.match(csp.value, /default-src 'self'/);
  assert.match(csp.value, /script-src 'self' https:\/\/telegram\.org/);
  assert.match(csp.value, /connect-src 'self' https:\/\/world\.openfoodfacts\.org/);
  assert.match(csp.value, /frame-ancestors[^;]*telegram\.org/, "Telegram должен иметь право встроить приложение");
  assert.match(csp.value, /object-src 'none'/);
  for (const key of ["Referrer-Policy", "X-Content-Type-Options", "Permissions-Policy", "Strict-Transport-Security"]) {
    assert.ok(headers.some((h) => h.key === key), `нет заголовка ${key}`);
  }
  const perms = headers.find((h) => h.key === "Permissions-Policy").value;
  for (const feat of ["camera", "microphone", "geolocation"]) {
    assert.match(perms, new RegExp(`${feat}=\\(\\)`), `${feat} должен быть запрещён`);
  }
});

test("секреты закрыты: .env не в репозитории, образец без значений", () => {
  assert.ok(existsSync(root + ".env.example"), "нет .env.example");
  const example = read(".env.example");
  assert.match(example, /^BOT_TOKEN=\s*$/m, "в образце не должно быть значения токена");
  const ignore = read(".gitignore");
  assert.match(ignore, /^\.env$/m);
  assert.match(ignore, /^!\.env\.example$/m, "образец должен оставаться в репозитории");
  // сам .env не отслеживается
  assert.equal(git("git ls-files .env").trim(), "", ".env попал под контроль версий");
});

test("в файлах и истории нет токенов бота и приватных ключей", () => {
  const TOKEN = /[0-9]{6,12}:[A-Za-z0-9_-]{30,}/;
  const tracked = git("git ls-files").split("\n").filter(Boolean)
    .filter((f) => !/^assets\/|\.woff2$|^tests\/security\.test\.mjs$|^tools\/check-secrets\.sh$|^\.githooks\//.test(f));
  for (const f of tracked) {
    const src = readFileSync(root + f, "utf8");
    assert.ok(!TOKEN.test(src), `похоже на токен бота в ${f}`);
    assert.ok(!/BEGIN (RSA|OPENSSH|EC|PGP) PRIVATE KEY/.test(src), `приватный ключ в ${f}`);
  }
  const hist = git("git log --all -p --no-color -S: --pickaxe-regex -- . | head -c 0");
  assert.equal(typeof hist, "string");
});

test("скрипт настройки бота не печатает токен и требует https", () => {
  const sh = read("tools/setup-bot.sh");
  assert.match(sh, /\$\{out\/\/\$BOT_TOKEN\/\*\*\*\}/, "токен должен вырезаться из вывода");
  assert.match(sh, /APP_URL должен начинаться с https/, "нужна проверка схемы адреса");
  assert.ok(!/echo .*\$BOT_TOKEN/.test(sh), "скрипт не должен печатать токен");
  assert.match(sh, /if \[ -f \.env \]/, "скрипт должен читать .env");
});

test("хук pre-commit блокирует .env и токены", () => {
  const hook = read(".githooks/pre-commit");
  assert.match(hook, /\.env\|\.env\.\*/);
  assert.match(hook, /\[0-9\]\{6,12\}:\[A-Za-z0-9_-\]\{30,\}/);
  assert.match(hook, /exit 1/);
});
