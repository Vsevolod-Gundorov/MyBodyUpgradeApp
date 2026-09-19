#!/usr/bin/env bash
# Обновить локальные шрифты из Google Fonts.
# Шрифты лежат в репозитории специально: так Google не видит IP и User-Agent пользователей.
# Запуск: ./tools/fetch-fonts.sh (нужен python3 и curl)
set -euo pipefail
cd "$(dirname "$0")/.."
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
CSS="https://fonts.googleapis.com/css2?family=Cormorant:wght@500;600;700&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
curl -sS -A "$UA" "$CSS" -o "$tmp/g.css"
mkdir -p assets/fonts
python3 - "$tmp" <<'PY'
import re, sys, pathlib
tmp = pathlib.Path(sys.argv[1])
css = (tmp / "g.css").read_text(encoding="utf-8")
keep = {"latin", "latin-ext", "cyrillic", "cyrillic-ext"}   # вьетнамский и греческий не нужны
out, files = [], {}
for subset, block in re.findall(r"/\*\s*([a-z\-]+)\s*\*/\s*(@font-face\s*\{.*?\})", css, re.S):
    if subset not in keep: continue
    fam = re.search(r"font-family: '([^']+)'", block).group(1)
    wgt = re.search(r"font-weight: (\d+)", block).group(1)
    url = re.search(r"url\((https://fonts\.gstatic\.com[^)]+)\)", block).group(1)
    name = f"{fam.replace(' ', '')}-{wgt}-{subset}.woff2".lower()
    files[name] = url
    out.append(f"/* {subset} */\n" + block.replace(url, f"../assets/fonts/{name}"))
(tmp / "files.txt").write_text("\n".join(f"{n} {u}" for n, u in files.items()), encoding="utf-8")
head = ("/* Шрифты лежат локально: так Google не видит IP и User-Agent пользователей приложения.\n"
        "   Файлы скачаны из Google Fonts (Open Font License), набор срезан до латиницы и кириллицы.\n"
        "   Обновить: tools/fetch-fonts.sh */\n")
pathlib.Path("css/fonts.css").write_text(head + "\n".join(out) + "\n", encoding="utf-8")
print(f"начертаний: {len(out)}")
PY
while read -r name url; do curl -sS -A "$UA" "$url" -o "assets/fonts/$name"; done < "$tmp/files.txt"
echo "файлов в assets/fonts: $(ls assets/fonts | wc -l)"
