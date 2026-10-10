// Service worker: манифест не отстал от кода, данные не кэшируются, регистрация безопасна.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { manifest, shellFiles } from "../tools/build-sw.mjs";

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const sw = read("sw.js");

test("sw.js не отстал от кода: иначе телефон держал бы старую версию (node tools/build-sw.mjs)", () => {
  assert.ok(sw.includes(manifest()), "манифест в sw.js устарел — запусти node tools/build-sw.mjs");
});

test("в кэш версии — все файлы приложения, и они существуют", () => {
  const files = shellFiles();
  for (const f of ["index.html", "js/main.js", "js/theme-boot.js", "css/styles.css", "data/program.js"]) assert.ok(files.includes(f), f);
  for (const f of files) assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), `нет файла ${f}`);
  assert.ok(!files.some((f) => f.startsWith("api/") || f.startsWith("server/") || f.includes("vendor/")), "сервер и тяжёлые библиотеки — не в оболочке");
});

test("данные и чужие адреса — мимо кэша; кэш версии чистится", () => {
  assert.match(sw, /url\.pathname\.startsWith\("\/api\/"\)\) return;/, "/api/* не перехватывается");
  assert.match(sw, /url\.origin !== self\.location\.origin\) return;/, "чужие адреса не перехватываются");
  assert.match(sw, /req\.method !== "GET"\) return;/, "только чтение");
  assert.match(sw, /key\.startsWith\("shell-"\) && key !== SHELL/, "старые версии удаляются");
  assert.doesNotMatch(sw, /importScripts|eval\(|new Function/, "воркер не тянет чужой код");
});

test("регистрация: после отрисовки, только https или localhost, ошибки не ломают приложение", () => {
  const main = read("js/main.js");
  assert.match(main, /serviceWorker\.register\("sw\.js"/);
  assert.match(main, /addEventListener\("load"/);
  assert.match(main, /\.catch\(\(\) => \{\}\)/);
  const vercel = JSON.parse(read("vercel.json"));
  const h = vercel.headers.find((x) => x.source === "/sw.js");
  assert.ok(h && h.headers.some((x) => x.key === "Cache-Control" && /no-cache/.test(x.value)), "sw.js не кэшируется — иначе обновление не дойдёт");
});
