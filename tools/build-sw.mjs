// Манифест service worker: какие файлы кладутся в кэш и под какой версией.
// Версия — хеш содержимого этих файлов: поменялся хоть один байт кода — новая
// версия, и телефон тихо скачает её в фоне. Запуск: node tools/build-sw.mjs
// (тест tests/sw.test.mjs проверяет, что sw.js не отстал от кода).
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const START = "// @@manifest-start", END = "// @@manifest-end";

function walk(dir) {
  return readdirSync(join(ROOT, dir)).flatMap((n) => {
    const rel = join(dir, n);
    return statSync(join(ROOT, rel)).isDirectory() ? walk(rel) : [rel];
  });
}

/** Оболочка приложения: всё, без чего оно не запустится. Шрифты — только основные наборы (кириллица и латиница). */
export function shellFiles() {
  const files = ["index.html", ...walk("css"), ...walk("js"), ...walk("data"), "assets/logo.svg", ...walk("assets/textures"),
    ...walk("assets/fonts").filter((f) => /-(cyrillic|latin)\.woff2$/.test(f))];
  return files.map((f) => f.split(sep).join("/")).filter((f) => !/\.(md|txt|map)$/.test(f) && !f.split("/").some((p) => p.startsWith("."))).sort();
}

export function manifest() {
  const files = shellFiles();
  const h = createHash("sha256");
  for (const f of files) { h.update(f); h.update("\0"); h.update(readFileSync(join(ROOT, f))); }
  const version = h.digest("hex").slice(0, 16);
  return `${START}\nconst VERSION = "${version}";\nconst PRECACHE = ${JSON.stringify(files, null, 2)};\n${END}`;
}

export function render(src) {
  const a = src.indexOf(START), b = src.indexOf(END);
  if (a < 0 || b < a) throw new Error("в sw.js нет меток манифеста");
  return src.slice(0, a) + manifest() + src.slice(b + END.length);
}

if (process.argv[1] && relative(process.argv[1], fileURLToPath(import.meta.url)) === "") {
  const p = join(ROOT, "sw.js");
  const next = render(readFileSync(p, "utf8"));
  writeFileSync(p, next);
  console.log(`sw.js: ${shellFiles().length} файлов, версия ${/VERSION = "(\w+)"/.exec(next)[1]}`);
}
