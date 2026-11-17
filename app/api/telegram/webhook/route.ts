// Telegram-бот в облаке: Telegram сам шлёт каждое сообщение POST-ом на этот URL.
// Ссылку на этот роут регистрирует scripts/set-webhook.mjs (см. DEPLOY.md).
// Секрет в заголовке — защита от подделки апдейтов (Telegram добавляет его сам,
// если при setWebhook был передан secret_token).
import { NextRequest } from "next/server";
import type { Update } from "@grammyjs/types";
import { handleWebhookUpdate, pumpViaBot } from "@/lib/bot";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!token) {
    console.error("[webhook] нет TELEGRAM_BOT_TOKEN");
    return new Response("bot not configured", { status: 503 });
  }
  if (!secret || req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return new Response("forbidden", { status: 403 });
  }

  let update: Update;
  try {
    update = (await req.json()) as Update;
  } catch {
    return new Response("bad json", { status: 400 });
  }

  try {
    await handleWebhookUpdate(token, update);
  } catch (e) {
    // логируем, но отвечаем 200: иначе Telegram будет бесконечно ретраить
    // апдейты, споткнувшиеся об ошибку логики
    console.error("[webhook] ошибка обработки апдейта:", e);
  }

  // заодно прокачиваем очередь: так уведомления из CRM уходят быстро,
  // не дожидаясь ежедневного cron-а
  try {
    await pumpViaBot(token);
  } catch (e) {
    console.error("[webhook] ошибка pump:", e);
  }

  return new Response("OK");
}
