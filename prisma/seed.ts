import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

// Демо-каталог: картриджи (товары на продажу) и запчасти для ремонта.
// Цены в белорусских рублях (BYN) — примерно как в минских вейп-шопах.
const PRODUCTS = [
  { name: "Картридж Vaporesso XROS 2мл", barcode: "4600000000017", category: "GOODS", podModel: "XROS", price: 12, cost: 6, qty: 24, minQty: 5 },
  { name: "Картридж Vaporesso XROS Pro 3мл", barcode: "4600000000024", category: "GOODS", podModel: "XROS Pro", price: 15, cost: 7, qty: 8, minQty: 5 },
  { name: "Картридж Uwell Caliburn G2", barcode: "4600000000031", category: "GOODS", podModel: "Caliburn", price: 14, cost: 7, qty: 3, minQty: 5 },
  { name: "Картридж Oxva Xlim 2мл", barcode: "4600000000048", category: "GOODS", podModel: "Xlim", price: 13, cost: 6, qty: 11, minQty: 5 },
  { name: "Картридж VOOPOO VINCI 2мл", barcode: "4600000000055", category: "GOODS", podModel: "Vinci", price: 13, cost: 6, qty: 15, minQty: 5 },
  { name: "Жидкость «Арбуз-лёд» 30мл 3мг", barcode: "4600000000062", category: "GOODS", podModel: null, price: 20, cost: 11, qty: 10, minQty: 5 },
  { name: "Жидкость «Манго» 30мл 3мг", barcode: "4600000000079", category: "GOODS", podModel: null, price: 20, cost: 11, qty: 7, minQty: 5 },
  { name: "Аккумулятор 18650 Samsung 25R", barcode: "4600000000086", category: "PART", podModel: null, price: 30, cost: 20, qty: 6, minQty: 3 },
  { name: "Плата Vaporesso XROS", barcode: "4600000000093", category: "PART", podModel: "XROS", price: 40, cost: 23, qty: 2, minQty: 3 },
  { name: "Микрофон универсальный", barcode: "4600000000109", category: "PART", podModel: null, price: 5, cost: 2, qty: 20, minQty: 10 },
  { name: "Разъём USB-C (порт зарядки)", barcode: "4600000000116", category: "PART", podModel: null, price: 3, cost: 1, qty: 30, minQty: 10 },
  { name: "Стекло Vaporesso XROS", barcode: "4600000000123", category: "PART", podModel: "XROS", price: 8, cost: 4, qty: 4, minQty: 3 },
];

async function main() {
  const [adminHash, masterHash] = await Promise.all([
    bcrypt.hash("admin123", 10),
    bcrypt.hash("master123", 10),
  ]);

  await db.user.upsert({
    where: { login: "admin" },
    update: {},
    create: { login: "admin", name: "Владелец", role: "ADMIN", passwordHash: adminHash },
  });
  await db.user.upsert({
    where: { login: "master" },
    update: {},
    create: { login: "master", name: "Артём (мастер)", role: "MASTER", passwordHash: masterHash },
  });

  for (const p of PRODUCTS) {
    await db.product.upsert({
      where: { barcode: p.barcode },
      // существующие товары не трогаем — только добавляем недостающие
      update: {},
      create: p,
    });
  }

  const clients = [
    { name: "Иван Петров", phone: "9161234567" },
    { name: "Анна Смирнова", phone: "9035551234" },
  ];
  for (const c of clients) {
    await db.client.upsert({ where: { phone: c.phone }, update: {}, create: c });
  }

  // Справочник совместимости: каноническая модель + алиасы линейки
  const COMPAT = [
    { model: "XROS", aliases: "XROS Mini, XROS 2, XROS 3, XROS 3 Mini" },
    { model: "Caliburn", aliases: "Caliburn G2, Caliburn G3" },
    { model: "Xlim", aliases: "Xlim SE, Xlim Pro" },
    { model: "Vinci", aliases: "Vinci X, VOOPOO VINCI" },
  ];
  for (const c of COMPAT) {
    await db.compatibility.upsert({ where: { model: c.model }, update: {}, create: c });
  }

  console.log("Сид выполнен: пользователи, товары, клиенты, совместимость");
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
