// Подписать initData так же, как это делает Telegram, — для тестов сервера.
// Токен в тестах выдуманный и генерируется на каждый запуск.
import { createHmac, randomBytes } from "node:crypto";

export const fakeBotToken = () => `${100000 + Math.floor(Math.random() * 900000)}:${randomBytes(26).toString("base64url")}`;

export function signInitData({ botToken, user, authDate = Math.floor(Date.now() / 1000), extra = {} }) {
  const fields = { auth_date: String(authDate), query_id: "AAE-test", ...extra };
  if (user !== undefined) fields.user = JSON.stringify(user);
  const check = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = createHmac("sha256", secret).update(check).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}
