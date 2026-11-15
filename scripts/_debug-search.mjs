// Временный дебаг поиска
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const dm = await db.$queryRaw`SELECT id, deviceModel FROM RepairOrder WHERE deviceModel LIKE '%xros 5 mini%'`;
console.log("deviceModel LIKE '%xros 5 mini%':", dm.map((o) => "R-" + o.id + " [" + o.deviceModel + "]").join(", ") || "(ничего)");

const ph = await db.$queryRaw`SELECT id, phone FROM Client WHERE phone LIKE '%545%'`;
console.log("phone LIKE '%545%':", ph.map((o) => "C-" + o.id + " " + o.phone).join(", ") || "(ничего)");

const nm = await db.$queryRaw`SELECT id, name FROM Client WHERE name LIKE '%xros%'`;
console.log("name LIKE '%xros%':", nm.map((o) => "C-" + o.id + " " + o.name).join(", ") || "(ничего)");

const prismaWhere = await db.repairOrder.findMany({
  where: { deviceModel: { contains: "xros 5 mini" } },
  select: { id: true, deviceModel: true },
});
console.log("prisma contains 'xros 5 mini':", prismaWhere.map((o) => "R-" + o.id).join(", ") || "(ничего)");

const prismaLower = await db.repairOrder.findMany({
  where: { deviceModel: { contains: "XROS 5 MINI" } },
  select: { id: true, deviceModel: true },
});
console.log("prisma contains 'XROS 5 MINI':", prismaLower.map((o) => "R-" + o.id).join(", ") || "(ничего)");

await db.$disconnect();
