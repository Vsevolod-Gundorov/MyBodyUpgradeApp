// Open Food Facts со стороны сервера: только чтение одного продукта по штрихкоду —
// когда человек действительно выбрал этот продукт («1 запрос = 1 действие пользователя»).
const FIELDS = "code,product_name,product_name_ru,brands,nutriments,categories_tags,serving_quantity";
const UA = "BodyUpgrade/1.0 (Telegram Mini App; catalog check)";

/** @returns продукт OFF или null (нет такого); бросает при сбое сети или ответа */
export async function fetchOffProduct(code, { timeoutMs = 4000 } = {}) {
  if (!/^\d{4,32}$/.test(code)) return null;
  const url = `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${FIELDS}`;
  const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(timeoutMs), redirect: "error" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`off ${res.status}`);
  const body = await res.json();
  return body && body.status === 1 && body.product ? body.product : null;
}
