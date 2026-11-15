// Next.js запускает register() один раз при старте сервера —
// здесь поднимаем Telegram-бота ВМЕСТЕ с приложением, чтобы запись через бота
// и уведомления работали без второго терминала (и на проде — при наличии токена)
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startBot } = await import("./lib/bot.ts");
  startBot(process.env.TELEGRAM_BOT_TOKEN);
}
