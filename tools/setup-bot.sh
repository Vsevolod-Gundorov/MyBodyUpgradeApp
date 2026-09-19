#!/usr/bin/env bash
# Настройка телеграм-бота под мини-приложение: кнопка меню, описания, команды.
#
# Токен в репозиторий не попадает. Положи его в .env (файл закрыт в .gitignore):
#   cp .env.example .env && nano .env      # вписать BOT_TOKEN и APP_URL
#   ./tools/setup-bot.sh
# Либо разово через окружение: BOT_TOKEN=... APP_URL=... ./tools/setup-bot.sh
#
# Что делает скрипт (всё это есть в Bot API):
#   • кнопка меню в чате открывает мини-приложение
#   • имя, краткое и полное описание бота
#   • список команд
# Чего скрипт сделать не может: зарегистрировать само мини-приложение — команда /newapp
# есть только в BotFather, её нужно пройти руками один раз (см. README).

set -euo pipefail
cd "$(dirname "$0")/.."

# читаем .env, если он есть: переменные окружения имеют приоритет
if [ -f .env ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in ''|\#*) continue ;; esac
    key=${line%%=*}; val=${line#*=}
    key=$(printf '%s' "$key" | tr -d ' ')
    val=${val%\"}; val=${val#\"}; val=${val%\'}; val=${val#\'}
    [ -z "$key" ] && continue
    eval "current=\${$key-}"
    [ -z "$current" ] && export "$key=$val"
  done < .env
fi

: "${BOT_TOKEN:?Задай BOT_TOKEN в .env — токен от @BotFather}"
: "${APP_URL:?Задай APP_URL в .env — адрес приложения, например https://mybodyupgrade.vercel.app}"

API="https://api.telegram.org/bot${BOT_TOKEN}"
BTN_TEXT="${BTN_TEXT:-Кузница Тела}"

case "$APP_URL" in
  https://*) ;;
  *) echo "APP_URL должен начинаться с https:// — Telegram не откроет http"; exit 1 ;;
esac

call() {
  local method="$1" payload="$2" out ok
  out=$(curl -sS -X POST "${API}/${method}" -H 'Content-Type: application/json' -d "$payload" 2>&1 || true)
  out=${out//$BOT_TOKEN/***}   # чтобы токен не попал в вывод при ошибке
  ok=$(printf '%s' "$out" | sed -n 's/.*"ok":\([a-z]*\).*/\1/p')
  if [ "$ok" = "true" ]; then
    printf '  ok  %s\n' "$method"
  else
    printf '  ПРОВАЛ %s → %s\n' "$method" "$out"
    return 1
  fi
}

json_escape() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

echo "Бот:"
set +x   # на всякий случай: токен не должен попасть в трассировку
me=$(curl -sS "${API}/getMe" 2>/dev/null || true)
if [ -z "$me" ]; then
  echo "  не достучался до api.telegram.org — проверь интернет или прокси"; exit 1
fi
printf '%s\n' "$me" | grep -q '"ok":true' || { echo "  токен не подошёл (проверь BOT_TOKEN в .env)"; exit 1; }
printf '  @%s\n' "$(printf '%s' "$me" | sed -n 's/.*"username":"\([^"]*\)".*/\1/p')"
echo "Приложение: ${APP_URL}"
echo

echo "Настраиваю:"
call setChatMenuButton "{\"menu_button\":{\"type\":\"web_app\",\"text\":\"$(json_escape "$BTN_TEXT")\",\"web_app\":{\"url\":\"$(json_escape "$APP_URL")\"}}}"

call setMyName '{"name":"Кузница Тела"}'

call setMyShortDescription '{"short_description":"Силовой цикл в фэнтези-сеттинге: квесты, рабочие веса под твои замеры, знаки отличия."}'

call setMyDescription '{"description":"Кузница Тела — тренировочный дневник в виде игры.\n\nСплит Верх / Низ / Фулбоди: каждая мышца работает дважды в неделю. Рабочие веса считаются под твои замеры, состав квеста можно менять из арсенала движений. Журнал привязан к твоему аккаунту и хранится в облаке Telegram.\n\nЖми кнопку меню, чтобы открыть."}'

call setMyCommands '{"commands":[{"command":"start","description":"Открыть Кузницу Тела"},{"command":"help","description":"Как всё устроено"}]}'

echo
echo "Готово. Кнопка меню в чате с ботом открывает приложение."
echo "Если нужна прямая ссылка t.me/<бот>/<приложение> — пройди /newapp в @BotFather:"
echo "  название, описание, иконка 640×360, URL ${APP_URL}, короткое имя."
