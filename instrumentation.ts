// Next.js запускает register() один раз при старте сервера —
// локально поднимаем Telegram-бота ВМЕСТЕ с приложением (long polling).
// На Vercel бот работает через webhook (app/api/telegram/webhook) —
// поллинг в serverless не работает и конфликтовал бы с webhook.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.VERCEL) return;
  // секрет webhook задан → бот «живёт» на проде; локальный поллинг выключаем,
  // чтобы два поллера не отбирали апдейты друг у друга
  if (process.env.TELEGRAM_WEBHOOK_SECRET) return;
  const { startBot } = await import("./lib/bot.ts");
  startBot(process.env.TELEGRAM_BOT_TOKEN);
}
