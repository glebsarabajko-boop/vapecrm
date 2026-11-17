// Разовый перенос данных из локального SQLite (db/data.db) в облачный Postgres (Neon).
// Запуск: node scripts/migrate-sqlite-to-neon.mjs   (DATABASE_URL/DIRECT_URL уже в .env)
//
// ID сохраняются как есть — от них зависят коды квитанций (R-30-KX4P), ссылки
// «/repairs/25» и привязки telegramChatId. Повторный запуск безопасен (upsert по id).
import { DatabaseSync } from "node:sqlite";
import { PrismaClient } from "@prisma/client";

const SQLITE_PATH = new URL("../db/data.db", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

// порядок важен: сначала таблицы, на которые ссылаются остальные
const TABLES = [
  { table: "User", model: "user" },
  { table: "Client", model: "client" },
  { table: "Product", model: "product" },
  { table: "Compatibility", model: "compatibility" },
  { table: "RepairOrder", model: "repairOrder" },
  { table: "RepairOrderPart", model: "repairOrderPart" },
  { table: "Sale", model: "sale" },
  { table: "SaleItem", model: "saleItem" },
  { table: "SaleReminder", model: "saleReminder" },
  { table: "Notification", model: "notification" },
  // Session и ClientSession не переносим: старые cookie-сессии не нужны,
  // все перелогинятся с чистыми датами истечения
];

// SQLite хранит иначе, чем ждёт Prisma: Boolean → 0/1, DateTime → строка ISO или число epoch ms.
const BOOLEAN_FIELDS = new Set(["isActive"]); // Boolean-поля из schema.prisma

const toPrismaRow = (row) =>
  Object.fromEntries(
    Object.entries(row).map(([k, v]) => {
      if (BOOLEAN_FIELDS.has(k)) return [k, v === null ? null : v !== 0];
      if (/At$/.test(k) && (typeof v === "string" || typeof v === "number")) {
        if (typeof v === "number") {
          // epoch ms (~1.8e12 сейчас) или секунды (~1.8e9)
          return [k, new Date(v > 1e12 ? v : v * 1000)];
        }
        if (!Number.isNaN(Date.parse(v))) return [k, new Date(v)];
      }
      return [k, v];
    }),
  );

const sqlite = new DatabaseSync(SQLITE_PATH, { readOnly: true });
const db = new PrismaClient();

try {
  for (const { table, model } of TABLES) {
    const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all();
    for (const raw of rows) {
      const row = toPrismaRow(raw);
      await db[model].upsert({ where: { id: row.id }, update: row, create: row });
    }
    console.log(`${table}: перенесено ${rows.length}`);
  }

  // Prisma вставляет id явно, а Postgres-счётчик SERIAL об этом не знает —
  // поднимаем каждый счётчик до MAX(id), иначе следующая запись упадёт на дубле ключа
  for (const { table } of TABLES) {
    await db.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), ` +
        `COALESCE((SELECT MAX("id") FROM "${table}"), 1), ` +
        `(SELECT COUNT(*) FROM "${table}") > 0)`,
    );
  }
  console.log("Счётчики autoincrement выставлены по MAX(id)");
  console.log("Перенос завершён ✅");
} finally {
  sqlite.close();
  await db.$disconnect();
}
