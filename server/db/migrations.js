// Схема базы. Миграции только добавляются в конец и никогда не правятся задним
// числом: на проде уже применённая миграция повторно не выполняется.
//
// Каждая миграция — один DO-блок, который сам проверяет, применена ли она.
// Так весь набор можно отправить одной транзакцией без ветвлений на клиенте
// (HTTP-транзакции Neon не интерактивные), а повторный запуск ничего не ломает.

export const MIGRATIONS = [
  {
    version: 1,
    name: "пользователи, журналы, версии, лимиты; роль приложения и RLS",
    sql: `
DO $mig$
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = 1) THEN RETURN; END IF;

  -- Роль приложения: не может войти сама, не обходит RLS, не создаёт и не меняет схему.
  -- Владелец базы может обходить RLS (на Neon — через neon_superuser), поэтому всё
  -- пользовательское идёт через неё. Это и правило для ручных запросов: см. SETUP.md.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bu_app') THEN
    CREATE ROLE bu_app NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  GRANT bu_app TO CURRENT_USER;

  CREATE TABLE users (
    id            bigint PRIMARY KEY CHECK (id > 0),       -- id в Telegram (подписан Telegram)
    username      text CHECK (username IS NULL OR username ~ '^[A-Za-z0-9_]{1,64}$'),
    created_at    timestamptz NOT NULL DEFAULT now(),
    last_seen_at  timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE journals (
    user_id     bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data        jsonb  NOT NULL CHECK (jsonb_typeof(data) = 'object'),
    rev         bigint NOT NULL CHECK (rev >= 0),
    size_bytes  integer NOT NULL CHECK (size_bytes BETWEEN 2 AND 4194304),
    updated_at  timestamptz NOT NULL DEFAULT now()
  );

  -- прошлые версии журнала: откат после ошибки, переезда или конфликта устройств
  CREATE TABLE journal_versions (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rev         bigint NOT NULL,
    data        jsonb  NOT NULL,
    reason      text   NOT NULL CHECK (reason IN ('migrate', 'save')),
    created_at  timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX journal_versions_user_idx ON journal_versions (user_id, id DESC);

  -- ограничение частоты: только хэши адресов и id, счётчики и окна
  CREATE TABLE rate_limits (
    bucket        text NOT NULL CHECK (length(bucket) <= 80),
    window_start  timestamptz NOT NULL,
    hits          integer NOT NULL DEFAULT 0,
    PRIMARY KEY (bucket, window_start)
  );

  -- права: ничего по умолчанию, роли приложения — ровно то, что нужно
  REVOKE ALL ON users, journals, journal_versions, rate_limits FROM PUBLIC;
  GRANT USAGE ON SCHEMA public TO bu_app;
  GRANT SELECT, INSERT, UPDATE ON users TO bu_app;
  GRANT SELECT, INSERT, UPDATE ON journals TO bu_app;
  GRANT SELECT, INSERT, DELETE ON journal_versions TO bu_app;
  GRANT SELECT, INSERT, UPDATE, DELETE ON rate_limits TO bu_app;

  -- строки пользователя видит и меняет только он сам: id берётся из app.user_id,
  -- который сервер ставит из ПРОВЕРЕННОЙ подписи Telegram. Нет id — нет строк.
  ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  ALTER TABLE users FORCE ROW LEVEL SECURITY;
  CREATE POLICY users_own ON users TO bu_app
    USING (id = nullif(current_setting('app.user_id', true), '')::bigint) WITH CHECK (id = nullif(current_setting('app.user_id', true), '')::bigint);

  ALTER TABLE journals ENABLE ROW LEVEL SECURITY;
  ALTER TABLE journals FORCE ROW LEVEL SECURITY;
  CREATE POLICY journals_own ON journals TO bu_app
    USING (user_id = nullif(current_setting('app.user_id', true), '')::bigint) WITH CHECK (user_id = nullif(current_setting('app.user_id', true), '')::bigint);

  ALTER TABLE journal_versions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE journal_versions FORCE ROW LEVEL SECURITY;
  CREATE POLICY versions_own ON journal_versions TO bu_app
    USING (user_id = nullif(current_setting('app.user_id', true), '')::bigint) WITH CHECK (user_id = nullif(current_setting('app.user_id', true), '')::bigint);

  INSERT INTO schema_migrations (version, name) VALUES (1, 'init');
END
$mig$;`,
  },
];

export const SCHEMA_VERSION = Math.max(...MIGRATIONS.map((m) => m.version));
