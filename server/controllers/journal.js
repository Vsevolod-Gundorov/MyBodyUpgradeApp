// Контроллер: GET и PUT /api/journal — журнал атлета.
//   GET → { exists:false } | { exists:true, rev, updatedAt, data }
//   PUT { rev, baseRev, data, reason? } → { rev, updatedAt } | 409 { error:"conflict", serverRev }
import { LIMITS } from "../config.js";
import { BodyTooLarge, fail, json, readBody } from "../http.js";
import { getJournal, pruneVersions, saveJournal } from "../models/journal.js";
import * as rate from "../models/rateLimit.js";
import { touchUser } from "../models/user.js";
import { ValidationError, parseJournalBody } from "../security/validate.js";
import { conflictView, journalView, savedView } from "../views/journal.js";
import { guard, logDbError } from "./guard.js";

export async function handleJournal(request, deps) {
  if (request.method !== "GET" && request.method !== "PUT") return fail(405, "method_not_allowed", { allow: "GET, PUT" });
  const g = await guard(request, deps);
  if (g.response) return g.response;
  const { user } = g;
  const { db } = deps;

  if (request.method === "GET") {
    try {
      const [, rows] = await db.asUser(user.id, [touchUser(user.id, user.username), getJournal(user.id)]);
      return json(200, journalView(rows[0]));
    } catch (e) { logDbError("journal.get", e); return fail(503, "db_unavailable"); }
  }

  // PUT: только JSON — простая HTML-форма с чужого сайта так не отправит
  const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (type !== "application/json") return fail(415, "unsupported_media_type");

  try {
    const [[w]] = await db.app([rate.hit(`w:${user.id}`, LIMITS.RATE_WRITE.windowSec)]);
    if (Number(w.hits) > LIMITS.RATE_WRITE.max) return fail(429, "rate_limited", { "retry-after": String(LIMITS.RATE_WRITE.windowSec) });
  } catch (e) { logDbError("rate", e); return fail(503, "db_unavailable"); }

  let body;
  try {
    const text = await readBody(request, LIMITS.BODY_BYTES);
    body = parseJournalBody(text);
  } catch (e) {
    if (e instanceof BodyTooLarge) return fail(413, "too_large");
    if (e instanceof ValidationError) return fail(400, e.code);
    if (e instanceof TypeError) return fail(400, "bad_encoding");   // не UTF-8
    throw e;
  }

  const dataJson = JSON.stringify(body.data);
  try {
    const [, [row]] = await db.asUser(user.id, [
      touchUser(user.id, user.username),
      saveJournal({ userId: user.id, dataJson, rev: body.rev, baseRev: body.baseRev, sizeBytes: Buffer.byteLength(dataJson), reason: body.reason }),
      pruneVersions(user.id, LIMITS.VERSIONS_KEPT),
    ]);
    if (row.saved_rev == null) return json(409, conflictView(row));
    return json(200, savedView(row));
  } catch (e) { logDbError("journal.put", e); return fail(503, "db_unavailable"); }
}
