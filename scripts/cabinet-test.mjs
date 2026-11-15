// Тест PWA + клиентского кабинета: регистрация, вход, таймлайн, желаемое время.
// Запуск: node scripts/cabinet-test.mjs (dev-сервер должен работать)
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

// детерминированность: чистим следы прошлых прогонов
await db.repairOrder.deleteMany({ where: { client: { phone: "299001122" } } });
await db.client.deleteMany({ where: { phone: "299001122" } });
await db.clientSession.deleteMany({});

const PHONE = "+375 29 900-11-22";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(20000);

// свежезапущенный dev-сервер может оборвать первый запрос (идёт компиляция) — ретраим
const rawGoto = page.goto.bind(page);
page.goto = async (url, opts) => {
  for (let i = 0; i < 3; i++) {
    try {
      return await rawGoto(url, opts);
    } catch (e) {
      if (i === 2 || !String(e.message).includes("ERR_ABORTED")) throw e;
      await page.waitForTimeout(1500);
    }
  }
};

const settle = async (ms = 800) => {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(ms);
};

// ---- PWA: манифест, иконки, sw ----
const manifestRes = await page.request.get(BASE + "/manifest.webmanifest");
check("PWA: манифест отдаётся", manifestRes.ok());
const manifestJson = await manifestRes.json().catch(() => null);
check("PWA: в манифесте есть имя и иконки", manifestJson?.name?.includes("VapeCRM") && manifestJson?.icons?.length >= 2);
check("PWA: иконка 192 доступна", (await page.request.get(BASE + "/icons/icon-192.png")).ok());
check("PWA: sw.js доступен", (await page.request.get(BASE + "/sw.js")).ok());

await page.goto(BASE + "/");
const manifestLink = await page.locator('link[rel="manifest"]').getAttribute("href").catch(() => null);
check("PWA: <link rel=manifest> в разметке", manifestLink?.includes("manifest") ?? false);

// ---- запись с желаемым временем ----
await page.goto(BASE + "/book");
await page.fill('input[name="phone"]', PHONE);
await page.fill('input[name="name"]', "Кабинет Тест");
await page.fill('input[name="deviceModel"]', "Vaporesso XROS 5");
await page.fill('input[name="preferredAt"]', "2026-11-20T15:00");
await page.click('button:has-text("Записаться на ремонт")');
await page.waitForURL("**/book?ok=*", { timeout: 10000 });
await settle();
const num = await page.locator("p.text-lg").first().textContent();
const order = await db.repairOrder.findFirst({ orderBy: { id: "desc" } });
check("Запись с желаемым временем создана", Boolean(num && order), num ?? "");
check("preferredAt сохранился в БД", order?.preferredAt != null && order.preferredAt.getHours() === 15 && order.preferredAt.getDate() === 20, order?.preferredAt);

// ---- регистрация кабинета по телефону из записи ----
await page.click("text=создай личный кабинет");
await page.waitForURL("**/cabinet/register**");
const prefilled = await page.locator('input[name="phone"]').getAttribute("value");
check("Регистрация: телефон подставился из записи", prefilled?.includes("29 900-11-22"), prefilled ?? "");
await page.fill('input[name="password"]', "test123");
await page.click('button:has-text("Создать кабинет")');
await page.waitForURL("**/my", { timeout: 10000 });
await settle();
check("Регистрация → авто-вход в кабинет", page.url().includes("/my"));
check("Кабинет: заказ виден в таймлайне", await page.isVisible("text=Ремонт Vaporesso XROS 5"));
check("Кабинет: статус заказа виден", await page.isVisible("text=Принят"));
await shot(page, "t27_cabinet_my.png");

// ---- безопасность: клиентская сессия не открывает админку ----
await page.goto(BASE + "/repairs");
await settle();
check("Клиент не попадает в админку (/repairs → /login)", page.url().includes("/login"), page.url());

// ---- выход и повторный вход через ЕДИНУЮ страницу /login ----
await page.goto(BASE + "/my");
await page.click('button:has-text("Выйти")');
await page.waitForURL("**/login", { timeout: 10000 });
await page.goto(BASE + "/my");
await settle();
check("После выхода /my требует вход", new URL(page.url()).pathname === "/login", page.url());

await page.goto(BASE + "/login");
await page.fill('input[name="login"]', PHONE);
await page.fill('input[name="password"]', "wrongpass");
await page.click('button:has-text("Войти")');
await page.waitForURL("**/login?error=1", { timeout: 10000 }).catch(() => {});
check("Вход с неверным паролем → ошибка", await page.isVisible("text=Неверные данные"));

await page.fill('input[name="login"]', PHONE);
await page.fill('input[name="password"]', "test123");
await page.click('button:has-text("Войти")');
await page.waitForURL("**/my", { timeout: 10000 });
check("Вход клиента через /login → кабинет", page.url().includes("/my"));

// ---- повторная регистрация → «уже создан» ----
await page.goto(BASE + "/cabinet/register");
await page.fill('input[name="phone"]', PHONE);
await page.fill('input[name="password"]', "test123");
await page.click('button:has-text("Создать кабинет")');
await page.waitForURL("**/cabinet/register?error=already_registered", { timeout: 10000 });
check("Повторная регистрация → «аккаунт уже создан»", await page.isVisible("text=уже создан"));

// ---- сотрудник видит желаемое время в карточке ----
const admin = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await admin.goto(BASE + "/login");
await admin.fill('input[name="login"]', "admin");
await admin.fill('input[name="password"]', "admin123");
await admin.click('button:has-text("Войти")');
await admin.waitForURL("**/repairs");
await admin.goto(BASE + `/repairs/${order.id}`);
await admin.waitForLoadState("networkidle");
check("Карточка: «Клиент хочет прийти» видна сотруднику", await admin.isVisible("text=Клиент хочет прийти"));
check("Карточка: время совпадает", await admin.isVisible("text=20.11.26, 15:00"));
await shot(admin, "t28_admin_preferred.png");

// уборка: оставляем демо-данные (кабинет с заказом полезен для показа)
await db.$disconnect();
await browser.close();

const failed = results.filter((r) => !r.ok);
console.log("\n===== ИТОГ =====");
console.log(`Пройдено: ${results.length - failed.length}/${results.length}`);
if (failed.length) {
  for (const f of failed) console.log("  FAIL:", f.name);
  process.exit(1);
}
