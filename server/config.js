// Настройки сервера. Всё секретное — только из переменных окружения Vercel,
// в коде и в репозитории секретов нет и быть не должно.
//
//   DATABASE_URL    строка подключения Postgres (Neon её прописывает сам)
//   BOT_TOKEN       токен бота: им проверяется подпись данных Telegram
//   DATABASE_URL_APP необязательно: отдельный логин приложения (см. SETUP.md) —
//                   жёсткая граница между запросами пользователей и владельцем базы
//   DATABASE_DRIVER необязательно: "pg" — обычный Postgres (свой сервер), иначе Neon
//   ALLOWED_USERS   необязательно: закрытая бета — через запятую @username или числовые id.
//                   Не задано — регистрация открыта: любой, кто открыл приложение через
//                   бота (подпись Telegram проверена), заводится в базе сам.
//
// Чего нет — того нет: без BOT_TOKEN или DATABASE_URL сервер честно отвечает
// «не настроен», а приложение продолжает работать локально, как раньше.

export const LIMITS = Object.freeze({
  BODY_BYTES: 3 * 1024 * 1024,     // журнал за 3 года ≈ 2 МБ; Vercel режет на 4,5 МБ
  AUTH_MAX_AGE_SEC: 24 * 3600,     // подпись Telegram живёт сутки: приложение получает новую при каждом открытии
  AUTH_FUTURE_SKEW_SEC: 300,       // часы бывают неточными, но не на сутки вперёд
  VERSIONS_KEPT: 30,               // столько прошлых версий журнала храним для отката…
  VERSIONS_BYTES: 15 * 1024 * 1024, // …но не больше 15 МБ на человека (первая версия переезда — всегда)
  VERSION_EVERY_SEC: 15 * 60,      // новая версия — не чаще раза в 15 минут: история на дни, а не на минуты
  // ограничения частоты: окно в секундах, сколько запросов в окне
  RATE_IP: { windowSec: 60, max: 120 },       // любой запрос с одного адреса
  RATE_FAIL: { windowSec: 600, max: 20 },     // неудачные входы с одного адреса
  RATE_WRITE: { windowSec: 60, max: 40 },     // записи журнала одним пользователем
  // открытая регистрация: новые аккаунты с одного адреса и всего
  SIGNUP_IP: { windowSec: 24 * 3600, max: 5 },
  SIGNUP_ALL: { windowSec: 3600, max: 100 },
  // бесплатная база Neon — 0,5 ГБ: ближе к пределу новых не заводим, у старых всё работает
  DB_CAP_BYTES: 400 * 1024 * 1024,
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

/** Пускает ли сервер этого пользователя: без списка — всех, со списком — только из него. */
export function isAllowed(user, allowed) {
  if (!user) return false;
  if (!allowed.ids.size && !allowed.names.size) return true;
  if (allowed.ids.has(String(user.id))) return true;
  return Boolean(user.username) && allowed.names.has(String(user.username).toLowerCase());
}
