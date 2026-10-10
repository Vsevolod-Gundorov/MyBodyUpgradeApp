// Точка входа: собирает модель, вид и контроллеры и запускает приложение.
//
// Устройство (MVC):
//   model/       — журнал, расчёты, синхронизация. Не знает о DOM и экранах.
//   view/        — разметка, иконки, звук. Получает данные, ничего не решает.
//   controller/  — экраны: берут данные из модели, отдают виду, обрабатывают действия.
// Модель сообщает о событиях подписками (сохранение, новые достижения, облако),
// а связывает их с интерфейсом только этот файл.
import { inTelegram, initTelegram, tgUserName } from "./telegram.js";
import { applyTheme, backHandler, initRouter, render } from "./controller/router.js";
import { initKeyboard } from "./controller/keyboard.js";
import { showAchievementToast } from "./controller/overlays.js";
import { checkAchievements, onAchievements } from "./model/achievements.js";
import { S, save, onSaved } from "./model/store.js";
import { configureCloudSync, initCloudSync, queueCloudSync } from "./model/sync.js";

/* ---- связи модели с интерфейсом ---- */
onSaved(() => queueCloudSync());
onAchievements((list) => showAchievementToast(list));
configureCloudSync({ onPulled: () => render(), askConflict: (msg) => confirm(msg) });

/* ================= старт ================= */
initKeyboard();
initRouter();
applyTheme();
// Telegram Mini App: системная кнопка «Назад», хаптика, безопасные зоны, облако
initTelegram({ onBack: () => { if (backHandler) backHandler(); } });
// первый запуск этого аккаунта — берём имя героя из профиля Телеграма
if (inTelegram && !(S.sessions || []).length && !S.rev) {
  const n = tgUserName();
  if (n && n !== S.hero.name) { S.hero.name = n; save(); }
}
// подтягиваем журнал этого пользователя из его облака
initCloudSync();

// тихая сверка знаков отличия: подхватывает уже заслуженное (в т.ч. после миграции и обновлений правил)
checkAchievements({ type: "silent" }, { silent: true }); save();
render();
