#!/usr/bin/env bash
# Проверка, что в репозиторий не попали секреты: токены бота, .env, приватные ключи.
# Запуск: ./tools/check-secrets.sh [--history]
set -uo pipefail
cd "$(dirname "$0")/.."

# токен бота: 8–10 цифр, двоеточие, 35 символов
TOKEN_RE='[0-9]{6,12}:[A-Za-z0-9_-]{30,}'
KEY_RE='BEGIN (RSA|OPENSSH|EC|PGP) PRIVATE KEY'
fail=0

echo "Рабочее дерево:"
if git ls-files --error-unmatch .env >/dev/null 2>&1; then
  echo "  ОПАСНО: .env под контролем версий"; fail=1
else
  echo "  ok  .env не отслеживается"
fi

hits=$(git grep -nIE "$TOKEN_RE" -- . ':!*.example' ':!tools/check-secrets.sh' ':!.githooks/*' 2>/dev/null || true)
if [ -n "$hits" ]; then echo "  ОПАСНО: похоже на токен бота:"; echo "$hits" | head -5; fail=1
else echo "  ok  токенов бота нет"; fi

keys=$(git grep -nIE "$KEY_RE" -- . ':!tools/check-secrets.sh' 2>/dev/null || true)
if [ -n "$keys" ]; then echo "  ОПАСНО: приватный ключ в файлах"; fail=1
else echo "  ok  приватных ключей нет"; fi

if [ "${1:-}" = "--history" ]; then
  echo "История коммитов:"
  # Утечку нельзя «удалить» новым коммитом: старый остаётся доступен по ссылке навсегда.
  # Поэтому известные и уже отозванные утечки перечислены в .secret-exposures,
  # а падает проверка только на НОВОМ коммите с секретом.
  known=""
  [ -f .secret-exposures ] && known=$(grep -oE '^[0-9a-f]{40}' .secret-exposures || true)
  found=$(git log --all --format='%H' -E -G"$TOKEN_RE" 2>/dev/null || true)
  new_hits=""
  for c in $found; do
    printf '%s\n' "$known" | grep -qx "$c" || new_hits="$new_hits $c"
  done
  if [ -n "$new_hits" ]; then
    echo "  ОПАСНО: секрет в новых коммитах —$new_hits"
    echo "  Отзови токен в BotFather, затем впиши эти коммиты в .secret-exposures"
    fail=1
  elif [ -n "$found" ]; then
    n=$(printf '%s\n' "$found" | grep -c . || true)
    echo "  ok  новых утечек нет (известных и отозванных: $n — см. .secret-exposures)"
  else
    echo "  ok  в истории токенов нет"
  fi
fi
echo
if [ "$fail" = "0" ]; then echo "Чисто."; else echo "Есть находки — разберись до пуша."; fi
exit "$fail"
