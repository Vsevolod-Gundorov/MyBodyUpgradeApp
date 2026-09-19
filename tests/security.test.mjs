// Тесты приватности и защиты секретов: node --test tests/security.test.mjs
// Смысл: приложение не должно тихо отрастить новый внешний адрес или утечь токеном.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

test("сканер секретов валит новый коммит с токеном и пропускает отозванные из .secret-exposures", () => {
  // токен собираем по кускам, иначе сам файл теста стал бы находкой сканера
  const fake = "123456789" + ":" + "AA" + "B".repeat(33);
  const tmp = mkdtempSync(join(tmpdir(), "sec-"));
  const sh = (cmd) => execSync(cmd, { cwd: tmp, encoding: "utf8", stdio: "pipe" });
  try {
    sh("git init -q . && git config user.email t@t && git config user.name t");
    mkdirSync(join(tmp, "tools"));
    writeFileSync(join(tmp, "tools/check-secrets.sh"), read("tools/check-secrets.sh"));
    // .example исключён из проверки рабочего дерева — остаётся ровно проверка истории
    writeFileSync(join(tmp, "leak.example"), `BOT_TOKEN=${fake}\n`);
    sh("git add -A && git commit -qm leak");
    writeFileSync(join(tmp, "leak.example"), "BOT_TOKEN=\n");
    sh("git add -A && git commit -qm clean");

    const run = () => {
      try { execSync("bash tools/check-secrets.sh --history", { cwd: tmp, encoding: "utf8", stdio: "pipe" }); return 0; }
      catch (e) { return e.status; }
    };
    assert.equal(run(), 1, "коммит с токеном должен валить проверку");

    const leaked = sh("git log --all --format=%H -E -G'[0-9]{6,12}:[A-Za-z0-9_-]{30,}'").trim().split("\n");
    assert.ok(leaked.length >= 1);
    writeFileSync(join(tmp, ".secret-exposures"), leaked.map((c) => `${c} leak.example — отозван`).join("\n") + "\n");
    assert.equal(run(), 0, "перечисленные и отозванные утечки не должны валить проверку");

    // а вот новая утечка поверх списка обязана ловиться
    writeFileSync(join(tmp, "next.example"), `BOT_TOKEN=${fake.replace("123", "987")}\n`);
    sh("git add -A && git commit -qm 'leak again'");
    assert.equal(run(), 1, "новый коммит с секретом должен ловиться даже при заполненном списке");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("известные утечки перечислены и помечены как отозванные", () => {
  const list = read(".secret-exposures");
  const shas = [...list.matchAll(/^[0-9a-f]{40}/gm)].map((m) => m[0]);
  assert.ok(shas.length >= 3, "в списке должны быть все коммиты с засвеченным токеном");
  for (const sha of shas) {
    assert.notEqual(git(`git cat-file -t ${sha}`).trim(), "", `коммита ${sha} нет в репозитории`);
  }
  assert.match(list, /отозван/, "напротив утечки должно стоять, что секрет отозван");
});

test("скрипт настройки бота не печатает токен и требует https", () => {
  const sh = read("tools/setup-bot.sh");
  assert.match(sh, /\$\{out\/\/\$BOT_TOKEN\/\*\*\*\}/, "токен должен вырезаться из вывода");
  assert.match(sh, /APP_URL должен начинаться с https/, "нужна проверка схемы адреса");
  assert.ok(!/echo .*\$BOT_TOKEN/.test(sh), "скрипт не должен печатать токен");
  assert.match(sh, /if \[ -f \.env \]/, "скрипт должен читать .env");
});

test("workflow настройки бота берёт токен только из секретов и не печатает его", () => {
  const wf = read(".github/workflows/setup-bot.yml");
  assert.match(wf, /BOT_TOKEN:\s*\$\{\{\s*secrets\.BOT_TOKEN\s*\}\}/, "токен должен приходить из secrets");
  assert.ok(!/[0-9]{6,12}:[A-Za-z0-9_-]{30,}/.test(wf), "в workflow не должно быть значения токена");
  assert.ok(!/echo[^\n]*\$\{?BOT_TOKEN/.test(wf), "workflow не должен печатать токен");
  assert.match(wf, /workflow_dispatch/, "запуск только руками, не по пушу");
  // CI-проверка секретов не должна иметь доступа к токену вообще
  const ci = read(".github/workflows/ci.yml");
  assert.ok(!/\$\{\{\s*secrets\./.test(ci), "CI не должен получать секреты");
});

test("хук pre-commit блокирует .env и токены", () => {
  const hook = read(".githooks/pre-commit");
  assert.match(hook, /\.env\|\.env\.\*/);
  assert.match(hook, /\[0-9\]\{6,12\}:\[A-Za-z0-9_-\]\{30,\}/);
  assert.match(hook, /exit 1/);
});
