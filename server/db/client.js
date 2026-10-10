// Доступ к базе. Единственный способ выполнить запрос — через этот модуль.
//
// Каждый запрос — объект { text, params } с плейсхолдерами $1, $2…: значения
// уходят в Postgres отдельно от текста запроса и никогда не склеиваются с ним.
// Это и есть защита от SQL-инъекций; тест в tests/server-sql.test.mjs следит,
// чтобы ни один запрос в server/ не собирался из строк.
//
// Запросы от имени пользователя идут в одной транзакции под ролью bu_app:
//   SELECT set_config('app.user_id', <id>, true)  — чей это запрос (до конца транзакции)
//   SET LOCAL ROLE bu_app                         — роль без обхода RLS и без прав на схему
// Политики RLS в базе пускают роль только к строкам этого пользователя. Даже
// если в коде появится ошибка в WHERE, чужие строки базе просто не отдадутся.
//
// Два режима подключения:
//   одна строка DATABASE_URL (по умолчанию) — пользовательские запросы идут от
//     владельца базы с SET LOCAL ROLE. Это защищает от ошибок в коде, но не от
//     произвольного SQL (его можно было бы откатить RESET ROLE) — от него
//     защищают параметры: текст запросов неизменяем, тест это проверяет;
//   DATABASE_URL_APP — отдельный логин, состоящий в bu_app и больше ни в чём.
//     Тогда граница жёсткая: даже RESET ROLE оставляет запрос без прав владельца.
//     Владелец остаётся только для миграций.

export const APP_ROLE = "bu_app";

const SET_USER = "SELECT set_config('app.user_id', $1, true)";
const SET_ROLE = "SET LOCAL ROLE bu_app";   // та же роль, что APP_ROLE; в тексте SQL нет подстановок

/**
 * @param execute     async (queries, opts) => rows[][] — выполнить запросы в ОДНОЙ транзакции (владелец)
 * @param appExecute  то же для отдельного логина приложения (DATABASE_URL_APP), если он есть
 */
export function createDb(execute, appExecute = null) {
  const run = appExecute || execute;
  return {
    /** Отдельный ли логин у приложения (жёсткая граница) или только SET ROLE. */
    isolation: appExecute ? "login" : "role",
    /** Служебные запросы от владельца базы: только миграции. */
    owner: (queries, opts) => execute(queries, opts),
    /** От имени приложения без пользователя: ограничение частоты, проверка здоровья. */
    app: async (queries, opts) => (await run([{ text: SET_ROLE }, ...queries], opts)).slice(1),
    /** От имени конкретного пользователя: всё, что касается его журнала. */
    asUser: async (userId, queries, opts) => {
      if (!/^\d{1,20}$/.test(String(userId))) throw new Error("bad user id");
      return (await run([{ text: SET_USER, params: [String(userId)] }, { text: SET_ROLE }, ...queries], opts)).slice(2);
    },
  };
}

/** Исполнитель для Neon (Vercel): вся транзакция — один HTTPS-запрос, без постоянных соединений. */
export async function neonExecutor(databaseUrl) {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(databaseUrl);
  return (queries, { readOnly = false } = {}) =>
    sql.transaction((txn) => queries.map((q) => txn.query(q.text, q.params || [])),
      { isolationLevel: "ReadCommitted", readOnly });
}

/**
 * Исполнитель для обычного Postgres (свой сервер, локальная разработка, тесты):
 * пул соединений, каждая пачка запросов — BEGIN … COMMIT, при ошибке — ROLLBACK.
 */
export async function pgExecutor(databaseUrl, { max = 5 } = {}) {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: databaseUrl, max });
  // обрыв простаивающего соединения (перезапуск базы) не должен ронять процесс
  pool.on("error", (e) => console.error(`db pool: ${e.code || "connection lost"}`));
  const exec = async (queries, { readOnly = false } = {}) => {
    const c = await pool.connect();
    try {
      await c.query(readOnly ? "BEGIN ISOLATION LEVEL READ COMMITTED READ ONLY" : "BEGIN ISOLATION LEVEL READ COMMITTED");
      const out = [];
      for (const q of queries) out.push((await c.query(q.text, q.params || [])).rows);
      await c.query("COMMIT");
      return out;
    } catch (e) {
      await c.query("ROLLBACK").catch(() => {});
      throw e;
    } finally { c.release(); }
  };
  exec.end = () => pool.end();
  return exec;
}

/** Какой исполнитель взять: Neon по умолчанию, обычный Postgres — по DATABASE_DRIVER=pg. */
export const makeExecutor = (databaseUrl, driver) =>
  (driver === "pg" ? pgExecutor(databaseUrl) : neonExecutor(databaseUrl));
