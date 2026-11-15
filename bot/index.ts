// Запуск бота как отдельного процесса (npm run bot).
// Если приложение уже запущено (npm run dev / прод) — бот поднимается вместе с ним
// автоматически, и отдельный процесс запускать НЕ нужно: два поллера конфликтуют.
import { startBot } from "../lib/bot.ts";

const started = startBot(process.env.TELEGRAM_BOT_TOKEN);
if (!started) process.exit(1);
