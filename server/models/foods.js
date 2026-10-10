// Модель: общий каталог продуктов. Запросы — только с параметрами.

/** Экранировать спецсимволы LIKE: «%» и «_» в запросе ищутся как обычные символы. */
export const likeEscape = (s) => String(s).replace(/[\\%_]/g, (c) => "\\" + c);

/**
 * Поиск: все слова запроса входят в название (в любом порядке) или название похоже
 * на запрос (опечатки). Сначала — начинающиеся с первого слова, потом самые похожие
 * и самые употребляемые.
 * @param words слова запроса в нижнем регистре
 */
export const searchFoods = (words, limit) => ({
  text: `SELECT code, name, k, p, f, cb, fb, fb_est, drink, hy, sv, uses FROM foods
         WHERE search LIKE ALL ($1::text[]) OR search % $2::text
         ORDER BY (search LIKE $3::text) DESC, word_similarity($2::text, search) DESC, uses DESC
         LIMIT $4::integer`,
  params: [words.map((w) => `%${likeEscape(w)}%`), words.join(" "), `${likeEscape(words[0])}%`, limit],
});

export const getFood = (code) => ({
  text: `SELECT code, name, k, p, f, cb, fb, fb_est, drink, hy, sv, uses, checked_at > now() - interval '30 days' AS fresh FROM foods WHERE code = $1::text`,
  params: [code],
});

/** Продукт снова выбрали — он популярнее в поиске у всех. */
export const bumpFood = (code) => ({
  text: "UPDATE foods SET uses = uses + 1 WHERE code = $1::text",
  params: [code],
});

/** Записать перепроверенный в Open Food Facts продукт (новый или обновлённый). */
export const upsertFood = (code, food) => ({
  text: `INSERT INTO foods AS t (code, name, k, p, f, cb, fb, fb_est, drink, hy, sv)
         VALUES ($1::text, $2::text, $3::smallint, $4::real, $5::real, $6::real, $7::real, $8::boolean, $9::boolean, $10::real, $11::real)
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name, k = EXCLUDED.k, p = EXCLUDED.p, f = EXCLUDED.f, cb = EXCLUDED.cb, fb = EXCLUDED.fb,
           fb_est = EXCLUDED.fb_est, drink = EXCLUDED.drink, hy = EXCLUDED.hy, sv = EXCLUDED.sv,
           uses = t.uses + 1, checked_at = now()
         RETURNING code, name, k, p, f, cb, fb, fb_est, drink, hy, sv, uses`,
  params: [code, food.n, food.k, food.p, food.f, food.cb, food.fb, !!food.fbEst, !!food.drink, food.drink ? food.hy : null, food.sv ?? null],
});
