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
  h=$(git log --all -p --no-color 2>/dev/null | grep -nIE "$TOKEN_RE" | head -5 || true)
  if [ -n "$h" ]; then echo "  ОПАСНО: токен встречается в истории — смени токен в BotFather"; fail=1
  else echo "  ok  в истории токенов нет"; fi
fi

echo
if [ "$fail" = "0" ]; then echo "Чисто."; else echo "Есть находки — разберись до пуша."; fi
exit "$fail"
