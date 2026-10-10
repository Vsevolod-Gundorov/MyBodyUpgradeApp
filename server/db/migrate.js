// Применение миграций. Вызывается лениво перед первым запросом каждого экземпляра
// функции; повторные вызовы ничего не делают. Одновременный запуск из нескольких
// экземпляров разводит advisory-блокировка: второй ждёт первого и видит, что всё готово.
import { MIGRATIONS, SCHEMA_VERSION } from "./migrations.js";

const LOCK_KEY = 7_401_119_222;   // произвольное число — «замок» миграций этого приложения
let ready = null;

export function ensureSchema(db) {
  if (!ready) {
    ready = db.owner([
      { text: "SELECT pg_advisory_xact_lock($1)", params: [LOCK_KEY] },
      { text: "CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, name text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())" },
      ...MIGRATIONS.map((m) => ({ text: m.sql })),
      { text: "SELECT max(version) AS version FROM schema_migrations" },
    ]).then((res) => {
      const v = Number(res[res.length - 1][0].version);
      if (v < SCHEMA_VERSION) throw new Error(`schema ${v} < ${SCHEMA_VERSION}`);
      return v;
    }).catch((e) => { ready = null; throw e; });   // ошибка — пробуем снова на следующем запросе
  }
  return ready;
}

/** Только для тестов: забыть, что схема уже проверена. */
export function _resetSchemaCache() { ready = null; }
