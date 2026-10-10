// Модель: пользователь. Запросы — только с параметрами.

/** Завести пользователя при первом входе или отметить, что он заходил. */
export const touchUser = (id, username) => ({
  text: `INSERT INTO users (id, username) VALUES ($1::bigint, $2::text)
         ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, last_seen_at = now()`,
  params: [String(id), username],
});

/** Отметить визит уже заведённого пользователя. Пусто в ответе — его ещё нет в базе. */
export const seenUser = (id, username) => ({
  text: `UPDATE users SET last_seen_at = now(), username = $2::text
         WHERE id = $1::bigint
         RETURNING id`,
  params: [String(id), username],
});

/** Сколько места занимает база — перед регистрацией нового человека. */
export const databaseSize = () => ({ text: "SELECT pg_database_size(current_database()) AS bytes" });
