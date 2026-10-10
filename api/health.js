// Маршрут Vercel: /api/health. Вся логика — в server/controllers/health.js.
import { handleHealth } from "../server/controllers/health.js";
import { defaultDeps } from "../server/deps.js";

export async function GET(request) { return handleHealth(request, await defaultDeps()); }
