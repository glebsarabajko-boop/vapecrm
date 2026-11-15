// Очередь сообщений для бота: уведомления о ремонтах + напоминания о картриджах.
// Общая для приложения (запись) и бота (отправка) — тестируется без Telegram.
import type { Prisma } from "@prisma/client";
import { db } from "./db.ts";

type Tx = Prisma.TransactionClient;

const REMINDER_DAYS = 14; // через столько дней после покупки пора менять картридж
const PICKUP_DAYS = 3; // через столько дней в статусе «Готов» напоминаем забрать

// После продажи картриджей (GOODS с указанной моделью подика) ставим напоминание
export async function createSaleReminders(
  tx: Tx,
  clientId: number | null,
  items: { productId: number; qty: number }[]
) {
  if (!clientId) return;
  for (const item of items) {
    const product = await tx.product.findUnique({ where: { id: item.productId } });
    if (!product || product.category !== "GOODS" || !product.podModel) continue;
    await tx.saleReminder.create({
      data: {
        clientId,
        productId: product.id,
        dueAt: new Date(Date.now() + REMINDER_DAYS * 24 * 60 * 60 * 1000),
      },
    });
  }
}

// Бот раз в несколько секунд забирает всё неотправленное и рассылает.
// send передаётся снаружи, чтобы тестировать без реального Telegram.
export async function pumpMessaging(send: (chatId: string, text: string) => Promise<void>) {
  let sent = 0;

  const notifications = await db.notification.findMany({
    where: { sentAt: null },
    include: { client: true },
    take: 20,
  });
  for (const n of notifications) {
    const chatId = n.client.telegramChatId;
    if (!chatId) {
      // клиент отключился от бота — помечаем, чтобы очередь не зависла
      await db.notification.update({ where: { id: n.id }, data: { sentAt: new Date() } });
      continue;
    }
    try {
      await send(chatId, n.text);
      await db.notification.update({ where: { id: n.id }, data: { sentAt: new Date() } });
      sent++;
    } catch (e) {
      console.error("Не удалось отправить уведомление:", e);
    }
  }

  const due = await db.saleReminder.findMany({
    where: { sentAt: null, dueAt: { lte: new Date() } },
    include: { client: true, product: true },
    take: 20,
  });
  for (const r of due) {
    const chatId = r.client.telegramChatId;
    if (!chatId) {
      await db.saleReminder.update({ where: { id: r.id }, data: { sentAt: new Date() } });
      continue;
    }
    try {
      const label = r.product.podModel ?? r.product.name;
      await send(
        chatId,
        `Пора сменить картридж ${label}! Забронировать — просто напиши нам, отложим заранее.`
      );
      await db.saleReminder.update({ where: { id: r.id }, data: { sentAt: new Date() } });
      sent++;
    } catch (e) {
      console.error("Не удалось отправить напоминание:", e);
    }
  }

  // «Давно не забираете»: ремонт висит в «Готов» дольше PICKUP_DAYS
  const staleReady = await db.repairOrder.findMany({
    where: {
      status: "READY",
      readyAt: { lte: new Date(Date.now() - PICKUP_DAYS * 24 * 60 * 60 * 1000) },
      pickupRemindedAt: null,
    },
    include: { client: true },
    take: 20,
  });
  for (const order of staleReady) {
    const chatId = order.client.telegramChatId;
    if (!chatId) continue; // не спамим: напоминание можно повторить после следующей привязки
    const days = Math.floor((Date.now() - order.readyAt!.getTime()) / 86400000);
    try {
      await send(
        chatId,
        `Напоминаем: ваш ${order.deviceModel} (заказ R-${order.id}) готов уже ${days} дн. — заберите, пожалуйста. Нужно перенести время — просто напишите нам.`
      );
      await db.repairOrder.update({
        where: { id: order.id },
        data: { pickupRemindedAt: new Date() },
      });
      sent++;
    } catch (e) {
      console.error("Не удалось отправить напоминание о выдаче:", e);
    }
  }

  return sent;
}
