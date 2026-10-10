// Настройки сервера. Всё секретное — только из переменных окружения Vercel,
// в коде и в репозитории секретов нет и быть не должно.
//
//   DATABASE_URL    строка подключения Postgres (Neon её прописывает сам)
//   BOT_TOKEN       токен бота: им проверяется подпись данных Telegram
//   DATABASE_URL_APP необязательно: отдельный логин приложения (см. SETUP.md) —
//                   жёсткая граница между запросами пользователей и владельцем базы
//   DATABASE_DRIVER необязательно: "pg" — обычный Postgres (свой сервер), иначе Neon
//   ALLOWED_USERS   закрытая бета: через запятую @username или числовые id.
//                   Пусто или не задано — сервер не пускает никого.
//
// Чего нет — того нет: без BOT_TOKEN или DATABASE_URL сервер честно отвечает
// «не настроен», а приложение продолжает работать локально, как раньше.

export const LIMITS = Object.freeze({
  BODY_BYTES: 3 * 1024 * 1024,     // журнал за 3 года ≈ 2 МБ; Vercel режет на 4,5 МБ
  AUTH_MAX_AGE_SEC: 24 * 3600,     // подпись Telegram живёт сутки: приложение получает новую при каждом открытии
  AUTH_FUTURE_SKEW_SEC: 300,       // часы бывают неточными, но не на сутки вперёд
  VERSIONS_KEPT: 30,               // столько прошлых версий журнала храним для отката
  // ограничения частоты: окно в секундах, сколько запросов в окне
  RATE_IP: { windowSec: 60, max: 120 },       // любой запрос с одного адреса
  RATE_FAIL: { windowSec: 600, max: 20 },     // неудачные входы с одного адреса
  RATE_WRITE: { windowSec: 60, max: 40 },     // записи журнала одним пользователем
});

function parseAllowed(raw) {
  const ids = new Set(), names = new Set();
  String(raw || "").split(",").map((x) => x.trim()).filter(Boolean).forEach((x) => {
    if (/^\d{1,20}$/.test(x)) ids.add(x);
    else names.add(x.replace(/^@/, "").toLowerCase());
  });
  return { ids, names };
}

/** Конфигурация из окружения. Читается на каждый вызов: в тестах окружение меняется. */
export function config(env = process.env) {
  const allowed = parseAllowed(env.ALLOWED_USERS);
  return {
    databaseUrl: env.DATABASE_URL || "",
    appDatabaseUrl: env.DATABASE_URL_APP || "",
    driver: env.DATABASE_DRIVER === "pg" ? "pg" : "neon",
    botToken: env.BOT_TOKEN || "",
    allowed,
    configured: Boolean(env.DATABASE_URL && env.BOT_TOKEN),
  };
}

/** Пускает ли закрытая бета этого пользователя. По умолчанию — нет. */
export function isAllowed(user, allowed) {
  if (!user) return false;
  if (allowed.ids.has(String(user.id))) return true;
  return Boolean(user.username) && allowed.names.has(String(user.username).toLowerCase());
}
