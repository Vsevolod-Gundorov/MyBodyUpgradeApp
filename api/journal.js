// Маршрут Vercel: /api/journal. Вся логика — в server/controllers/journal.js.
import { handleJournal } from "../server/controllers/journal.js";
import { defaultDeps } from "../server/deps.js";

export async function GET(request) { return handleJournal(request, await defaultDeps()); }
export async function PUT(request) { return handleJournal(request, await defaultDeps()); }
