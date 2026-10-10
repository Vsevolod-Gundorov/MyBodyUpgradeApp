// Маршрут Vercel: /api/reminders. Вся логика — в server/controllers/reminders.js.
import { handleReminders } from "../server/controllers/reminders.js";
import { defaultDeps } from "../server/deps.js";

export async function GET(request) { return handleReminders(request, await defaultDeps()); }
export async function PUT(request) { return handleReminders(request, await defaultDeps()); }
export async function POST(request) { return handleReminders(request, await defaultDeps()); }
