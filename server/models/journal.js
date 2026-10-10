// Модель: журнал атлета и его версии. Запросы — только с параметрами.

export const getJournal = (userId) => ({
  text: "SELECT rev, data, updated_at FROM journals WHERE user_id = $1::bigint",
  params: [String(userId)],
});

/**
 * Записать журнал, если сервер не ушёл вперёд (оптимистичная блокировка).
 * Клиент сообщает baseRev — ревизию сервера, от которой считал свои изменения.
 *   журнала ещё нет                  → создаём (это и есть переезд)
 *   журнал есть и rev = baseRev       → обновляем
 *   журнал есть, а rev ≠ baseRev       → ничего не пишем: изменения с другого устройства
 * В одном запросе: запись + копия в историю версий. Внешний SELECT видит
 * состояние ДО записи — это и есть текущая ревизия сервера на случай конфликта.
 * Версия пишется при переезде и не чаще раза в versionEverySec секунд: журнал
 * сохраняется через пару секунд после каждой правки, и без этого 30 версий
 * покрывали бы одну тренировку, а не последние дни.
 */
export const saveJournal = ({ userId, dataJson, rev, baseRev, sizeBytes, reason, versionEverySec = 0 }) => ({
  text: `WITH up AS (
           INSERT INTO journals AS j (user_id, data, rev, size_bytes)
           VALUES ($1::bigint, $2::jsonb, $3::bigint, $4::integer)
           ON CONFLICT (user_id) DO UPDATE
             SET data = EXCLUDED.data, rev = EXCLUDED.rev, size_bytes = EXCLUDED.size_bytes, updated_at = now()
             WHERE j.rev = $5::bigint
           RETURNING j.rev, j.updated_at
         ), ver AS (
           INSERT INTO journal_versions (user_id, rev, data, reason)
           SELECT $1::bigint, rev, $2::jsonb, $6::text FROM up
           WHERE $6::text = 'migrate' OR NOT EXISTS (
             SELECT 1 FROM journal_versions
             WHERE user_id = $1::bigint AND created_at > now() - make_interval(secs => $7::integer))
           RETURNING id
         )
         SELECT (SELECT rev FROM up) AS saved_rev,
                (SELECT updated_at FROM up) AS updated_at,
                (SELECT rev FROM journals WHERE user_id = $1::bigint) AS server_rev`,
  params: [String(userId), dataJson, rev, sizeBytes, baseRev, reason, versionEverySec],
});

/**
 * Оставить последние keep версий, но не больше maxBytes на человека.
 * Самая свежая и версия переезда (исходный журнал) остаются всегда.
 */
export const pruneVersions = (userId, keep, maxBytes) => ({
  text: `DELETE FROM journal_versions
         WHERE user_id = $1::bigint
           AND id NOT IN (
             SELECT id FROM (
               SELECT id, reason,
                      row_number() OVER w AS n,
                      sum(size_bytes) OVER w AS total
               FROM journal_versions WHERE user_id = $1::bigint
               WINDOW w AS (ORDER BY id DESC)
             ) t
             WHERE reason = 'migrate' OR n = 1 OR (n <= $2::integer AND total <= $3::bigint))`,
  params: [String(userId), keep, maxBytes],
});
