// Генератор data/icons-exercise.js — значки движений для «Арсенала».
//
// Зачем генератор, а не ручная правка: контуры берутся из двух открытых наборов,
// и важно, чтобы в репозитории лежало ровно то, что в наборе, без случайных
// «подправил руками». Правится здесь — таблица PICK, — а файл пересобирается.
//
// Наборы (скачиваются как npm-тарболы @iconify-json/<lib>):
//   game-icons  — game-icons.net, CC BY 3.0, авторы Lorc, Delapouite, sbed и др.
//   healthicons — healthicons.org, MIT (public domain по заявлению авторов)
//
// Запуск:  node tools/build-exercise-icons.mjs <dir>
//   где <dir>/game-icons/package/icons.json и <dir>/healthicons/package/icons.json
//
// Правило раскладки значков описано в PICK: компаунд узнаётся по движению,
// изоляция — по целевой мышце. Оно же продублировано в самом выходном файле.

import fs from "node:fs";
import path from "node:path";

const SRC = process.argv[2];
if (!SRC) { console.error("usage: node tools/build-exercise-icons.mjs <dir-with-iconify-packages>"); process.exit(1); }

const LIBS = {
  A: { dir: "game-icons", credit: "game-icons.net · CC BY 3.0" },
  B: { dir: "healthicons", credit: "healthicons.org · MIT" },
};

// ключ приложения -> [набор, имя в наборе, что изображено]
const PICK = [
  ["ex-push",      "A", "push",                "фигура толкает блок — горизонтальный жим"],
  ["ex-lift-up",   "A", "weight-lifting-up",   "штанга над головой — вертикальный жим"],
  ["ex-pull",      "A", "pull",                "фигура тянет груз на себя — горизонтальная тяга"],
  ["ex-pullup",    "A", "muscle-up",           "тело на вытянутых руках — вертикальная тяга"],
  ["ex-deadlift",  "A", "weight-lifting-down", "фигура над штангой на полу — становая и наклоны"],
  ["ex-squat",     "B", "exercise-weights",    "присед со штангой"],
  ["ex-lunge",     "A", "kneeling",            "колено на полу — выпады"],
  ["ex-grip",      "A", "hand-grip",           "кистевой эспандер — хват и переноска"],
  ["ex-chest",     "A", "muscular-torso",      "грудные мышцы"],
  ["ex-shrug",     "A", "shrug",               "плечи вверх — шраги"],
  ["ex-delts",     "A", "shoulder-armor",      "плечевой сегмент — дельты"],
  ["ex-rear",      "A", "split-body",          "разведение в стороны — задняя дельта"],
  ["ex-biceps",    "A", "biceps",              "согнутая рука — бицепс"],
  ["ex-triceps",   "A", "arm",                 "выпрямленная рука — разгибание"],
  ["ex-forearm",   "A", "forearm",             "предплечье"],
  ["ex-knee",      "A", "knee-cap",            "коленный сустав — разгибание ноги"],
  ["ex-legcurl",   "B", "leg",                 "согнутая нога — сгибание ноги"],
  ["ex-legs",      "A", "leg-armor",           "ноги в упоре — жим ногами"],
  ["ex-glutes",    "A", "pelvis-bone",         "таз — ягодичный мост"],
  ["ex-adductors", "A", "female-legs",         "сведённые ноги — приводящие"],
  ["ex-spine",     "B", "spine",               "позвонки — разгибатели спины"],
  ["ex-calf",      "B", "foot",                "стопа — подъёмы на носки"],
  ["ex-abs",       "A", "abdominal-armor",     "пресс"],
  ["ex-plank",     "A", "half-body-crawling",  "тело в упоре лёжа — планка"],
];

const load = (k) => {
  const p = path.join(SRC, LIBS[k].dir, "package", "icons.json");
  return JSON.parse(fs.readFileSync(p, "utf8"));
};
const libs = Object.fromEntries(Object.keys(LIBS).map((k) => [k, load(k)]));

/** Контуры набора -> безопасная вставка: только <path>, цвет наследуется. */
function clean(body, name) {
  const out = [];
  const re = /<path\b([^>]*)\/?>/g;
  let m, rest = body;
  while ((m = re.exec(body))) {
    const attrs = m[1];
    rest = rest.replace(m[0], "");
    const d = /\sd="([^"]+)"/.exec(attrs);
    if (!d) throw new Error(`${name}: путь без координат`);
    // fill-rule нужен: без него фигуры с отверстиями заливаются целиком
    const rule = /fill-rule="evenodd"/.test(attrs) ? ' fill-rule="evenodd"' : "";
    const clip = /clip-rule="evenodd"/.test(attrs) ? ' clip-rule="evenodd"' : "";
    out.push(`<path${rule}${clip} d="${d[1]}"/>`);
  }
  if (!out.length) throw new Error(`${name}: в значке нет ни одного пути`);
  if (/<[a-z]/i.test(rest)) throw new Error(`${name}: в значке есть что-то кроме путей: ${rest.slice(0, 60)}`);
  return out.join("");
}

const rows = PICK.map(([key, lib, name, note]) => {
  const lb = libs[lib];
  const ic = lb.icons[name];
  if (!ic) throw new Error(`в наборе ${LIBS[lib].dir} нет значка ${name}`);
  const w = ic.width || lb.width, h = ic.height || lb.height;
  return `  "${key}": { vb: "0 0 ${w} ${h}", inner: ${JSON.stringify(clean(ic.body, name))} },` +
         `  // ${LIBS[lib].dir}/${name} — ${note}`;
});

const head = `// Значки движений «Арсенала». ГЕНЕРИРУЕТСЯ: tools/build-exercise-icons.mjs
//
// Откуда контуры:
//   game-icons.net — CC BY 3.0, авторы Lorc, Delapouite, sbed и др.
//   healthicons.org — MIT (наборы отданы авторами в общественное достояние)
// Обработка: оставлены только <path>, заливка убрана (наследуется от текста).
//
// Правило раскладки: многосуставное движение узнаётся по самому движению
// (жим, тяга, присед), изоляция — по мышце, которую грузит. Поэтому у жима
// штанги и жима гантелей значок один: тело делает одно и то же, а снаряд
// виден по названию и в карточке движения.

export const EXERCISE_ICONS = {
${rows.join("\n")}
};

/* ---- раскладка ---- */

// движение важнее мышцы: компаунд узнаётся по паттерну
const BY_PATTERN = {
  pressH: "ex-push",
  pressV: "ex-lift-up",
  pullH:  "ex-pull",
  pullV:  "ex-pullup",
  hinge:  "ex-deadlift",
  squat:  "ex-squat",
  lunge:  "ex-lunge",
  carry:  "ex-grip",
  core:   "ex-abs",
};

// изоляция узнаётся по цели
const BY_GROUP = {
  chest: "ex-chest",
  back: "ex-pull",
  traps: "ex-shrug",
  delts: "ex-delts",
  rear: "ex-rear",
  biceps: "ex-biceps",
  triceps: "ex-triceps",
  forearms: "ex-forearm",
  quads: "ex-knee",
  hams: "ex-legcurl",
  glutes: "ex-glutes",
  adductors: "ex-adductors",
  lowback: "ex-spine",
  calves: "ex-calf",
  abs: "ex-abs",
};

// движения, где паттерн врёт про то, что видит глаз
const BY_ID = {
  legpress: "ex-legs",       // паттерн «присед», а на вид — упор ногами в платформу
  upright:  "ex-delts",      // паттерн «вертикальная тяга», работа — дельтовая
  "hip-thrust": "ex-glutes", // паттерн «тазовое доминирование», но это не становая
  hyper:    "ex-spine",      // как и наклоны в римском стуле — это разгибание спины
  "back-ext-45": "ex-spine",
  plank:    "ex-plank",      // кор, но статика: тело в упоре, а не скручивание
};

/** Каким значком показывать движение в списке и в карточке. */
export function exerciseIcon(ex) {
  if (!ex) return "ex-push";
  return BY_ID[ex.id] || (ex.pattern === "iso" ? BY_GROUP[ex.group] : BY_PATTERN[ex.pattern]) || BY_GROUP[ex.group] || "ex-push";
}

/** Разложено по правилам — для тестов и отладки. */
export const ICON_RULES = { BY_PATTERN, BY_GROUP, BY_ID };
`;

fs.writeFileSync("data/icons-exercise.js", head);
console.log(`data/icons-exercise.js: ${PICK.length} значков, ${(head.length / 1024).toFixed(1)} КБ`);
