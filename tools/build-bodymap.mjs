// Сборка data/bodymap.js: берёт анатомическую модель из открытой библиотеки
// и раскачивает её до телосложения атлета.
//
// Запуск (зависимости нужны только на сборке, в приложение не попадают):
//   mkdir -p /tmp/bm && cd /tmp/bm
//   npm pack react-native-body-highlighter@3.2.0 svgpath@2.6.0
//   tar xzf react-native-body-highlighter-3.2.0.tgz && mv package model
//   tar xzf svgpath-2.6.0.tgz && mv package svgpath
//   node <корень проекта>/tools/build-bodymap.mjs /tmp/bm
//
// Почему модель раскачивается, а не берётся как есть: исходная фигура обычного
// телосложения, а приложение про силовой тренинг — карта должна выглядеть как
// атлет. Ширина растёт по профилю высоты, руки переносятся отдельно (см. ниже).
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const deps = process.argv[2];
if (!deps) { console.error("Укажи папку с распакованными пакетами (см. шапку файла)"); process.exit(1); }
const require = createRequire(join(deps, "/"));
const svgpath = require(join(deps, "svgpath"));
const front = require(join(deps, "model/dist/assets/bodyFront.js")).bodyFront;
const back = require(join(deps, "model/dist/assets/bodyBack.js")).bodyBack;

/* ---------- раскачка ---------- */

// профиль ширины по вертикали: [y, коэффициент]. Узкая талия при широких плечах —
// то, что и отличает фигуру атлета от обычной.
const PROFILE = [
  [0, 1.0], [250, 1.0],      // голова и шея не трогаются
  [300, 1.18],               // трапеция
  [360, 1.46],               // дельты — главный признак массы
  [470, 1.42],               // грудь и плечо
  [560, 1.30],               // низ груди
  [660, 1.10],               // талия
  [720, 1.12],
  [800, 1.26],               // таз и ягодицы
  [900, 1.34],               // верх бедра
  [1080, 1.30],              // бедро
  [1180, 1.14],              // колено
  [1250, 1.26],              // икры
  [1330, 1.14],              // лодыжка
  [1448, 1.12],              // стопа
];
const round = (n) => Math.round(n * 100) / 100;
const kAt = (y) => {
  if (y <= PROFILE[0][0]) return PROFILE[0][1];
  for (let i = 1; i < PROFILE.length; i++) {
    const [y0, k0] = PROFILE[i - 1], [y1, k1] = PROFILE[i];
    if (y <= y1) return k0 + (k1 - k0) * ((y - y0) / (y1 - y0));
  }
  return PROFILE[PROFILE.length - 1][1];
};

/** Переписывает путь, растягивая координаты по заданному правилу. */
const rewrite = (d, warp) => {
  let out = "";
  svgpath(d).unarc().unshort().abs().iterate((seg, i, curX, curY) => {
    const cmd = seg[0], n = seg.slice(1);
    if (cmd === "Z" || cmd === "z") { out += "Z"; return; }
    // H и V теряют смысл: ширина зависит от высоты, поэтому они становятся линиями
    if (cmd === "H") { out += "L" + warp(n[0], curY); return; }
    if (cmd === "V") { out += "L" + warp(curX, n[0]); return; }
    const pairs = [];
    for (let k = 0; k < n.length; k += 2) pairs.push(warp(n[k], n[k + 1]));
    out += cmd + pairs.join(" ");
  });
  return out;
};

/** Корпус и ноги: ширина по профилю высоты. */
const bulk = (d, cx) => rewrite(d, (x, y) => `${round(cx + (x - cx) * kAt(y))} ${round(y)}`);

const bbox1 = (d) => {
  let minX = Infinity, maxX = -Infinity;
  svgpath(d).unarc().unshort().abs().iterate((seg, i, curX) => {
    const cmd = seg[0], n = seg.slice(1);
    if (cmd === "Z" || cmd === "z") return;
    if (cmd === "H") { minX = Math.min(minX, n[0]); maxX = Math.max(maxX, n[0]); return; }
    if (cmd === "V") { minX = Math.min(minX, curX); maxX = Math.max(maxX, curX); return; }
    for (let k = 0; k < n.length; k += 2) { minX = Math.min(minX, n[k]); maxX = Math.max(maxX, n[k]); }
  });
  return { minX, maxX };
};

/**
 * Рука обрабатывается иначе корпуса: на одной высоте с бедром висит кисть,
 * и общий профиль по вертикали разорвал бы руку на части. Поэтому вся рука
 * (или вся кисть) переносится наружу целиком — вслед за плечом — и утолщается
 * вокруг общей оси. Ось считается по всем контурам стороны сразу, иначе каждый
 * палец уехал бы к своему центру и кисть рассыпалась бы.
 */
const bulkArmGroup = (list, cx, { anchorY = 400, thick = 1.32, close = 0.95 } = {}) => {
  if (!list.length) return [];
  const k = kAt(anchorY) * close;   // close < 1 подтягивает руку: зазор подмышки тоже растянулся
  let minX = Infinity, maxX = -Infinity;
  for (const d of list) { const b = bbox1(d); minX = Math.min(minX, b.minX); maxX = Math.max(maxX, b.maxX); }
  const acx = (minX + maxX) / 2;
  const moved = cx + (acx - cx) * k;
  return list.map((d) => rewrite(d, (x, y) => `${round(moved + (x - acx) * thick)} ${round(y)}`));
};

/* ---------- раскладка ---------- */

const CX = { front: 362, back: 1086 };   // центр тела: модель хранит спину сдвинутой вправо
const ARM_SLUGS = new Set(["biceps", "triceps", "forearm", "hands"]);
const BASE_SLUGS = ["head", "hair", "neck", "hands", "ankles", "feet", "knees"];
const MAP_FRONT = {
  traps: ["trapezius"], delts: ["deltoids"], chest: ["chest"], biceps: ["biceps"],
  triceps: ["triceps"], forearms: ["forearm"], abs: ["abs", "obliques"],
  quads: ["quadriceps"], calves: ["tibialis", "calves"], adductors: ["adductors"],
};
const MAP_BACK = {
  traps: ["trapezius"], rear: ["deltoids"], back: ["upper-back"], triceps: ["triceps"],
  forearms: ["forearm"], lowback: ["lower-back"], glutes: ["gluteal"],
  hams: ["hamstring"], calves: ["calves"], adductors: ["adductors"],
};

const paths = (g, cx) => {
  const sides = [g.path?.left || [], g.path?.right || [], g.path?.common || []];
  if (ARM_SLUGS.has(g.slug)) {
    const thick = g.slug === "hands" ? 1.0 : 1.32;   // кисть только переносим, не раздуваем
    return sides.flatMap((side) => bulkArmGroup(side, cx, { thick }));
  }
  return sides.flat().map((d) => bulk(d, cx));
};
const bySlug = (model, cx) => Object.fromEntries(model.map((g) => [g.slug, paths(g, cx)]));
const F = bySlug(front, CX.front), B = bySlug(back, CX.back);
const pick = (src, slugs) => slugs.flatMap((s) => src[s] || []);
const baseOf = (src) => pick(src, BASE_SLUGS);
const musclesOf = (src, map) => Object.fromEntries(Object.entries(map).map(([g, slugs]) => {
  const p = pick(src, slugs);
  if (!p.length) throw new Error(`нет контуров для ${g}: ${slugs}`);
  return [g, p];
}));

// холст считается по готовой модели: после раскачки фигура шире исходной
// и вылезла бы за прежние границы — кисти обрезались краем viewBox
const bbox = (lists) => {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const d of lists.flat()) {
    const n = (d.match(/-?\d+(\.\d+)?/g) || []).map(Number);
    for (let i = 0; i < n.length; i += 2) {
      x0 = Math.min(x0, n[i]); x1 = Math.max(x1, n[i]);
      y0 = Math.min(y0, n[i + 1]); y1 = Math.max(y1, n[i + 1]);
    }
  }
  const m = 6;
  return `${Math.floor(x0 - m)} ${Math.floor(y0 - m)} ${Math.ceil(x1 - x0 + m * 2)} ${Math.ceil(y1 - y0 + m * 2)}`;
};

const q = (arr) => arr.map((d) => `    "${d}",`).join("\n");
const block = (obj) => Object.entries(obj).map(([g, arr]) => `  ${g}: [\n${q(arr)}\n  ],`).join("\n");

const header = `// Карта мышц: анатомическая модель тела с подсветкой проработанных групп.
//
// ФАЙЛ СОБРАН СКРИПТОМ tools/build-bodymap.mjs — руками не правится.
// Меняется либо раскладка «наша группа мышц → части модели», либо профиль
// раскачки в скрипте; после правки скрипт перезапускается.
//
// Контуры взяты из открытой библиотеки react-native-body-highlighter (MIT,
// © 2022 ELABBASSI Hicham) — полный текст лицензии в data/bodymap-LICENSE.txt.
//
// Исходная модель обычного телосложения, поэтому при сборке она раскачивается:
// ширина растёт по профилю высоты (дельты ×1.46, грудь ×1.42, талия ×1.10 —
// узкая талия и есть признак массы, бёдра ×1.34, икры ×1.26), голова, шея и
// стопы не трогаются. Руки переносятся наружу целиком вслед за плечом и
// утолщаются вокруг своей оси. Холст считается по готовой фигуре.
//
// Всё, что не является тренируемой группой (голова, шея, кисти, стопы, колени,
// приводящие), лежит в base и подсветке не подлежит.`;

const body = `
export const BODY_VIEWS = [
  {
    id: "front", title: "спереди", viewBox: "${bbox([baseOf(F), ...Object.values(musclesOf(F, MAP_FRONT))])}",
    base: [
${q(baseOf(F))}
    ],
    muscles: {
${block(musclesOf(F, MAP_FRONT))}
    },
  },
  {
    id: "back", title: "сзади", viewBox: "${bbox([baseOf(B), ...Object.values(musclesOf(B, MAP_BACK))])}",
    base: [
${q(baseOf(B))}
    ],
    muscles: {
${block(musclesOf(B, MAP_BACK))}
    },
  },
];
`;

const tail = `
/** Какие группы вообще есть на карте — по ним сверяется полнота. */
export const MAPPED_GROUPS = [...new Set(BODY_VIEWS.flatMap((v) => Object.keys(v.muscles)))];

/** Список контуров → SVG. */
export function shapeSvg(list) {
  return (list || []).map((d) => \`<path d="\${d}"/>\`).join("");
}

/**
 * Группы, которым цикл обязан давать два активных дня в неделю.
 * Если такая группа выпала из плана совсем — это дыра, а не мелочь,
 * поэтому на карте она горит красным, а не просто гаснет.
 */
export const CORE_MUSCLES = ["chest", "back", "delts", "biceps", "triceps",
  "quads", "hams", "glutes", "calves", "abs"];

/**
 * Насколько часто группа работает за неделю — этим задаётся цвет.
 * Порог «два активных дня» — то же правило, по которому собран цикл:
 * каждая мышца работает дважды в неделю, иначе неделя собрана криво.
 * @param entry запись покрытия { days, sets }
 * @param group ключ группы: для основных пропуск подсвечивается тревогой
 * @returns "ok" | "low" | "miss" | "none"
 */
export function coverLevel(entry, group) {
  if (!entry || !entry.sets) return CORE_MUSCLES.includes(group) ? "miss" : "none";
  if ((entry.days || 0) >= 2) return "ok";
  return "low";
}

/**
 * Недельный объём группы — этим задаётся насыщенность цвета.
 * Пороги по обзорам тренировочного объёма: ниже 8 рабочих сетов в неделю рост
 * почти не запускается, 8–14 — рабочий коридор, 15+ — верх переносимого
 * натуралом. Так с одного взгляда видно не только «работает ли мышца»,
 * но и «сколько ей достаётся».
 * @returns "hi" | "mid" | "lo"
 */
export function coverVolume(entry) {
  const sets = (entry && entry.sets) || 0;
  if (sets >= 15) return "hi";
  if (sets >= 8) return "mid";
  return "lo";
}

/** Подпись под фигурой и в подсказке: «2×/нед · 14 сетов» или «косвенно · 3 сета». */
export function coverLabel(entry) {
  if (!entry || !entry.sets) return "не задействована";
  const sets = Math.round(entry.sets * 10) / 10;
  const word = (n) => { const d = n % 100, u = n % 10;
    return d > 10 && d < 20 ? "сетов" : u === 1 ? "сет" : u >= 2 && u <= 4 ? "сета" : "сетов"; };
  const s = Number.isInteger(sets) ? \`\${sets} \${word(sets)}\` : \`\${String(sets).replace(".", ",")} сета\`;
  return entry.days ? \`\${entry.days}×/нед · \${s}\` : \`косвенно · \${s}\`;
}
`;

writeFileSync(join(root, "data/bodymap.js"), header + body + tail);
console.log("data/bodymap.js собран:", Object.keys(musclesOf(F, MAP_FRONT)).length, "групп спереди,",
  Object.keys(musclesOf(B, MAP_BACK)).length, "сзади");
