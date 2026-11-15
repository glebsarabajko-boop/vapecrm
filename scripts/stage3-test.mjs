// Тест этапа 3: совместимость в поиске кассы, напоминания «пора сменить», QR-этикетка.
// Запуск: node scripts/stage3-test.mjs (dev-сервер должен работать)
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const BASE = "http://localhost:3000";
const SHOTS = "C:/Users/gleb/.zcode/workspace/1794608265663-20fe0683-abf0-414f-bd06-1eaab098e561/gui-test-screenshots";
const db = new PrismaClient();

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
}
async function shot(page, name) {
  await page.screenshot({ path: join(SHOTS, name) });
}

await mkdir(SHOTS, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(20000);
const settle = async (ms = 1200) => {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(ms);
};

// ---- подготовка: привязываем Ивана к фейковому чату Telegram ----
const ivan = await db.client.findUnique({ where: { phone: "9161234567" } });
await db.client.update({
  where: { id: ivan.id },
  data: { telegramChatId: "test-chat-ivan" },
});

// ---- вход админом ----
await page.goto(BASE + "/");
await page.fill('input[name="login"]', "admin");
await page.fill('input[name="password"]', "admin123");
await page.click('button:has-text("Войти")');
await page.waitForURL("**/repairs");

// ---- совместимость: страница + поиск по алиасу в кассе ----
await page.goto(BASE + "/compatibility");
await settle();
check("Справочник: группа XROS видна", await page.isVisible("text=XROS Mini"));
// XROS-группу ищем строго по заголовку, чтобы не зацепить чужие алиасы
const xrosCard = page
  .locator("div.rounded-2xl")
  .filter({ has: page.getByRole("heading", { name: "XROS", exact: true }) });
check("Справочник: картриджи XROS в группе", (await xrosCard.locator("text=Картридж Vaporesso XROS 2мл").count()) === 1);
await shot(page, "t18_compatibility.png");

// редактирование алиасов именно XROS-группы
await xrosCard.locator('input[aria-label="Алиасы"]').fill("XROS Mini, XROS 2, XROS 3, XROS 3 Mini, XROS 4");
await xrosCard.locator('button:has-text("Сохранить")').click();
await settle(1500);
check("Справочник: новый алиас сохранён", await page.isVisible("text=XROS 4"));

// поиск по алиасу в кассе
await page.goto(BASE + "/pos");
await settle();
const posSearch = page.locator('input[placeholder*="Сканер"]');
await posSearch.fill("xros mini");
await page.waitForSelector('button:has-text("Картридж Vaporesso XROS 2мл")', { timeout: 5000 });
check("Касса: «xros mini» находит картриджи XROS (алиас)", true);
await shot(page, "t19_pos_alias.png");

// ---- продажа картриджа Ивану → напоминание через 14 дней ----
await posSearch.fill("4600000000017");
await posSearch.press("Enter");
await settle(600);
await page.fill('input[placeholder*="Телефон клиента"]', "+7 916 123-45-67");
await page.click('button:has-text("Продать")');
await page.waitForSelector("text=/Продажа №S-\\d+/");
const saleMsg = await page.locator("text=/Продажа №S-\\d+/").first().textContent();
check("Касса: продажа картриджа Ивану прошла", /Продажа №S-\d+/.test(saleMsg ?? ""), saleMsg ?? "");

const reminder = await db.saleReminder.findFirst({
  where: { clientId: ivan.id, sentAt: null },
  orderBy: { id: "desc" },
});
check("Напоминание создано после продажи", Boolean(reminder));
const days = reminder ? Math.round((reminder.dueAt.getTime() - Date.now()) / 86400000) : 0;
check("Напоминание через ~14 дней", days >= 13 && days <= 15, `${days} дн.`);

// ---- бот-помпа: отправка без реального Telegram (фейковая функция send) ----
await db.saleReminder.create({
  data: { clientId: ivan.id, productId: reminder.productId, dueAt: new Date(Date.now() - 1000) },
});
const { pumpMessaging } = await import("../lib/messaging.ts");
const sentMessages = [];
const sentCount = await pumpMessaging(async (chatId, text) => {
  sentMessages.push({ chatId, text });
});
check("Помпа отправила сообщения из очереди", sentCount >= 1, `отправлено: ${sentCount}`);
const reminderSent = sentMessages.find((m) => m.chatId === "test-chat-ivan" && m.text.includes("Пора сменить"));
check("Напоминание дошло до чата Ивана", Boolean(reminderSent), reminderSent?.text ?? "");
const marked = await db.saleReminder.findFirst({
  where: { clientId: ivan.id, sentAt: { not: null } },
  orderBy: { id: "desc" },
});
check("Отправленное помечено sentAt в БД", Boolean(marked));

// ---- QR-этикетка ----
const r1 = await db.repairOrder.findUnique({ where: { id: 1 } });
await page.goto(BASE + "/repairs/1/label");
await settle();
const img = page.locator("img.label-qr, img[alt='QR статуса заказа']");
check("Этикетка: QR-картинка на месте", (await img.count()) === 1);
check("Этикетка: номер с кодом на ней", await page.isVisible(`text=R-1-${r1.accessCode}`));
check("Этикетка: кнопка Печать есть", await page.isVisible('button:has-text("Печать")'));
check("Этикетка: QR кодирует ссылку статуса", (await img.getAttribute("src"))?.startsWith("data:image/png"));
await shot(page, "t20_label.png");

// ---- карточка: строка «статус клиенту» с кодом ----
await page.goto(BASE + "/repairs/1");
await settle();
check("Карточка: ссылка статуса с кодом", await page.isVisible(`text=/status?n=R-1-${r1.accessCode}`));

// ---- уборка: отвязываем фейковый чат и возвращаем алиасы XROS ----
await db.client.update({ where: { id: ivan.id }, data: { telegramChatId: null } });
await db.compatibility.update({
  where: { model: "XROS" },
  data: { aliases: "XROS Mini, XROS 2, XROS 3, XROS 3 Mini" },
});
await db.$disconnect();
await browser.close();

const failed = results.filter((r) => !r.ok);
console.log("\n===== ИТОГ =====");
console.log(`Пройдено: ${results.length - failed.length}/${results.length}`);
if (failed.length) {
  for (const f of failed) console.log("  FAIL:", f.name);
  process.exit(1);
}
