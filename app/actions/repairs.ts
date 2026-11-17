"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/format";
import { generateAccessCode } from "@/lib/codes";
import { isRepairStatus, repairNotifyText } from "@/lib/repairs";

// На проде прокачиваем очередь уведомлений сразу после запроса —
// клиент получает «ремонт готов» без ожидания cron-а.
// Локально очередь качает polling-бот (раз в 5 секунд), чтобы не дублировать.
// Динамический импорт: bot.ts импортирует statusLabel отсюда — прямой импорт
// создал бы цикл.
function pumpNotificationsAfter() {
  if (!process.env.VERCEL) return;
  after(async () => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;
    try {
      const { pumpViaBot } = await import("@/lib/bot");
      await pumpViaBot(token);
    } catch (e) {
      console.error("[after] pump:", e);
    }
  });
}

function toInt(value: FormDataEntryValue | null, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

// Приёмка: клиент находится по телефону или создаётся на лету
export async function createRepairAction(formData: FormData) {
  await requireUser();
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const name = String(formData.get("name") ?? "").trim();
  const deviceModel = String(formData.get("deviceModel") ?? "").trim();
  const problem = String(formData.get("problem") ?? "").trim();

  if (!phone || !deviceModel) redirect("/repairs/new?error=1");

  const order = await db.$transaction(async (tx) => {
    let client = await tx.client.findUnique({ where: { phone } });
    if (!client) {
      client = await tx.client.create({ data: { phone, name: name || "Без имени" } });
    }
    return tx.repairOrder.create({
      data: { clientId: client.id, deviceModel, problem, status: "INTAKE", accessCode: generateAccessCode() },
    });
  });

  revalidatePath("/repairs");
  redirect(`/repairs/${order.id}`);
}

export async function setStatusAction(formData: FormData) {
  await requireUser();
  const orderId = toInt(formData.get("orderId"));
  const status = String(formData.get("status") ?? "");
  if (!isRepairStatus(status)) return;

  const existing = await db.repairOrder.findUnique({ where: { id: orderId } });
  if (!existing) return;

  const order = await db.repairOrder.update({
    where: { id: orderId },
    data: {
      status,
      // фиксируем момент выдачи один раз — по нему считается зарплата за месяц
      ...(status === "ISSUED" && !existing.issuedAt ? { issuedAt: new Date() } : {}),
      // момент «Готов» — с него отсчитывается напоминание «давно не забираете»
      ...(status === "READY" && !existing.readyAt ? { readyAt: new Date() } : {}),
    },
    include: { client: true },
  });

  // «Готов» и «Выдан» — уведомление в очередь для бота
  if ((status === "READY" || status === "ISSUED") && order.client.telegramChatId) {
    await db.notification.create({
      data: {
        clientId: order.clientId,
        text: repairNotifyText(status, order.deviceModel, order.id),
      },
    });
    pumpNotificationsAfter();
  }

  revalidatePath(`/repairs/${orderId}`);
  revalidatePath("/repairs");
}

export async function setPriceAction(formData: FormData) {
  await requireUser();
  const orderId = toInt(formData.get("orderId"));
  const raw = String(formData.get("price") ?? "").trim();
  const price = raw === "" ? null : Math.max(0, toInt(raw));
  await db.repairOrder.update({ where: { id: orderId }, data: { price } });
  revalidatePath(`/repairs/${orderId}`);
}

export async function setMasterAction(formData: FormData) {
  await requireUser();
  const orderId = toInt(formData.get("orderId"));
  const raw = String(formData.get("masterId") ?? "").trim();
  const masterId = raw === "" ? null : toInt(raw);
  await db.repairOrder.update({ where: { id: orderId }, data: { masterId } });
  revalidatePath(`/repairs/${orderId}`);
}

// Списать запчасть со склада на ремонт
export async function addPartAction(formData: FormData) {
  await requireUser();
  const orderId = toInt(formData.get("orderId"));
  const productId = toInt(formData.get("productId"));
  const qty = toInt(formData.get("qty"));
  if (qty <= 0) return;

  try {
    await db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) throw new Error("Товар не найден");
      if (product.qty < qty) throw new Error(`На складе только ${product.qty} шт`);
      await tx.product.update({
        where: { id: productId },
        data: { qty: { decrement: qty } },
      });
      await tx.repairOrderPart.create({
        data: { orderId, productId, qty, cost: product.cost },
      });
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ошибка списания";
    redirect(`/repairs/${orderId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/repairs/${orderId}`);
  revalidatePath("/inventory");
}

// Вернуть запчасть на склад
export async function removePartAction(formData: FormData) {
  await requireUser();
  const partId = toInt(formData.get("partId"));
  const part = await db.repairOrderPart.delete({ where: { id: partId } });
  await db.product.update({
    where: { id: part.productId },
    data: { qty: { increment: part.qty } },
  });
  revalidatePath(`/repairs/${part.orderId}`);
  revalidatePath("/inventory");
}
