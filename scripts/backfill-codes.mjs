// Разовый backfill: присвоить accessCode заказам, созданным до появления кодов.
// Запуск: node scripts/backfill-codes.mjs
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // без похожих 0/O, 1/I
const gen = () =>
  Array.from({ length: 5 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");

const orders = await db.repairOrder.findMany({ where: { accessCode: null } });
for (const o of orders) {
  await db.repairOrder.update({ where: { id: o.id }, data: { accessCode: gen() } });
}
console.log(`Коды присвоены ${orders.length} заказам`);
await db.$disconnect();
