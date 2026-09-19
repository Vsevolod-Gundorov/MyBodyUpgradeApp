// Арсенал движений: карта мышц, поиск, значки. node --test tests/arsenal.test.mjs
// Главное, что здесь защищается: на карте не может быть мышцы-невидимки,
// а у снаряда и приёма всегда есть значок — иначе строка списка молча теряет смысл.
import { test } from "node:test";
import assert from "node:assert/strict";
import { MUSCLE_ORDER, MUSCLES, EQUIP, EXERCISES, searchExercises } from "../data/exercises.js";
import { METHODS } from "../data/program.js";
import { BODY_VIEWS, MAPPED_GROUPS, shapeSvg, coverLevel, coverVolume, coverLabel } from "../data/bodymap.js";
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

test("у обоих видов есть силуэт и хотя бы по одному контуру на группу", () => {
  assert.equal(BODY_VIEWS.length, 2);
  for (const v of BODY_VIEWS) {
    assert.match(v.viewBox, /^[\d\s.]+$/, `${v.title}: холст не задан`);
    assert.ok(v.base.length > 5, `${v.title}: силуэт пустой`);
    for (const [g, list] of Object.entries(v.muscles)) {
      assert.ok(list.length >= 1, `${v.title}: у ${g} нет контуров`);
    }
  }
});

test("контуры модели валидны и лежат внутри своего холста", () => {
  for (const v of BODY_VIEWS) {
    const [vx, vy, vw, vh] = v.viewBox.split(/\s+/).map(Number);
    for (const d of [...v.base, ...Object.values(v.muscles).flat()]) {
      assert.match(d, /^M/, `путь должен начинаться с M: ${d.slice(0, 30)}`);
      assert.ok(!/NaN|undefined/.test(d), `дырка в координатах: ${d.slice(0, 40)}`);
      const [x, y] = (d.match(/-?\d*\.?\d+/g) || []).slice(0, 2).map(Number);
      assert.ok(x >= vx - 5 && x <= vx + vw + 5, `${v.title}: старт по горизонтали вне холста: ${x}`);
      assert.ok(y >= vy - 5 && y <= vy + vh + 5, `${v.title}: старт по вертикали вне холста: ${y}`);
    }
  }
});

test("контуры превращаются в SVG без потерь и без исполняемого содержимого", () => {
  for (const v of BODY_VIEWS) {
    for (const list of [v.base, ...Object.values(v.muscles)]) {
      const svg = shapeSvg(list);
      assert.equal((svg.match(/<path /g) || []).length, list.length);
      assert.ok(!/<script|onload=|https?:/.test(svg), "в контурах не должно быть ничего исполняемого");
    }
  }
  assert.equal(shapeSvg(null), "");
  assert.equal(shapeSvg([]), "");
});

test("объём задаёт насыщенность: до 8 сетов бледно, 15 и больше — в полную силу", () => {
  assert.equal(coverVolume({ days: 2, sets: 20 }), "hi");
  assert.equal(coverVolume({ days: 2, sets: 15 }), "hi");
  assert.equal(coverVolume({ days: 2, sets: 14.5 }), "mid");
  assert.equal(coverVolume({ days: 2, sets: 8 }), "mid");
  assert.equal(coverVolume({ days: 1, sets: 7.5 }), "lo");
  assert.equal(coverVolume({ days: 0, sets: 0 }), "lo");
  assert.equal(coverVolume(null), "lo");
});

test("частота и объём — независимые оси", () => {
  // редко, но помногу: цвет «мало дней», насыщенность полная
  assert.equal(coverLevel({ days: 1, sets: 18 }), "low");
  assert.equal(coverVolume({ days: 1, sets: 18 }), "hi");
  // часто, но по чуть-чуть: цвет «норма», насыщенность бледная
  assert.equal(coverLevel({ days: 3, sets: 6 }), "ok");
  assert.equal(coverVolume({ days: 3, sets: 6 }), "lo");
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
