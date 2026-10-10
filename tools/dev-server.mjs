// Локальный сервер: статика приложения + /api на тех же обработчиках, что и на Vercel.
// Пригодится для разработки, тестов и как основа для своего сервера после Vercel.
//
//   DATABASE_URL=postgres://… DATABASE_DRIVER=pg BOT_TOKEN=… ALLOWED_USERS=… \
//     node tools/dev-server.mjs            (PORT, по умолчанию 8787; слушает только 127.0.0.1)
//
// Отдаёт только то, что отдаёт и Vercel: никаких server/, tests/, tools/, .env и т. п.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { Readable } from "node:stream";
import { handleJournal } from "../server/controllers/journal.js";
import { handleHealth } from "../server/controllers/health.js";
import { handleFoods } from "../server/controllers/foods.js";
import { defaultDeps } from "../server/deps.js";

const ROOT = new URL("..", import.meta.url).pathname;
const PORT = Number(process.env.PORT || 8787);
const PUBLIC = ["index.html", "sw.js", "js/", "css/", "data/", "assets/"];
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };
const vercel = JSON.parse(await readFile(join(ROOT, "vercel.json"), "utf8"));
const SECURITY = Object.fromEntries(vercel.headers[0].headers.map((h) => [h.key, h.value]));
const ROUTES = { "/api/journal": handleJournal, "/api/health": handleHealth, "/api/foods": handleFoods };

async function serveApi(req, res, handler) {
  const url = `http://${req.headers.host}${req.url}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
  headers.set("x-real-ip", req.socket.remoteAddress || "unknown");   // как Vercel: адрес выставляет сервер, не клиент
  headers.delete("x-forwarded-host");                                // и хост тоже: клиенту не верим
  const hasBody = !["GET", "HEAD"].includes(req.method);
  const request = new Request(url, { method: req.method, headers, body: hasBody ? Readable.toWeb(req) : undefined, duplex: "half" });
  let response;
  try { response = await handler(request, await defaultDeps()); } catch (e) {
    console.error(`api: ${e && e.code ? e.code : "internal"}`);
    response = Response.json({ error: "internal" }, { status: 500 });
  }
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

async function serveStatic(req, res) {
  let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (path === "/") path = "/index.html";
  const rel = normalize(path).replace(/^[/\\]+/, "");
  const file = join(ROOT, rel);
  const allowed = !rel.split(sep).some((p) => p.startsWith(".")) && PUBLIC.some((p) => rel === p || rel.startsWith(p));
  if (!allowed || !file.startsWith(ROOT)) { res.writeHead(404, SECURITY); return res.end("not found"); }
  try {
    if (!(await stat(file)).isFile()) throw new Error("dir");
    res.writeHead(200, { ...SECURITY, "content-type": TYPES[extname(file)] || "application/octet-stream", "cache-control": "no-cache" });
    res.end(await readFile(file));
  } catch { res.writeHead(404, SECURITY); res.end("not found"); }
}

createServer((req, res) => {
  const pathname = new URL(req.url, "http://x").pathname;
  const handler = ROUTES[pathname];
  (handler ? serveApi(req, res, handler) : serveStatic(req, res)).catch(() => { res.writeHead(500); res.end(); });
}).listen(PORT, "127.0.0.1", () => console.log(`http://127.0.0.1:${PORT}`));
