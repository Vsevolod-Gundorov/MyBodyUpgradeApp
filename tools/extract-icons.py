#!/usr/bin/env python3
"""Извлекает иконки из локального клона game-icons/icons в data/icons-achievements.js.

Обработка как у data/icons.js: убираем фоновый квадрат, убираем fill (цвет = currentColor).
Запуск: python3 tools/extract-icons.py /path/to/game-icons/icons
"""
import re, sys, json, os
SRC = sys.argv[1] if len(sys.argv) > 1 else "/home/user/game-icons/icons"
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "icons-achievements.js")
CREDITS = os.path.join(os.path.dirname(__file__), "..", "assets", "icons", "CREDITS.md")

# имя в приложении -> слаг game-icons (автор/имя)
ICONS = {
  "footprint": "lorc/footprint", "sport-medal": "delapouite/sport-medal", "laurels-trophy": "delapouite/laurels-trophy",
  "laurel-crown": "lorc/laurel-crown", "imperial-crown": "delapouite/imperial-crown", "ankh": "lorc/ankh",
  "cycle": "lorc/cycle", "trophy-cup": "delapouite/trophy-cup", "star-cycle": "lorc/star-cycle",
  "star-medal": "delapouite/star-medal", "crossed-swords": "lorc/crossed-swords", "on-target": "lorc/on-target",
  "sunrise": "lorc/sunrise", "owl": "lorc/owl", "tired-eye": "delapouite/tired-eye",
  "spartan-helmet": "delapouite/spartan-helmet", "return-arrow": "lorc/return-arrow", "kettle": "delapouite/weight",
  "giant": "delapouite/giant", "rock": "lorc/rock", "falling-boulder": "lorc/falling-boulder", "brick-pile": "delapouite/brick-pile",
  "stone-tower": "lorc/stone-tower", "volcano": "lorc/volcano", "mountains": "lorc/mountains",
  "fist": "lorc/fist", "leg-armor": "delapouite/leg-armor", "mailed-fist": "lorc/mailed-fist", "strong-man": "delapouite/strong-man",
  "podium-winner": "delapouite/podium-winner", "trophy": "lorc/trophy", "weight-scale": "delapouite/weight-scale",
  "biceps": "delapouite/biceps", "armor-upgrade": "delapouite/armor-upgrade",
  "calendar": "delapouite/calendar", "crossed-chains": "lorc/crossed-chains", "wavy-chains": "lorc/wavy-chains",
  "andromeda-chain": "lorc/andromeda-chain", "calendar-half": "delapouite/calendar-half-year", "over-infinity": "lorc/over-infinity",
  "medallist": "delapouite/medallist", "ribbon-medal": "delapouite/ribbon-medal", "medal": "lorc/medal",
  "stairs": "delapouite/stairs", "stairs-3d": "delapouite/3d-stairs", "stairs-goal": "delapouite/stairs-goal", "podium": "delapouite/podium",
  "knight-banner": "delapouite/knight-banner", "duality-mask": "lorc/duality-mask", "beveled-star": "lorc/beveled-star",
  "barbed-star": "lorc/barbed-star", "lotus": "lorc/lotus", "meditation": "lorc/meditation",
  "meal": "delapouite/meal", "steak": "delapouite/steak", "fountain": "delapouite/water-fountain", "kitchen-scale": "delapouite/kitchen-scale",
  "cauldron": "lorc/cauldron", "broccoli": "delapouite/broccoli", "cutlery": "delapouite/fork-knife-spoon", "notebook": "delapouite/notebook",
  "checklist": "delapouite/checklist", "vial": "sbed/vial", "herbs": "delapouite/herbs-bundle", "chalice": "lorc/jeweled-chalice",
  "save": "delapouite/save", "archive": "delapouite/archive-research",
  "rune-stone": "lorc/rune-stone", "thor-hammer": "delapouite/thor-hammer", "dragon-head": "lorc/dragon-head",
}

BG = re.compile(r'<path d="M0 0h512v512H0z"/>')
out = {}
for name, slug in ICONS.items():
    p = os.path.join(SRC, slug + ".svg")
    svg = open(p, encoding="utf-8").read()
    vb = re.search(r'viewBox="([^"]+)"', svg).group(1)
    inner = re.search(r'<svg[^>]*>(.*)</svg>', svg, re.S).group(1)
    inner = BG.sub("", inner)
    inner = re.sub(r'\s*fill="#(?:fff|ffffff|000|000000)"', "", inner)
    inner = re.sub(r'\s*fill-opacity="[^"]*"', "", inner)
    inner = inner.strip()
    assert "<path" in inner and 'fill="' not in inner, name
    out[name] = {"vb": vb, "inner": inner}

lines = ["// Иконки достижений из game-icons.net (CC BY 3.0). Авторы: Lorc, Delapouite, sbed.",
         "// Сгенерировано tools/extract-icons.py: убран фон, заливка -> currentColor. См. assets/icons/CREDITS.md",
         "export const ACHIEVEMENT_ICONS = {"]
for name, g in out.items():
    lines.append(f'  {json.dumps(name)}: {{ vb: {json.dumps(g["vb"])}, inner: {json.dumps(g["inner"], ensure_ascii=False)} }},')
lines.append("};\n")
open(OUT, "w", encoding="utf-8").write("\n".join(lines))
print(f"written {len(out)} icons -> {OUT}")

# таблица для CREDITS.md
rows = "\n".join(f"| {n} | {s} |" for n, s in ICONS.items())
cred = open(CREDITS, encoding="utf-8").read()
marker = "## Иконки достижений"
block = f"{marker}\n\nСобраны в `data/icons-achievements.js` (скрипт `tools/extract-icons.py`).\n\n| в приложении | автор/слаг |\n|---|---|\n{rows}\n\n"
if marker in cred:
    cred = re.sub(re.escape(marker) + r".*?(?=\n## |\Z)", block.rstrip("\n") + "\n", cred, flags=re.S)
else:
    cred = cred.replace("## Прочее", block + "## Прочее")
open(CREDITS, "w", encoding="utf-8").write(cred)
print("credits updated")
