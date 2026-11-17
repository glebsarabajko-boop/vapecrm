// Регистрирует webhook в Telegram: все сообщения бота Telegram начнёт слать
// на https://<домен>/api/telegram/webhook. Запускается ОДИН раз после первого
// деплоя (и повторно при смене домена):
//
//   node scripts/set-webhook.mjs https://vapecrm.vercel.app
//
// Токен и секрет берутся из .env (TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET).
import { readFileSync } from "node:fs";

const readEnv = (key) =>
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .match(new RegExp(`^${key}="([^"]+)"`, "m"))?.[1];

const token = readEnv("TELEGRAM_BOT_TOKEN");
const secret = readEnv("TELEGRAM_WEBHOOK_SECRET");
const domain = process.argv[2];

if (!token || !secret || !domain || !domain.startsWith("http")) {
  console.error("Использование: node scripts/set-webhook.mjs https://<домен-с-деплоем>");
  console.error("В .env должны быть TELEGRAM_BOT_TOKEN и TELEGRAM_WEBHOOK_SECRET");
  process.exit(1);
}

const url = `${domain.replace(/\/$/, "")}/api/telegram/webhook`;

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url, secret_token: secret, allowed_updates: ["message"] }),
});
const data = await res.json();
console.log(JSON.stringify(data, null, 2));
if (!data.ok) process.exit(1);

// проверяем, что Telegram всё понял
const info = await (await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)).json();
console.log("getWebhookInfo:", JSON.stringify(info.result, null, 2));
