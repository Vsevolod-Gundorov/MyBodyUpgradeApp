// Отдельная база Postgres на каждый прогон, устроенная как на Neon:
// владелец базы — не суперпользователь, но с CREATEROLE и BYPASSRLS
// (TEST_OWNER_NOBYPASS=1 — без BYPASSRLS: на Neon оно бывает только через членство в роли).
// Нужен адрес администратора в TEST_PG_ADMIN_URL (локально или в CI); без него
// тесты базы пропускаются.
import { randomBytes } from "node:crypto";
import pg from "pg";

export const ADMIN_URL = process.env.TEST_PG_ADMIN_URL || "";
export const skip = ADMIN_URL ? false : "нет TEST_PG_ADMIN_URL — тесты на живой базе пропущены";

const urlFor = (base, user, password, db) => {
  const u = new URL(base);
  u.username = user; u.password = password; u.pathname = `/${db}`;
  return u.toString();
};

export async function freshDatabase() {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  const name = `buapp_test_${process.pid}`;
  const ownerPw = randomBytes(12).toString("hex"), strangerPw = randomBytes(12).toString("hex");
  try {
    const lit = (s) => admin.escapeLiteral(s);
    const old = await admin.query("SELECT datname FROM pg_database WHERE datname LIKE 'buapp_test_%'");
    for (const { datname } of old.rows) await admin.query(`DROP DATABASE ${admin.escapeIdentifier(datname)} WITH (FORCE)`);
    for (const r of ["bu_web", "bu_owner", "bu_stranger"]) await admin.query(`DROP ROLE IF EXISTS ${r}`);
    await admin.query(`CREATE ROLE bu_owner LOGIN CREATEROLE ${process.env.TEST_OWNER_NOBYPASS ? "NOBYPASSRLS" : "BYPASSRLS"} PASSWORD ${lit(ownerPw)}`);
    await admin.query(`CREATE ROLE bu_stranger LOGIN PASSWORD ${lit(strangerPw)}`);
    // роль приложения общая на весь кластер: если её уже завела другая база (локальная
    // разработка), владельцу тестовой базы нужно право ею распоряжаться — как у её создателя
    const { rows } = await admin.query("SELECT 1 FROM pg_roles WHERE rolname = 'bu_app'");
    if (rows.length) await admin.query("GRANT bu_app TO bu_owner WITH ADMIN OPTION");
    await admin.query(`CREATE DATABASE ${name} OWNER bu_owner`);
  } finally { await admin.end(); }

  return {
    name,
    ownerUrl: urlFor(ADMIN_URL, "bu_owner", ownerPw, name),
    strangerUrl: urlFor(ADMIN_URL, "bu_stranger", strangerPw, name),
    async drop() {
      const a = new pg.Client({ connectionString: ADMIN_URL });
      await a.connect();
      try {
        await a.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
        for (const r of ["bu_web", "bu_owner", "bu_stranger"]) await a.query(`DROP ROLE IF EXISTS ${r}`);
        // bu_app убираем, только если она больше нигде не нужна
        await a.query("DROP ROLE IF EXISTS bu_app").catch(() => {});
      } finally { await a.end(); }
    },
  };
}
