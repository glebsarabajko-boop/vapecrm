"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/format";
import { createSaleReminders } from "@/lib/messaging";

export type SaleResult =
  | { ok: true; saleId: number; total: number }
  | { ok: false; error: string };

// Продажа с кассы: списывает остатки в одной транзакции
export async function createSaleAction(
  items: { productId: number; qty: number }[],
  clientPhone: string
): Promise<SaleResult> {
  const user = await requireUser();
  if (!items.length) return { ok: false, error: "Корзина пуста" };

  try {
    const sale = await db.$transaction(async (tx) => {
      let total = 0;
      const rows: { productId: number; qty: number; price: number }[] = [];

      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) throw new Error("Товар не найден");
        if (item.qty <= 0) throw new Error("Некорректное количество");
        if (product.qty < item.qty) {
          throw new Error(`«${product.name}»: на складе только ${product.qty} шт`);
        }
        await tx.product.update({
          where: { id: product.id },
          data: { qty: { decrement: item.qty } },
        });
        total += product.price * item.qty;
        rows.push({ productId: product.id, qty: item.qty, price: product.price });
      }

      // Привязать продажу к клиенту, если телефон известен
      let clientId: number | null = null;
      const phone = normalizePhone(clientPhone ?? "");
      if (phone) {
        const client = await tx.client.findUnique({ where: { phone } });
        clientId = client?.id ?? null;
      }

      const sale = await tx.sale.create({
        data: { clientId, userId: user.id, total, items: { create: rows } },
      });

      // картриджи с моделью подика — ставим напоминание «пора сменить» через 14 дней
      await createSaleReminders(tx, clientId, rows);

      return sale;
    });

    revalidatePath("/inventory");
    return { ok: true, saleId: sale.id, total: sale.total };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка продажи" };
  }
}
