// Разовая конвертация всех денежных значений базы: ₽ → BYN (деление на 30, округление).
// Запуск: node scripts/convert-to-byn.mjs
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const RATE = 30; // 1 Br ≈ 30 ₽
const toByn = (v) => Math.round(v / RATE);

// товары
const products = await db.product.findMany({ select: { id: true, price: true, cost: true } });
for (const p of products) {
  await db.product.update({
    where: { id: p.id },
    data: { price: toByn(p.price), cost: toByn(p.cost) },
  });
}

// заказы на ремонт: цена для клиента
const orders = await db.repairOrder.findMany({ where: { price: { not: null } }, select: { id: true, price: true } });
for (const o of orders) {
  await db.repairOrder.update({ where: { id: o.id }, data: { price: toByn(o.price) } });
}

// списанные запчасти: себестоимость
const parts = await db.repairOrderPart.findMany({ select: { id: true, cost: true } });
for (const p of parts) {
  await db.repairOrderPart.update({ where: { id: p.id }, data: { cost: toByn(p.cost) } });
}

// продажи: итог и позиции
const sales = await db.sale.findMany({ select: { id: true, total: true } });
for (const s of sales) {
  await db.sale.update({ where: { id: s.id }, data: { total: toByn(s.total) } });
}
const items = await db.saleItem.findMany({ select: { id: true, price: true } });
for (const i of items) {
  await db.saleItem.update({ where: { id: i.id }, data: { price: toByn(i.price) } });
}

console.log(
  `Конвертировано в BYN: товаров ${products.length}, заказов с ценой ${orders.length}, ` +
    `запчастей ${parts.length}, продаж ${sales.length} (${items.length} позиций)`
);
await db.$disconnect();
