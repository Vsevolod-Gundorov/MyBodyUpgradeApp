// Вид: что сервер отдаёт клиенту о журнале. Только нужные поля, числа — числами.
// Драйверы Postgres возвращают bigint строкой, а время — объектом Date.

const iso = (t) => (t instanceof Date ? t.toISOString() : (t ? new Date(t).toISOString() : null));

export const journalView = (row) => (row
  ? { exists: true, rev: Number(row.rev), updatedAt: iso(row.updated_at), data: row.data }
  : { exists: false });

export const savedView = (row) => ({ rev: Number(row.saved_rev), updatedAt: iso(row.updated_at) });

export const conflictView = (row) => ({ error: "conflict", serverRev: row.server_rev == null ? null : Number(row.server_rev) });
