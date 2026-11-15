// Возвращает остатки склада к демо-значениям из сида (цены/себестоимость не трогает).
// Запуск: node scripts/reset-stock.mjs
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const PRODUCTS = [
  { barcode: "4600000000017", qty: 24 },
  { barcode: "4600000000024", qty: 8 },
  { barcode: "4600000000031", qty: 3 },
  { barcode: "4600000000048", qty: 11 },
  { barcode: "4600000000055", qty: 15 },
  { barcode: "4600000000062", qty: 10 },
  { barcode: "4600000000079", qty: 7 },
  { barcode: "4600000000086", qty: 6 },
  { barcode: "4600000000093", qty: 2 },
  { barcode: "4600000000109", qty: 20 },
  { barcode: "4600000000116", qty: 30 },
  { barcode: "4600000000123", qty: 4 },
];

for (const p of PRODUCTS) {
  await db.product.update({ where: { barcode: p.barcode }, data: { qty: p.qty } });
}
console.log(`Остатки восстановлены для ${PRODUCTS.length} товаров`);
await db.$disconnect();
