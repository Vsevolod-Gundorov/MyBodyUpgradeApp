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
import { openProfileWizard } from "./controller/onboarding.js";
import { hasProfile } from "./model/profile.js";
import { checkAchievements, onAchievements } from "./model/achievements.js";
import { S, save, onSaved } from "./model/store.js";
import { configureServerSync, initSync, queueServerSync } from "./model/server.js";
import { configureCloudSync, queueCloudSync } from "./model/sync.js";

/* ---- связи модели с интерфейсом ---- */
onSaved(() => { queueServerSync(); queueCloudSync(); });
onAchievements((list) => showAchievementToast(list));
configureCloudSync({ onPulled: () => render(), askConflict: (msg) => confirm(msg) });
configureServerSync({ onPulled: () => render(), askConflict: (msg) => confirm(msg) });

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
render();
// Сверяем журнал с сервером приложения (первый раз — переносим его туда);
// без сервера — как раньше, с облаком Telegram. Тихая сверка знаков отличия
// идёт уже после: служебная запись до ответа сервера выглядела бы как правка
// на этом устройстве, и при изменениях с другого устройства человека зря
// спрашивали бы, какую версию оставить. Сохраняем, только если что-то изменилось.
initSync().finally(() => {
  const before = JSON.stringify(S);
  checkAchievements({ type: "silent" }, { silent: true });
  if (JSON.stringify(S) !== before) { save(); render(); }
  // Профиль спрашиваем после сверки: на новом телефоне он приедет с сервера вместе с журналом
  if (!hasProfile()) openProfileWizard();
});
