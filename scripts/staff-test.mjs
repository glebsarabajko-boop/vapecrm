// Тест «Сотрудники»: создание, смена пароля, отключение, права доступа.
// Запуск: node scripts/staff-test.mjs (dev-сервер должен работать)
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

// детерминированность: убираем следы прошлых прогонов
await db.user.deleteMany({ where: { login: "kasir" } });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(20000);
const settle = async (ms = 800) => {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(ms);
};

// ---- вход админом ----
await page.goto(BASE + "/login");
await page.fill('input[name="login"]', "admin");
await page.fill('input[name="password"]', "admin123");
await page.click('button:has-text("Войти")');
await page.waitForURL("**/repairs", { timeout: 10000 });

// ---- страница «Сотрудники» ----
await page.goto(BASE + "/staff");
await settle();
check("Страница «Сотрудники» открывается админу", await page.isVisible("text=Сотрудники"));
check("В списке есть master (Артём)", await page.isVisible("text=Артём (мастер)"));
check("Кнопка «Отключить» для админа заблокирована", (await page.locator('button:has-text("Отключить"):disabled').count()) >= 1);

// ---- создание сотрудника kasir ----
const createForm = page.locator("form", { has: page.locator('input[name="login"]') });
await createForm.locator('input[name="login"]').fill("kasir");
await createForm.locator('input[name="name"]').fill("Кассир Тестовый");
await createForm.locator('select[name="role"]').selectOption("MASTER");
await createForm.locator('input[name="password"]').fill("kasir123");
await createForm.locator('button:has-text("Добавить сотрудника")').click();
await settle(1000);
check("Новый сотрудник появился в списке", await page.isVisible("text=Кассир Тестовый"));
await shot(page, "t29_staff.png");

// ---- kasir входит и видит рабочий интерфейс ----
await page.click('button:has-text("Выйти")');
await page.waitForURL("**/login", { timeout: 10000 });
await page.fill('input[name="login"]', "kasir");
await page.fill('input[name="password"]', "kasir123");
await page.click('button:has-text("Войти")');
await page.waitForURL("**/repairs", { timeout: 10000 });
check("Новый сотрудник входит и попадает на /repairs", page.url().includes("/repairs"));

// ---- kasir не имеет доступа к /staff ----
await page.goto(BASE + "/staff");
await settle();
check("Мастер: /staff недоступен (редирект)", !page.url().includes("/staff"), page.url());

// ---- админ меняет пароль kasir ----
await page.goto(BASE + "/login");
await page.fill('input[name="login"]', "admin");
await page.fill('input[name="password"]', "admin123");
await page.click('button:has-text("Войти")');
await page.waitForURL("**/repairs", { timeout: 10000 });
await page.goto(BASE + "/staff");
await settle();
const kasirRow = page.locator("tr", { hasText: "Кассир Тестовый" });
await kasirRow.locator('input[name="password"]').fill("newpass6");
await kasirRow.locator('button:has-text("Сменить")').click();
await settle(1000);

// старый пароль больше не работает
await page.click('button:has-text("Выйти")');
await page.waitForURL("**/login", { timeout: 10000 });
await page.fill('input[name="login"]', "kasir");
await page.fill('input[name="password"]', "kasir123");
await page.click('button:has-text("Войти")');
await page.waitForURL("**/login?error=1", { timeout: 10000 }).catch(() => {});
check("Старый пароль kasir123 больше не работает", await page.isVisible("text=Неверные данные"));

// новый пароль работает
await page.fill('input[name="login"]', "kasir");
await page.fill('input[name="password"]', "newpass6");
await page.click('button:has-text("Войти")');
await page.waitForURL("**/repairs", { timeout: 10000 });
check("Новый пароль newpass6 работает", page.url().includes("/repairs"));

// ---- отключение доступа ----
await page.goto(BASE + "/login");
await page.fill('input[name="login"]', "admin");
await page.fill('input[name="password"]', "admin123");
await page.click('button:has-text("Войти")');
await page.waitForURL("**/repairs", { timeout: 10000 });
await page.goto(BASE + "/staff");
await settle();
await page.locator("tr", { hasText: "Кассир Тестовый" }).locator('button:has-text("Отключить")').click();
await settle(1000);
check("Сотрудник отключён (кнопка сменилась на «Включить»)",
  (await page.locator("tr", { hasText: "Кассир Тестовый" }).locator('button:has-text("Включить")').count()) === 1);

await page.click('button:has-text("Выйти")');
await page.waitForURL("**/login", { timeout: 10000 });
await page.fill('input[name="login"]', "kasir");
await page.fill('input[name="password"]', "newpass6");
await page.click('button:has-text("Войти")');
await page.waitForURL("**/login?error=1", { timeout: 10000 }).catch(() => {});
check("Отключённый сотрудник не входит (живая сессия сброшена)", await page.isVisible("text=Неверные данные"));
await shot(page, "t30_login_disabled.png");

// уборка
await db.user.deleteMany({ where: { login: "kasir" } });
await db.$disconnect();
await browser.close();

const failed = results.filter((r) => !r.ok);
console.log("\n===== ИТОГ =====");
console.log(`Пройдено: ${results.length - failed.length}/${results.length}`);
if (failed.length) {
  for (const f of failed) console.log("  FAIL:", f.name);
  process.exit(1);
}
