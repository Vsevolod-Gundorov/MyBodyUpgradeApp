// Зависимости обработчиков: настройки и доступ к базе. Собираются один раз на
// экземпляр функции и переиспользуются между запросами; в тестах подменяются.
import { config } from "./config.js";
import { createDb, makeExecutor } from "./db/client.js";

let cached = null;   // { key, db }

export async function defaultDeps(env = process.env) {
  const cfg = config(env);
  if (!cfg.configured) return { cfg, db: null };
  const key = `${cfg.driver}|${cfg.databaseUrl}|${cfg.appDatabaseUrl}`;
  if (!cached || cached.key !== key) {
    const owner = await makeExecutor(cfg.databaseUrl, cfg.driver);
    const app = cfg.appDatabaseUrl ? await makeExecutor(cfg.appDatabaseUrl, cfg.driver) : null;
    cached = { key, db: createDb(owner, app) };
  }
  return { cfg, db: cached.db };
}
