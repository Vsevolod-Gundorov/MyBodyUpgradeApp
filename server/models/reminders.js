// Модель: напоминания. Запросы — только с параметрами.

export const putSettings = (userId, { supp, rest, tz, slots }) => ({
  text: `INSERT INTO reminder_settings (user_id, supp, rest, tz_min, slots, updated_at)
         VALUES ($1::bigint, $2::boolean, $3::boolean, $4::smallint, $5::jsonb, now())
         ON CONFLICT (user_id) DO UPDATE SET supp = EXCLUDED.supp, rest = EXCLUDED.rest, tz_min = EXCLUDED.tz_min,
           slots = EXCLUDED.slots, updated_at = now()
         RETURNING supp, rest`,
  params: [String(userId), supp, rest, tz, JSON.stringify(slots)],
});

export const getSettings = (userId) => ({
  text: "SELECT supp, rest, tz_min, slots FROM reminder_settings WHERE user_id = $1::bigint",
  params: [String(userId)],
});

/** Запуск по расписанию: все, кто включил добавки (политика rs_cron пускает только их). */
export const suppUsers = () => ({ text: "SELECT user_id, tz_min, slots FROM reminder_settings WHERE supp ORDER BY user_id LIMIT 5000" });

/** Что уже отмечено в журнале за день: ключи «добавка@слот». */
export const takenOn = (userId, day) => ({
  text: "SELECT coalesce(data->'buffs'->'log'->$2::text, '{}'::jsonb) AS taken FROM journals WHERE user_id = $1::bigint",
  params: [String(userId), day],
});

/** Застолбить отправку: вторая попытка с тем же ключом ничего не вернёт. */
export const claim = (userId, key) => ({
  text: `INSERT INTO reminder_sent (user_id, key) VALUES ($1::bigint, $2::text)
         ON CONFLICT (user_id, key) DO NOTHING RETURNING key`,
  params: [String(userId), key],
});

export const markSent = (userId, key, messageId, deleteAfterSec) => ({
  text: `UPDATE reminder_sent SET message_id = $3::bigint, delete_at = now() + make_interval(secs => $4::integer)
         WHERE user_id = $1::bigint AND key = $2::text`,
  params: [String(userId), key, String(messageId), deleteAfterSec],
});

export const unclaim = (userId, key) => ({
  text: "DELETE FROM reminder_sent WHERE user_id = $1::bigint AND key = $2::text AND message_id IS NULL",
  params: [String(userId), key],
});

/** Сообщения, которым пора исчезнуть (у этого человека). */
export const dueDeletes = (userId) => ({
  text: `SELECT key, message_id FROM reminder_sent
         WHERE user_id = $1::bigint AND NOT deleted AND message_id IS NOT NULL AND delete_at <= now() LIMIT 50`,
  params: [String(userId)],
});

export const markDeleted = (userId, key) => ({
  text: "UPDATE reminder_sent SET deleted = true WHERE user_id = $1::bigint AND key = $2::text",
  params: [String(userId), key],
});

/** Старое не копим: записи старше двух суток не нужны ни для повторов, ни для удаления. */
export const sweepSent = (userId) => ({
  text: "DELETE FROM reminder_sent WHERE user_id = $1::bigint AND created_at < now() - interval '2 days' AND (deleted OR message_id IS NULL)",
  params: [String(userId)],
});

export const startRest = (userId, token, sec) => ({
  text: `INSERT INTO rest_timers (user_id, token, fire_at, cancelled)
         VALUES ($1::bigint, $2::text, now() + make_interval(secs => $3::integer), false)
         ON CONFLICT (user_id) DO UPDATE SET token = EXCLUDED.token, fire_at = EXCLUDED.fire_at, cancelled = false
         RETURNING fire_at`,
  params: [String(userId), token, sec],
});

/** Таймер всё ещё этот и не отменён? */
export const restAlive = (userId, token) => ({
  text: "SELECT 1 AS ok FROM rest_timers WHERE user_id = $1::bigint AND token = $2::text AND NOT cancelled",
  params: [String(userId), token],
});

export const cancelRest = (userId) => ({
  text: "UPDATE rest_timers SET cancelled = true WHERE user_id = $1::bigint RETURNING token",
  params: [String(userId)],
});
