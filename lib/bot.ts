// Логика Telegram-бота. Запускается двумя способами:
//  - автоматически вместе с приложением (instrumentation.ts при старте сервера)
//  - вручную как отдельный процесс (npm run bot) — если приложение уже держит бота,
//    второй запуск конфликтует (Telegram отдаёт апдейты только одному поллеру)
import { Bot } from "grammy";
import { db } from "./db.ts";
import { pumpMessaging } from "./messaging.ts";
import { normalizePhone } from "./format.ts";
import { parseOrderQuery, generateAccessCode } from "./codes.ts";
import { statusLabel } from "./repairs.ts";

const awaitingPhone = new Set<number>();
type BookingStep = "model" | "problem" | "time";
const bookingFlow = new Map<number, { step: BookingStep; model?: string; problem?: string }>();

const clientByChat = (chatId: number) =>
  db.client.findFirst({ where: { telegramChatId: String(chatId) } });

export function startBot(token?: string): boolean {
  if (!token) {
    console.warn("[бот] TELEGRAM_BOT_TOKEN не задан — бот не запущен (приложение работает без него)");
    return false;
  }
  // защита от двойного старта (hot reload в dev)
  const g = globalThis as unknown as { __vapecrmBot?: boolean };
  if (g.__vapecrmBot) return false;
  g.__vapecrmBot = true;

  const bot = new Bot(token);

  bot.command("start", async (ctx) => {
    const client = await clientByChat(ctx.chat.id);
    if (client) {
      return ctx.reply(
        `Привет, ${client.name}! Ты уже подключён.\n\n/status <номер> — статус ремонта\n/book — записаться на ремонт\n/help — все команды`
      );
    }
    awaitingPhone.add(ctx.chat.id);
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
    if (awaitingPhone.has(ctx.chat.id)) {
      return ctx.reply("Сначала пришли номер телефона, потом записывайся :)");
    }
    bookingFlow.set(ctx.chat.id, { step: "model" });
    return ctx.reply("Записываемся! Какая модель устройства? (например Vaporesso XROS 3)");
  });

  bot.command("cancel", async (ctx) => {
    const wasBooking = bookingFlow.delete(ctx.chat.id);
    const wasPhone = awaitingPhone.delete(ctx.chat.id);
    if (wasBooking || wasPhone) return ctx.reply("Отменил. Напиши /help, если что.");
    return ctx.reply("Отменять нечего :)");
  });

  bot.on("message:text", async (ctx) => {
    const chatId = ctx.chat.id;

    // диалог записи на ремонт
    const flow = bookingFlow.get(chatId);
    if (flow) {
      if (flow.step === "model") {
        flow.model = ctx.message.text.trim();
        flow.step = "problem";
        return ctx.reply("Что случилось? (если не знаешь — просто «-»)");
      }
      if (flow.step === "problem") {
        flow.problem = ctx.message.text.trim();
        flow.step = "time";
        return ctx.reply(
          "Когда тебе удобно прийти? (например «завтра в 15:00», или «-» если как получится)"
        );
      }
      const client = await clientByChat(chatId);
      if (!client) {
        bookingFlow.delete(chatId);
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
          deviceModel: flow.model ?? "Не указана",
          problem: flow.problem && flow.problem !== "-" ? flow.problem : "Запись через бота",
          status: "INTAKE",
          accessCode: generateAccessCode(),
          ...(preferredAt ? { preferredAt } : {}),
        },
      });
      bookingFlow.delete(chatId);
      const timeLine = preferredAt
        ? `\nЖелаемое время: ${preferredAt.toLocaleString("ru-RU")} (подтвердим звонком)`
        : "\nМы позвоним и согласуем время.";
      return ctx.reply(
        `Заявка принята! Номер: R-${order.id}-${order.accessCode}${timeLine}\n` +
          "Статус: /status R-" + order.id + "-" + order.accessCode
      );
    }

    // привязка телефона
    if (awaitingPhone.has(chatId)) {
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
      awaitingPhone.delete(chatId);
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

  // очередь исходящих: уведомления, напоминания о картриджах, «давно не забираете»
  setInterval(async () => {
    await pumpMessaging((chatId, text) => bot.api.sendMessage(chatId, text).then(() => {}));
  }, 5000);

  bot.start().catch((e) => console.error("[бот] остановлен:", e));
  console.log("[бот] запущен (long polling)");
  return true;
}
