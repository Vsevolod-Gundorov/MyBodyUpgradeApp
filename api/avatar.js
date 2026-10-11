// Маршрут Vercel: /api/avatar. Вся логика — в server/controllers/avatar.js.
import { handleAvatar } from "../server/controllers/avatar.js";
import { defaultDeps } from "../server/deps.js";

export async function GET(request) { return handleAvatar(request, await defaultDeps()); }
