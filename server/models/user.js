// Модель: пользователь. Запросы — только с параметрами.

/** Завести пользователя при первом входе или отметить, что он заходил. */
export const touchUser = (id, username) => ({
  text: `INSERT INTO users (id, username) VALUES ($1::bigint, $2::text)
         ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, last_seen_at = now()`,
  params: [String(id), username],
});
