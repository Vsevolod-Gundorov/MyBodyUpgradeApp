// Штрихкоды товаров: EAN-13, EAN-8, UPC-A, UPC-E (GTIN). Чистые функции.
//
// Камера иногда читает штрихкод с ошибкой в одной цифре. Последняя цифра штрихкода —
// контрольная: если она не сходится, это не тот товар, и искать его незачем.

/** Контрольная цифра GTIN верна? (8, 12, 13 или 14 цифр) */
export function gtinValid(code) {
  const s = String(code || "");
  if (!/^\d{8}$|^\d{12,14}$/.test(s)) return false;
  const digits = s.split("").map(Number);
  const check = digits.pop();
  // справа налево: веса 3, 1, 3, 1…
  const sum = digits.reverse().reduce((a, d, i) => a + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** UPC-E (8 цифр, начинается с 0 или 1) → UPC-A (12 цифр). */
export function upcEtoA(e) {
  const s = String(e || "");
  if (!/^[01]\d{7}$/.test(s)) return null;
  const [ns, d1, d2, d3, d4, d5, d6, ck] = s.split("");
  let mid;
  if ("012".includes(d6)) mid = `${d1}${d2}${d6}0000${d3}${d4}${d5}`;
  else if (d6 === "3") mid = `${d1}${d2}${d3}00000${d4}${d5}`;
  else if (d6 === "4") mid = `${d1}${d2}${d3}${d4}00000${d5}`;
  else mid = `${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  return `${ns}${mid}${ck}`;
}

/**
 * Привести прочитанное к штрихкоду для поиска: только цифры, контрольная сходится.
 * UPC-A (12) дополняется нулём до EAN-13 — так товар хранится в Open Food Facts.
 * @returns строка из 8 или 13–14 цифр, или null
 */
export function normalizeBarcode(raw, format = "") {
  let s = String(raw || "").replace(/\D/g, "");
  if (/upc_e/i.test(format) && s.length === 8) { const a = upcEtoA(s); if (a) s = a; }
  if (!gtinValid(s)) return null;
  if (s.length === 12) s = "0" + s;
  return s;
}
