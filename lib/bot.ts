// Логика Telegram-бота. Три способа запуска:
//  - webhook на Vercel (app/api/telegram/webhook/route.ts) — прод, работает 24/7;
//    Telegram сам присылает каждое сообщение на наш URL, поллинг не нужен
//  - long polling вместе с приложением локально (instrumentation.ts)
//  - отдельный процесс локально (npm run bot) — если приложение не запущено;
//    два поллера одновременно конфликтуют (Telegram отдаёт апдейты только одному)
//
// Состояние диалогов (привязка телефона, запись на ремонт) хранится в БД (BotDialog),
// а не в памяти: в serverless каждый вызов функции может быть новым процессом.
import { Bot } from "grammy";
import type { Update } from "@grammyjs/types";
import { db } from "./db.ts";
import { pumpMessaging } from "./messaging.ts";
import { normalizePhone } from "./format.ts";
import { parseOrderQuery, generateAccessCode } from "./codes.ts";
import { statusLabel } from "./repairs.ts";

type DialogState = "phone" | "model" | "problem" | "time";
type DialogPayload = { model?: string; problem?: string };

const getDialog = async (chatId: number): Promise<{ state: DialogState; payload: DialogPayload } | null> => {
  const row = await db.botDialog.findUnique({ where: { chatId: String(chatId) } });
  if (!row) return null;
  let payload: DialogPayload = {};
  try {
    payload = JSON.parse(row.payload);
  } catch {}
  return { state: row.state as DialogState, payload };
};

const setDialog = (chatId: number, state: DialogState, payload: DialogPayload = {}) =>
  db.botDialog.upsert({
    where: { chatId: String(chatId) },
    update: { state, payload: JSON.stringify(payload) },
    create: { chatId: String(chatId), state, payload: JSON.stringify(payload) },
  });

const clearDialog = (chatId: number) => db.botDialog.deleteMany({ where: { chatId: String(chatId) } });

const clientByChat = (chatId: number) =>
  db.client.findFirst({ where: { telegramChatId: String(chatId) } });

// Регистрируем обработчики и возвращаем бота — общий для polling и webhook,
// чтобы поведение в облаке и локально было одинаковым
export function buildBot(token: string): Bot {
  const bot = new Bot(token);

  bot.command("start", async (ctx) => {
    const client = await clientByChat(ctx.chat.id);
    if (client) {
      return ctx.reply(
        `Привет, ${client.name}! Ты уже подключён.\n\n/status <номер> — статус ремонта\n/book — записаться на ремонт\n/help — все команды`
      );
    }
    await setDialog(ctx.chat.id, "phone");
    return ctx.reply(
      "Привет! Пришли свой номер телефона — например +375 25/29/33/44 123-45-67 (Беларусь) " +
        "или +7 916 123-45-67, и я буду сообщать, когда твой ремонт будет готов."
    );
  });

  bot.command("help", async (ctx) => {
    return ctx.reply(
      [
        "Команды:",
        "/status <номер> — статус ремонта (номер с квитанции, например R-30-KX4P)",
        "/book — записаться на ремонт",
        "/cancel — отменить текущий диалог",
        "",
        "Я также сообщаю автоматически: когда ремонт готов, когда его забрали,",
        "и напоминаю через 14 дней после покупки, что пора сменить картридж.",
      ].join("\n")
    );
  });

  bot.command("status", async (ctx) => {
    const arg = (ctx.message?.text ?? "").slice("/status".length);
    if (!arg.trim()) {
      return ctx.reply("Пришли номер с квитанции: /status R-30-KX4P");
    }
    const parsed = parseOrderQuery(arg);
    const order = parsed
      ? await db.repairOrder.findUnique({ where: { id: parsed.id } })
      : null;
    if (!parsed || !order || !order.accessCode || order.accessCode !== parsed.code) {
      return ctx.reply("Заказ не найден. Проверь номер — он написан на квитанции.");
    }
    const priceLine = order.price != null ? `\nСтоимость: ${order.price} Br` : "";
    return ctx.reply(
      `${order.deviceModel}\nСтатус: ${statusLabel(order.status)}${priceLine}\nОбновлено: ${order.updatedAt.toLocaleString("ru-RU")}`
    );
  });

  bot.command("book", async (ctx) => {
    const client = await clientByChat(ctx.chat.id);
    if (!client) {
      return ctx.reply("Сначала подключись: /start и номер телефона.");
    }
    const dialog = await getDialog(ctx.chat.id);
    if (dialog?.state === "phone") {
      return ctx.reply("Сначала пришли номер телефона, потом записывайся :)");
    }
    await setDialog(ctx.chat.id, "model");
    return ctx.reply("Записываемся! Какая модель устройства? (например Vaporesso XROS 3)");
  });

  bot.command("cancel", async (ctx) => {
    const dialog = await getDialog(ctx.chat.id);
    await clearDialog(ctx.chat.id);
    if (dialog) return ctx.reply("Отменил. Напиши /help, если что.");
    return ctx.reply("Отменять нечего :)");
  });

  bot.on("message:text", async (ctx) => {
    const chatId = ctx.chat.id;
    const dialog = await getDialog(chatId);

    // диалог записи на ремонт
    if (dialog?.state === "model" || dialog?.state === "problem" || dialog?.state === "time") {
      const payload = dialog.payload;
      if (dialog.state === "model") {
        payload.model = ctx.message.text.trim();
        await setDialog(chatId, "problem", payload);
        return ctx.reply("Что случилось? (если не знаешь — просто «-»)");
      }
      if (dialog.state === "problem") {
        payload.problem = ctx.message.text.trim();
        await setDialog(chatId, "time", payload);
        return ctx.reply(
          "Когда тебе удобно прийти? (например «завтра в 15:00», или «-» если как получится)"
        );
      }
      const client = await clientByChat(chatId);
      if (!client) {
        await clearDialog(chatId);
        return ctx.reply("Не нашёл тебя в базе — начни с /start и номера телефона.");
      }
      let preferredAt: Date | null = null;
      const timeText = ctx.message.text.trim();
      if (timeText !== "-") {
        const parsed = new Date(timeText);
        if (!Number.isNaN(parsed.getTime()) && parsed.getTime() > Date.now()) {
          preferredAt = parsed;
        }
      }
      const order = await db.repairOrder.create({
        data: {
          clientId: client.id,
          deviceModel: payload.model ?? "Не указана",
          problem: payload.problem && payload.problem !== "-" ? payload.problem : "Запись через бота",
          status: "INTAKE",
          accessCode: generateAccessCode(),
          ...(preferredAt ? { preferredAt } : {}),
        },
      });
      await clearDialog(chatId);
      const timeLine = preferredAt
        ? `\nЖелаемое время: ${preferredAt.toLocaleString("ru-RU")} (подтвердим звонком)`
        : "\nМы позвоним и согласуем время.";
      return ctx.reply(
        `Заявка принята! Номер: R-${order.id}-${order.accessCode}${timeLine}\n` +
          "Статус: /status R-" + order.id + "-" + order.accessCode
      );
    }

    // привязка телефона
    if (dialog?.state === "phone") {
      const phone = normalizePhone(ctx.message.text);
      const client = await db.client.findUnique({ where: { phone } });
      if (!client) {
        return ctx.reply(
          "Не нашёл такой номер в базе мастерской. Проверь телефон — или попроси мастерскую записать его при приёмке."
        );
      }
      await db.client.update({
        where: { id: client.id },
        data: { telegramChatId: String(chatId) },
      });
      await clearDialog(chatId);
      return ctx.reply(
        `Готово, ${client.name}! Буду писать, когда ремонт будет готов.\nЗаписаться на новый ремонт: /book`
      );
    }

    return ctx.reply("Напиши /help — покажу, что я умею.");
  });

  bot.api
    .setMyCommands([
      { command: "start", description: "Подключить уведомления" },
      { command: "status", description: "Статус ремонта (номер с квитанции)" },
      { command: "book", description: "Записаться на ремонт" },
      { command: "help", description: "Что я умею" },
      { command: "cancel", description: "Отменить диалог" },
    ])
    .catch((e) => console.error("[бот] setMyCommands:", e));

  return bot;
}

const sender = (bot: Bot) => (chatId: string, text: string) => bot.api.sendMessage(chatId, text).then(() => {});

// --- Локальный режим: long polling + периодическая прокачка очереди ---
export function startBot(token?: string): boolean {
  if (!token) {
    console.warn("[бот] TELEGRAM_BOT_TOKEN не задан — бот не запущен (приложение работает без него)");
    return false;
  }
  // защита от двойного старта (hot reload в dev)
  const g = globalThis as unknown as { __vapecrmBot?: boolean };
  if (g.__vapecrmBot) return false;
  g.__vapecrmBot = true;

  const bot = buildBot(token);
  setInterval(async () => {
    await pumpMessaging(sender(bot));
  }, 5000);
  bot.start().catch((e) => console.error("[бот] остановлен:", e));
  console.log("[бот] запущен (long polling)");
  return true;
}

// --- Прод (Vercel): webhook. Telegram шлёт апдейты POST-ом, мы обрабатываем ---
const gBot = globalThis as unknown as { __vapecrmWebhookBot?: Bot };

export async function getWebhookBot(token: string): Promise<Bot> {
  // один Bot на тёплый инстанс функции; init() один раз запрашивает getMe
  if (!gBot.__vapecrmWebhookBot) {
    const bot = buildBot(token);
    await bot.init();
    gBot.__vapecrmWebhookBot = bot;
  }
  return gBot.__vapecrmWebhookBot;
}

// Прокачать очередь уведомлений (используют webhook-роут, cron и after() в actions)
export async function pumpViaBot(token: string): Promise<number> {
  const bot = await getWebhookBot(token);
  return pumpMessaging(sender(bot));
}

// Обработка одного апдейта из webhook (использует app/api/telegram/webhook/route.ts)
export async function handleWebhookUpdate(token: string, update: Update): Promise<void> {
  const bot = await getWebhookBot(token);
  await bot.handleUpdate(update);
}
