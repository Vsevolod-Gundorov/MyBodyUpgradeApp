// Правила MVC: node --test tests/architecture.test.mjs
//
// Клиент разложен на три слоя, и у каждого — свои границы:
//   model/      журнал и расчёты. Не знает ни о DOM, ни об экранах.
//   view/       разметка. Может ЧИТАТЬ модель, но не меняет её и не вешает обработчики.
//   controller/ экраны: берут данные у модели, отдают виду, обрабатывают действия.
// Нарушить эти границы легко одной строчкой, а заметить — трудно. Поэтому они здесь.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const JS = join(root, "js");
const files = (dir) => readdirSync(join(JS, dir)).filter((f) => f.endsWith(".js")).map((f) => `${dir}/${f}`);
const read = (rel) => readFileSync(join(JS, rel), "utf8");
const importsOf = (rel) => [...read(rel).matchAll(/^import\s[^"']*["']([^"']+)["']/gm)].map((m) => m[1]);
// путь импорта → путь относительно js/
const target = (rel, spec) => relative(JS, resolve(dirname(join(JS, rel)), spec));
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

const MODEL = [...files("model"), ...files("core")];
const VIEW = files("view");
const CTRL = files("controller");

test("монолита больше нет: точка входа одна — main.js", () => {
  assert.ok(!existsSync(join(JS, "app.js")), "js/app.js вернулся");
  const html = readFileSync(join(root, "index.html"), "utf8");
  const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]).filter((s) => !s.startsWith("http"));
  assert.deepEqual(scripts, ["js/main.js"]);
});

test("модель не зависит от вида и контроллеров", () => {
  for (const f of MODEL) {
    for (const spec of importsOf(f)) {
      const t = target(f, spec);
      assert.ok(!t.startsWith("view/") && !t.startsWith("controller/"), `${f} импортирует ${t}`);
    }
    const src = noComments(read(f));
    assert.ok(!/\bdocument\.|\bapp\.innerHTML|\boverlayRoot\b/.test(src), `${f} трогает DOM`);
  }
});

test("вид не зависит от контроллеров", () => {
  for (const f of VIEW) for (const spec of importsOf(f)) {
    assert.ok(!target(f, spec).startsWith("controller/"), `${f} импортирует контроллер ${target(f, spec)}`);
  }
});

test("вид только рисует: не меняет модель и не вешает обработчики", () => {
  // всё, что меняет журнал или запускает процессы, — работа контроллера
  const MUTATORS = ["save", "setPlan", "toggleTaken", "setFeelToday", "scaleWorkMax", "clearWorkMax", "pushRecent",
    "nutDay", "reloadState", "queueCloudSync", "pushCloud", "initCloudSync", "checkAchievements", "setCloudState", "invalidateE1RM"];
  // fx.js — звук и вибрация; dom.js — корневые узлы. Это не шаблоны, но тоже вид.
  for (const f of VIEW.filter((x) => !/view\/(fx|dom)\.js$/.test(x))) {
    const src = noComments(read(f));
    for (const m of src.matchAll(/^import \{([^}]*)\} from ["']([^"']+)["']/gm)) {
      const names = m[1].split(",").map((x) => x.trim().split(/\s+as\s+/)[0]);
      const bad = names.filter((n) => MUTATORS.includes(n));
      assert.deepEqual(bad, [], `${f} импортирует изменяющие функции модели: ${bad.join(", ")}`);
    }
    assert.ok(!/addEventListener|\.on[a-z]+\s*=/.test(src), `${f} вешает обработчики`);
    assert.ok(!/\bS\.[\w.[\]"'`$]+\s*=(?!=)/.test(src), `${f} пишет в журнал`);
  }
});

test("в контроллерах нет разметки — она вся в виде", () => {
  const TAG = /<(div|span|button|p|b|i|svg|input|section|ul|li|a|label|select|option|details|summary|h[1-6]|img|g|path|circle)[\s>/]/;
  for (const f of CTRL) {
    const src = noComments(read(f));
    const strings = [...src.matchAll(/`[^`]*`|"[^"\n]*"|'[^'\n]*'/g)].map((m) => m[0]);
    const html = strings.filter((s) => TAG.test(s));
    assert.deepEqual(html, [], `${f} строит разметку сам: ${html[0] && html[0].slice(0, 60)}`);
  }
});

test("каждый модуль клиента достижим из main.js", () => {
  const seen = new Set();
  const walk = (rel) => {
    if (seen.has(rel)) return; seen.add(rel);
    for (const spec of importsOf(rel)) { const t = target(rel, spec); if (!t.startsWith("..")) walk(t); }
  };
  walk("main.js");
  for (const f of [...MODEL, ...VIEW, ...CTRL]) assert.ok(seen.has(f), `${f} нигде не используется`);
});

test("слова интерфейса в атрибутах подставляются, а не печатаются как код", () => {
  // `aria-label=L("questAbout")` внутри шаблона — это не вызов, а буквальный текст:
  // экранный диктор зачитал бы «L скобка questAbout». Нужно `aria-label="${L("questAbout")}"`
  for (const f of [...VIEW, ...CTRL]) {
    const bad = read(f).match(/\b(aria-label|title|placeholder|alt)=(L|AN|AD|CN|BN)\(/);
    assert.equal(bad, null, `${f}: ${bad && bad[0]} — забыт \${…}`);
  }
});
