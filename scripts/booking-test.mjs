// Тест «публичная запись на ремонт» + белорусские номера.
// Запуск: node scripts/booking-test.mjs (dev-сервер должен работать)
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

// нормализация номеров (юнит-проверка общего модуля)
const { normalizePhone, formatPhone } = await import("../lib/format.ts");
check("Нормализация: +375 29 123-45-67 → 291234567", normalizePhone("+375 29 123-45-67") === "291234567");
check("Нормализация: 375291234567 → 291234567", normalizePhone("375291234567") === "291234567");
check("Нормализация: 8 029 123-45-67 → 291234567", normalizePhone("8 029 123-45-67") === "291234567");
// все мобильные коды Беларуси: 25 (Life:), 29 (A1/МТС), 33 (МТС), 44 (A1)
check("Нормализация: +375 25 123-45-67 → 251234567 (Life:)", normalizePhone("+375 25 123-45-67") === "251234567");
check("Нормализация: +375 33 123-45-67 → 331234567 (МТС)", normalizePhone("+375 33 123-45-67") === "331234567");
check("Нормализация: 8 044 123-45-67 → 441234567 (A1)", normalizePhone("8 044 123-45-67") === "441234567");
check("Нормализация: 8 25 123-45-67 → 251234567", normalizePhone("8 25 123-45-67") === "251234567");
// минский городской: 17 + 7 цифр — тоже 9 цифр
check("Нормализация: +375 17 234-56-78 → 172345678", normalizePhone("+375 17 234-56-78") === "172345678");
check("Нормализация: 8 916 123-45-67 → 9161234567 (RU)", normalizePhone("8 916 123-45-67") === "9161234567");
check("Форматирование: 291234567 → +375 29 123-45-67", formatPhone("291234567") === "+375 29 123-45-67");
check("Форматирование: 251234567 → +375 25 123-45-67 (Life:)", formatPhone("251234567") === "+375 25 123-45-67");

await mkdir(SHOTS, { recursive: true });

// детерминированность: убираем следы прошлых прогонов теста
await db.repairOrder.deleteMany({
  where: { client: { phone: { in: ["291234567", "445556677"] } } },
});
await db.client.deleteMany({ where: { phone: { in: ["291234567", "445556677"] } } });

const browser = await chromium.launch({ headless: true });
// свежий контекст без cookie — как обычный посетитель сайта
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(20000);
const settle = async (ms = 800) => {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(ms);
};

const clientsBefore = await db.client.count();
const ordersBefore = await db.repairOrder.count();

// ---- публичная запись с белорусским номером ----
await page.goto(BASE + "/book");
await settle();
check("/book открывается без логина", await page.isVisible("text=Запись на ремонт"));

await page.fill('input[name="phone"]', "+375 29 123-45-67");
await page.fill('input[name="name"]', "Тест BY");
await page.fill('input[name="deviceModel"]', "Vaporesso XROS 5");
await page.fill('input[name="password"]', "test123");
await page.click('button:has-text("Записаться на ремонт")');
await page.waitForURL("**/book?ok=*", { timeout: 10000 });
await settle();
const bookingNum = await page.locator("p.text-lg").first().textContent();
check("Заявка принята, номер показан", /^R-\d+-[A-Z0-9]{4,8}$/.test(bookingNum ?? ""), bookingNum ?? "");
await shot(page, "t23_book_success.png");

// пароль из заявки сразу создаёт кабинет
const byClient = await db.client.findUnique({ where: { phone: "291234567" } });
check("Пароль кабинета задан прямо при записи", Boolean(byClient?.passwordHash));
await page.goto(BASE + "/login");
await page.fill('input[name="login"]', "291234567");
await page.fill('input[name="password"]', "test123");
await page.click('button:has-text("Войти")');
await page.waitForURL("**/my", { timeout: 10000 });
check("Вход клиента через /login сразу после записи", page.url().includes("/my"));
await page.goto(BASE + "/my");
await page.click('button:has-text("Выйти")');
await page.waitForURL("**/login", { timeout: 10000 });

// ---- в БД: клиент с нормализованным BY-номером + заказ «Принят» ----
const client = await db.client.findUnique({ where: { phone: "291234567" } });
check("В БД клиент с номером 291234567 (без кода страны)", Boolean(client));
check("В БД имя из формы", client?.name === "Тест BY", client?.name);
const order = await db.repairOrder.findFirst({
  where: { clientId: client.id },
  orderBy: { id: "desc" },
});
check("Заказ в статусе «Принят»", order?.status === "INTAKE");
check("У заказа есть код доступа", /^[A-Z0-9]{5}$/.test(order?.accessCode ?? ""));
check("Проблема-заглушка из формы", (order?.problem ?? "").includes("детали уточним"));

// ---- повторная запись с тем же номером → тот же клиент ----
await page.goto(BASE + "/book");
await page.fill('input[name="phone"]', "8029 123-45-67"); // другой формат, тот же номер
await page.fill('input[name="deviceModel"]', "Oxva Xlim Pro");
await page.click('button:has-text("Записаться на ремонт")');
await page.waitForURL("**/book?ok=*", { timeout: 10000 });
await settle();
const clientAfter = await db.client.findMany({ where: { phone: "291234567" } });
check("8 029-формат привёл к тому же клиенту (без дублей)", clientAfter.length === 1);
const ordersOfClient = await db.repairOrder.count({ where: { clientId: client.id } });
check("Заказов у клиента теперь два", ordersOfClient === 2, `фактически: ${ordersOfClient}`);

// ---- honeypot: бот, заполнивший скрытое поле, отклоняется ----
const clientsAfterBooking = await db.client.count();
await page.goto(BASE + "/book");
await page.fill('input[name="phone"]', "+375 44 555-66-77");
await page.fill('input[name="deviceModel"]', "Спам-устройство");
// спам-бот заполняет поля через DOM API, минуя видимость — имитируем именно это
await page.locator('input[name="website"]').evaluate((el) => {
  el.value = "http://spam.example";
});
await page.click('button:has-text("Записаться на ремонт")');
await page.waitForURL("**/book", { timeout: 10000 });
await settle();
check("Honeypot: спам-заявка отклонена", (await db.client.count()) === clientsAfterBooking);

// ---- форма без телефона → ошибка (пробелы проходят required, но не нормализацию) ----
await page.goto(BASE + "/book");
await page.fill('input[name="phone"]', "   ");
await page.fill('input[name="deviceModel"]', "   ");
await page.click('button:has-text("Записаться на ремонт")');
await page.waitForURL("**/book?error=1", { timeout: 10000 });
check("Форма без валидного телефона → подсказка об ошибке", await page.isVisible("text=Заполни телефон"));

// ---- заявка видна клиенту через публичный статус ----
const order2 = await db.repairOrder.findFirst({ where: { clientId: client.id }, orderBy: { id: "desc" } });
await page.goto(`${BASE}/status?n=R-${order2.id}-${order2.accessCode}`);
await settle();
check("Статус по номеру из записи работает", await page.isVisible("text=Oxva Xlim Pro"));
check("Статус: этап «Принят» подсвечен", await page.isVisible("text=Принят"));
await shot(page, "t24_status_from_booking.png");

// ---- заявка видна сотруднику в общем списке ремонтов ----
const admin = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await admin.goto(BASE + "/login");
await admin.fill('input[name="login"]', "admin");
await admin.fill('input[name="password"]', "admin123");
await admin.click('button:has-text("Войти")');
await admin.waitForURL("**/repairs");
await admin.goto(BASE + `/repairs/${order2.id}`);
await admin.waitForLoadState("networkidle");
check("Админ: заявка из /book лежит в карточке ремонта", await admin.isVisible("text=Тест BY"));
await shot.call(null, admin, "t25_admin_sees_booking.png");

// ---- уборка: тестовые записи оставляем (демо-данные), чат не трогаем ----
await db.$disconnect();
await browser.close();

const failed = results.filter((r) => !r.ok);
console.log("\n===== ИТОГ =====");
console.log(`Пройдено: ${results.length - failed.length}/${results.length}`);
if (failed.length) {
  for (const f of failed) console.log("  FAIL:", f.name);
  process.exit(1);
}
