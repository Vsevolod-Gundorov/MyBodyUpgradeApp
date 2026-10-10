// Маршрут Vercel: /api/foods. Вся логика — в server/controllers/foods.js.
import { handleFoods } from "../server/controllers/foods.js";
import { defaultDeps } from "../server/deps.js";

export async function GET(request) { return handleFoods(request, await defaultDeps()); }
export async function POST(request) { return handleFoods(request, await defaultDeps()); }
