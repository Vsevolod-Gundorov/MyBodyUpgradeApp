// Модель: ограничение частоты запросов (фиксированное окно). Запросы — только с параметрами.

/** +1 к счётчику корзины в текущем окне; возвращает, сколько стало. */
export const hit = (bucket, windowSec) => ({
  text: `INSERT INTO rate_limits (bucket, window_start, hits)
         VALUES ($1::text, to_timestamp(floor(extract(epoch FROM now()) / $2::integer) * $2::integer), 1)
         ON CONFLICT (bucket, window_start) DO UPDATE SET hits = rate_limits.hits + 1
         RETURNING hits`,
  params: [bucket, windowSec],
});

/** Сколько уже набрано в текущем окне — без увеличения. */
export const peek = (bucket, windowSec) => ({
  text: `SELECT coalesce(max(hits), 0) AS hits FROM rate_limits
         WHERE bucket = $1::text AND window_start = to_timestamp(floor(extract(epoch FROM now()) / $2::integer) * $2::integer)`,
  params: [bucket, windowSec],
});

/** Убрать старые окна. Вызывается изредка, на случайном запросе. */
export const sweep = () => ({ text: "DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'" });
