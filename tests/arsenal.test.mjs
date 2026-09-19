// Арсенал движений: карта мышц, поиск, значки. node --test tests/arsenal.test.mjs
// Главное, что здесь защищается: на карте не может быть мышцы-невидимки,
// а у снаряда и приёма всегда есть значок — иначе строка списка молча теряет смысл.
import { test } from "node:test";
import assert from "node:assert/strict";
import { MUSCLE_ORDER, MUSCLES, EQUIP, EXERCISES, searchExercises } from "../data/exercises.js";
import { METHODS } from "../data/program.js";
import { BODY_VIEWS, MAPPED_GROUPS, shapeSvg, coverLevel, coverLabel } from "../data/bodymap.js";
import { UI_ICONS, EQUIP_ICON, METHOD_ICON } from "../data/icons-ui.js";

/* ---------- карта тела ---------- */

test("каждая мышца из справочника есть на карте тела", () => {
  for (const g of MUSCLE_ORDER) {
    assert.ok(MAPPED_GROUPS.includes(g), `${MUSCLES[g]} (${g}) не нарисована ни спереди, ни сзади`);
  }
});

test("на карте нет фигур для несуществующих групп", () => {
  for (const g of MAPPED_GROUPS) assert.ok(MUSCLE_ORDER.includes(g), `лишняя группа на карте: ${g}`);
});

test("у обоих видов есть основа и хотя бы по одной фигуре на группу", () => {
  assert.equal(BODY_VIEWS.length, 2);
  for (const v of BODY_VIEWS) {
    assert.ok(v.base.length > 5, `${v.title}: основа пустая`);
    for (const [g, shapes] of Object.entries(v.muscles)) {
      assert.ok(shapes.length >= 1, `${v.title}: у ${g} нет фигур`);
    }
  }
});

test("фигуры превращаются в корректный SVG", () => {
  const all = BODY_VIEWS.flatMap((v) => [...v.base, ...Object.values(v.muscles).flat()]);
  for (const sh of all) {
    const svg = shapeSvg(sh);
    assert.match(svg, /^<(path|ellipse)\b/, `неизвестная фигура: ${JSON.stringify(sh)}`);
    assert.ok(!/NaN|undefined/.test(svg), `дырка в координатах: ${svg}`);
    if (sh[0] === "e") {
      const [, cx, cy, rx, ry] = sh;
      assert.ok(rx > 0 && ry > 0, `нулевой радиус: ${JSON.stringify(sh)}`);
      // фигура должна помещаться в холст 170×380, иначе мышца уедет за край
      assert.ok(cx - rx >= 0 && cx + rx <= 170, `по горизонтали за холстом: ${JSON.stringify(sh)}`);
      assert.ok(cy - ry >= 0 && cy + ry <= 380, `по вертикали за холстом: ${JSON.stringify(sh)}`);
    }
  }
});

test("уровень покрытия: два активных дня — норма, один — мало, ноль сетов — вне плана", () => {
  assert.equal(coverLevel({ days: 2, sets: 10 }), "ok");
  assert.equal(coverLevel({ days: 3, sets: 14 }), "ok");
  assert.equal(coverLevel({ days: 1, sets: 6 }), "low");
  assert.equal(coverLevel({ days: 0, sets: 2 }), "low", "косвенная работа — это всё же работа");
  assert.equal(coverLevel({ days: 0, sets: 0 }), "none");
  assert.equal(coverLevel(null), "none");
  assert.equal(coverLevel(undefined), "none");
});

test("подпись покрытия согласована с числом", () => {
  assert.equal(coverLabel({ days: 2, sets: 11 }), "2×/нед · 11 сетов");
  assert.equal(coverLabel({ days: 2, sets: 1 }), "2×/нед · 1 сет");
  assert.equal(coverLabel({ days: 3, sets: 4 }), "3×/нед · 4 сета");
  assert.equal(coverLabel({ days: 0, sets: 3 }), "косвенно · 3 сета");
  assert.equal(coverLabel({ days: 0, sets: 0 }), "не задействована");
  assert.equal(coverLabel(null), "не задействована");
});

/* ---------- значки ---------- */

test("у каждого снаряда есть свой значок", () => {
  for (const key of Object.keys(EQUIP)) {
    assert.ok(EQUIP_ICON[key], `нет значка для снаряда «${EQUIP[key]}»`);
    assert.ok(UI_ICONS[EQUIP_ICON[key]], `значок ${EQUIP_ICON[key]} не нарисован`);
  }
  const used = new Set(Object.values(EQUIP_ICON));
  assert.equal(used.size, Object.keys(EQUIP).length, "снаряды не должны делить один значок");
});

test("у каждого приёма интенсивности есть свой значок", () => {
  for (const key of Object.keys(METHODS)) {
    assert.ok(UI_ICONS[METHOD_ICON(key)], `нет значка для приёма «${METHODS[key].name}»`);
  }
});

test("значки — валидный самодостаточный SVG без внешних ссылок", () => {
  for (const [name, g] of Object.entries(UI_ICONS)) {
    assert.match(g.vb, /^0 0 24 24$/, `${name}: значки должны быть в одной сетке`);
    assert.match(g.inner, /^<path /, `${name}: пустой значок`);
    assert.ok(!/https?:|url\(|<image|<script/.test(g.inner), `${name}: внешняя ссылка внутри значка`);
    assert.ok(!/fill="(?!currentColor)/.test(g.inner), `${name}: цвет должен наследоваться`);
  }
});

/* ---------- поиск по странице ---------- */

test("поиск находит по названию, мышце, снаряду и паттерну", () => {
  const byName = searchExercises("жим штанги лёжа");
  assert.equal(byName.length, 1);
  assert.equal(byName[0].id, "bench");
  assert.ok(searchExercises("грудь").every((e) => e.group === "chest"), "по мышце — только её движения");
  assert.ok(searchExercises("блок").every((e) => e.equip === "cable"), "по снаряду — только блочные");
  assert.ok(searchExercises("изоляция").every((e) => e.pattern === "iso"));
});

test("поиск не зависит от регистра и буквы ё", () => {
  const a = searchExercises("ГРУДЬ").map((e) => e.id);
  const b = searchExercises("грудь").map((e) => e.id);
  assert.deepEqual(a, b);
  assert.ok(searchExercises("лежа").length > 0, "«лежа» должно находить «лёжа»");
  assert.deepEqual(searchExercises("лежа").map((e) => e.id), searchExercises("лёжа").map((e) => e.id));
});

test("пустой запрос возвращает весь пул, бессмыслица — ничего", () => {
  assert.equal(searchExercises("").length, EXERCISES.length);
  assert.equal(searchExercises("   ").length, EXERCISES.length);
  assert.equal(searchExercises(null).length, EXERCISES.length);
  assert.equal(searchExercises("кракозябра").length, 0);
});

test("поиск не выдумывает движений и не теряет их", () => {
  const ids = new Set(EXERCISES.map((e) => e.id));
  for (const q of ["штанга", "гантели", "тренажёр", "свой вес", "тяга", "присед"]) {
    const res = searchExercises(q);
    assert.ok(res.length > 0, `по «${q}» должно что-то находиться`);
    for (const e of res) assert.ok(ids.has(e.id), `${q}: пришло движение не из пула`);
    assert.equal(new Set(res.map((e) => e.id)).size, res.length, `${q}: дубликаты в выдаче`);
  }
});
