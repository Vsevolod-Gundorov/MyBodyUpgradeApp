# Body Upgrade — заметки для работы над кодом

- Любой интерфейс делается и проверяется по `docs/UI_RULES.md`. Это обязательные правила,
  включая раздел «Что уже говорил владелец» и раздел «Проверка перед выкладкой».
- Архитектура MVC: `data/` — чистые данные и функции, `js/model/` — без DOM, `js/view/` — только разметка,
  `js/controller/` — без HTML. Границы проверяет `tests/architecture.test.mjs`.
- После любой правки в `js/`, `css/`, `data/` или `index.html` — `node tools/build-sw.mjs`, иначе `tests/sw.test.mjs` упадёт.
- Тесты: `node --test tests/*.mjs`; база — `npm run test:db` (нужен `TEST_PG_ADMIN_URL`); e2e — `tests/e2e/*.mjs`.
- Общение с владельцем — по-русски.
