// Контроллер: включить и выключить напоминания в Telegram.
// Включение — это разрешение писать (Telegram спрашивает сам), настройки на сервер
// и проверочное сообщение: человек сразу видит, что бот до него достучался.
import { reminders, setReminder, setSlotTime, syncReminders } from "../model/reminders.js";
import { remindersPost, serverPossible } from "../model/server.js";
import { save } from "../model/store.js";
import { requestWriteAccess } from "../telegram.js";
import { showSnack } from "./snack.js";

export const remindersAvailable = () => serverPossible();

/** kind: "supp" — добавки по расписанию, "rest" — конец отдыха. */
export async function toggleReminder(kind, onDone = () => {}) {
  const on = !reminders()[kind];
  if (!on) { setReminder(kind, false); save(); syncReminders(); onDone(); return; }
  if (!remindersAvailable()) { showSnack("Напоминания работают в приложении, открытом из Telegram"); return; }
  if (!(await requestWriteAccess())) { showSnack("Без разрешения бот не сможет писать"); return; }
  setReminder(kind, true);
  const r = await syncReminders({ now: true });
  if (!r || r.status !== 200) {
    setReminder(kind, false);
    showSnack(r && r.status === 0 ? "Нет связи с сервером — попробуйте позже" : "Сервер не принял настройки");
    onDone(); return;
  }
  save(); onDone();
  const t = await remindersPost({ action: "test" });
  if (t.status === 200) showSnack("Готово: бот прислал проверочное сообщение");
  else if (t.json && t.json.error === "bot_blocked") showSnack("Откройте чат с ботом и нажмите «Старт» — иначе он не сможет писать");
  else if (kind === "supp" && r.json && r.json.cron === false) showSnack("Включено. Рассылку по расписанию владелец ещё не настроил");
}

export function changeSlotTime(slot, hhmm) {
  if (setSlotTime(slot, hhmm)) { save(); syncReminders(); }
}
