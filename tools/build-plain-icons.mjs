#!/usr/bin/env node
// Генератор штрихового набора иконок для темы «Чистая» → data/icons-plain.js
//
// Источник: Lucide (ISC, https://lucide.dev) — 24×24, обводка 2px, один стиль.
// Выбран из-за лицензии, единой сетки и того, что это де-факто стандарт
// современных интерфейсов (shadcn/ui и всё, что от него растёт).
//
//   npm pack lucide-static && tar xzf lucide-static-*.tgz
//   node tools/build-plain-icons.mjs ./package/icons
//
// Фэнтезийные иконки (меч, шлем, наковальня, драконы) заменяются на предметные.
// Анатомические иконки движений (data/icons-exercise.js) НЕ трогаем: они и так
// человеческие и в обеих темах одинаковы.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const SRC = process.argv[2] || "./package/icons";

// имя в приложении → имя иконки Lucide
const MAP = {
  /* --- разделы и общая навигация --- */
  helm: "user-round", sword: "dumbbell", flask: "pill", meat: "utensils", scroll: "line-chart",
  /* --- квесты и программа --- */
  anvil: "dumbbell", dagger: "zap", pillars: "footprints", tower: "building-2",
  mountain: "mountain", peak: "triangle", tree: "tree-pine", wings: "wind",
  spine: "spline", sun: "sun", moon: "moon", flame: "flame", hourglass: "timer",
  sigil: "shield", shield: "shield", gem: "gem", book: "book-open",
  muscle: "dumbbell", lightning: "zap", weight: "weight", endurance: "heart-pulse",
  /* --- питание и добавки --- */
  capsule: "pill", pill: "pill", potion: "flask-conical", droplet: "droplet",
  leaf: "leaf", wheat: "wheat", avocado: "salad",
  /* --- служебное --- */
  flag: "flag", search: "search", close: "x", help: "circle-question-mark",
  stopwatch: "timer", arsenal: "layout-grid", save: "download", archive: "archive",
  /* --- снаряды (icons-ui) --- */
  bb: "dumbbell", db: "dumbbell", machine: "cog", cable: "cable", bw: "person-standing", bwp: "user-round-plus",
  "m-superset": "repeat", "m-dropset": "trending-down",
  /* --- достижения: 75 фэнтезийных медалей сводятся к предметным значкам --- */
  trophy: "trophy", "trophy-cup": "trophy", "laurels-trophy": "trophy", "podium-winner": "trophy",
  podium: "trophy", medal: "medal", "star-medal": "medal", "ribbon-medal": "medal",
  medallist: "medal", "sport-medal": "medal", "laurel-crown": "award", "imperial-crown": "crown",
  "beveled-star": "star", "barbed-star": "star", "star-cycle": "star",
  "crossed-swords": "swords", "on-target": "target", "thor-hammer": "hammer",
  "dragon-head": "flame", "spartan-helmet": "shield-half", "knight-banner": "flag",
  "duality-mask": "venetian-mask", "mailed-fist": "hand-fist", fist: "hand-fist",
  "strong-man": "dumbbell", biceps: "dumbbell", "leg-armor": "footprints",
  "armor-upgrade": "shield-plus", "rune-stone": "square-asterisk", ankh: "infinity",
  "over-infinity": "infinity", cycle: "refresh-cw", "return-arrow": "undo-2",
  calendar: "calendar", "calendar-half": "calendar-check", footprint: "footprints",
  stairs: "chart-no-axes-column-increasing", "stairs-3d": "chart-no-axes-column-increasing", "stairs-goal": "trending-up",
  "crossed-chains": "link", "wavy-chains": "link", "andromeda-chain": "link",
  giant: "person-standing", rock: "mountain", "falling-boulder": "mountain-snow",
  "brick-pile": "brick-wall", "stone-tower": "building-2", volcano: "flame", mountains: "mountain",
  "weight-scale": "scale", "kitchen-scale": "scale", kettle: "coffee", cauldron: "cooking-pot",
  meal: "utensils", steak: "beef", broccoli: "salad", cutlery: "utensils-crossed",
  fountain: "glass-water", chalice: "wine", vial: "test-tube", herbs: "sprout",
  notebook: "notebook-pen", checklist: "list-checks", owl: "moon-star", sunrise: "sunrise",
  "tired-eye": "eye-off", lotus: "flower", meditation: "brain", "stopwatch-ach": "timer",
};

const miss = [];
const out = {};
for (const [name, lucide] of Object.entries(MAP)) {
  const f = join(SRC, `${lucide}.svg`);
  if (!existsSync(f)) { miss.push(`${name} → ${lucide}`); continue; }
  const svg = readFileSync(f, "utf8");
  const inner = svg
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>[\s\S]*$/, "")
    .replace(/\s+/g, " ")
    .replace(/>\s+</g, "><")
    .trim();
  if (!inner) { miss.push(`${name} → ${lucide} (пусто)`); continue; }
  out[name] = inner;
}
if (miss.length) { console.error("нет таких иконок в Lucide:\n  " + miss.join("\n  ")); process.exit(1); }

const body = Object.entries(out)
  .map(([k, v]) => `  ${/^[a-z][a-z0-9]*$/i.test(k) ? k : JSON.stringify(k)}: ${JSON.stringify(v)},`)
  .join("\n");
writeFileSync("data/icons-plain.js", `// СГЕНЕРИРОВАНО tools/build-plain-icons.mjs — правьте карту имён там, а не здесь.
// Штриховой набор темы «Чистая». Источник: Lucide (ISC, https://lucide.dev),
// сетка 24×24, обводка 2px. Рисуются обводкой, а не заливкой, поэтому идут
// отдельным полем stroke: true — icon() добавляет нужные атрибуты сам.
export const PLAIN_ICONS = {
${body}
};
export const PLAIN_VB = "0 0 24 24";
`);
console.log(`data/icons-plain.js: ${Object.keys(out).length} иконок`);
