// Контроллер: GET /api/health — проверка настройки без входа и без данных.
// Показывает только то, что нужно владельцу после деплоя: база отвечает, схема
// на месте, роль приложения действительно не обходит RLS.
import { fail, json } from "../http.js";
import { SCHEMA_VERSION } from "../db/migrations.js";
import { guard, logDbError } from "./guard.js";

export async function handleHealth(request, deps) {
  if (request.method !== "GET") return fail(405, "method_not_allowed", { allow: "GET" });
  if (!deps.cfg.configured) return json(200, { ok: false, configured: false });
  const g = await guard(request, deps, { auth: false });
  if (g.response) return g.response;
  try {
    const [[role], [tables]] = await deps.db.app([
      { text: "SELECT current_user AS role, rolbypassrls AS bypass FROM pg_roles WHERE rolname = current_user" },
      { text: "SELECT bool_and(relrowsecurity AND relforcerowsecurity) AS forced FROM pg_class WHERE relname = ANY($1::text[]) AND relnamespace = 'public'::regnamespace", params: [["users", "journals", "journal_versions"]] },
    ], { readOnly: true });
    const rls = role.bypass === false && tables.forced === true;
    return json(200, { ok: rls, configured: true, db: "ok", schema: SCHEMA_VERSION, rls, isolation: deps.db.isolation });
  } catch (e) { logDbError("health", e); return fail(503, "db_unavailable"); }
}
