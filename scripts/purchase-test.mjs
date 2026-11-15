// Тест «список закупки»: пороги, рекомендация, поступление закрывает позицию, роли.
// Запуск: node scripts/purchase-test.mjs (dev-сервер должен работать)
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const db = new PrismaClient();

const BASE = "http://localhost:3000";
const SHOTS = "C:/Users/gleb/.zcode/workspace/1794608265663-20fe0683-abf0-414f-bd06-1eaab098e561/gui-test-screenshots";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
}
async function shot(page, name) {
  await page.screenshot({ path: join(SHOTS, name) });
}

await mkdir(SHOTS, { recursive: true });

// детерминированность: убираем товар прошлых прогонов (уникальный штрихкод)
await db.product.deleteMany({ where: { barcode: "4600000000999" } });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(20000);
const settle = async (ms = 1200) => {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(ms);
};

// ---- вход админом ----
await page.goto(BASE + "/");
await page.fill('input[name="login"]', "admin");
await page.fill('input[name="password"]', "admin123");
await page.click('button:has-text("Войти")');
await page.waitForURL("**/repairs");

// ---- склад: плашка закупки ----
await page.click('nav >> text=Склад');
await page.waitForURL("**/inventory");
await settle();
check("Склад: плашка «Требуется закупка» видна админу", await page.isVisible("text=Требуется закупка"));
await shot(page, "t14_inventory_alert.png");

// ---- страница закупки ----
await page.click('a:has-text("Требуется закупка")');
await page.waitForURL("**/purchase");
await settle();
const caliburn = page.locator("tr", { hasText: "Caliburn G2" });
const caliburnNeed = await caliburn.locator("td").nth(3).textContent();
check("Закупка: Caliburn (3 из 5) → заказать 7 шт", caliburnNeed?.includes("7"), caliburnNeed?.trim());
const plata = page.locator("tr", { hasText: "Плата Vaporesso XROS" });
const plataNeed = await plata.locator("td").nth(3).textContent();
check("Закупка: Плата (2 из 3) → заказать 4 шт", plataNeed?.includes("4"), plataNeed?.trim());
check("Закупка: итоговая сумма присутствует", await page.isVisible("text=Позиций:"));
check("Закупка: сумма в белорусских рублях", (await page.locator("tfoot").textContent())?.includes("Br"));
await shot(page, "t15_purchase.png");

// ---- создаём товар с низким остатком ----
await page.goto(BASE + "/inventory/new");
await settle(400);
await page.fill('input[name="name"]', "Фитиль тестовый");
await page.fill('input[name="barcode"]', "4600000000999");
await page.selectOption('select[name="category"]', "PART");
await page.fill('input[name="price"]', "100");
await page.fill('input[name="cost"]', "1");
await page.fill('input[name="qty"]', "2");
await page.fill('input[name="minQty"]', "10");
await page.click('button:has-text("Сохранить")');
await page.waitForURL("**/inventory");
await settle();

// ---- он в списке закупки: нужно 2×10−2=18 ----
await page.goto(BASE + "/purchase");
await settle();
const wick = page.locator("tr", { hasText: "Фитиль тестовый" });
check("Закупка: новый товар с остатком 2/10 попал в список", (await wick.count()) === 1);
const wickNeed = await wick.locator("td").nth(3).textContent();
check("Закупка: рекомендация 18 шт (2×10−2)", wickNeed?.includes("18"), wickNeed?.trim());

// ---- поступление закрывает позицию ----
await page.click('a:has-text("Фитиль тестовый")');
await page.waitForURL("**/inventory/**");
await settle(400);
await page.fill('input[name="add"]', "20");
await page.click('button:has-text("Прибавить")');
await settle(1500);
await page.goto(BASE + "/purchase");
await settle();
check("Закупка: после поступления позиция ушла из списка", (await page.locator("tr", { hasText: "Фитиль тестовый" }).count()) === 0);

// ---- роли: мастеру закупка недоступна ----
await page.click('button:has-text("Выйти")');
await page.waitForURL("**/login");
await page.fill('input[name="login"]', "master");
await page.fill('input[name="password"]', "master123");
await page.click('button:has-text("Войти")');
await page.waitForURL("**/repairs");

await page.goto(BASE + "/purchase");
await settle();
check("MASTER: /purchase редирект (нет доступа)", new URL(page.url()).pathname === "/repairs", page.url());
await page.click('nav >> text=Склад');
await page.waitForURL("**/inventory");
await settle();
check("Склад у мастера: нет плашки закупки", (await page.locator("text=Требуется закупка").count()) === 0);
await shot(page, "t16_inventory_master.png");

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log("\n===== ИТОГ =====");
console.log(`Пройдено: ${results.length - failed.length}/${results.length}`);
if (failed.length) {
  for (const f of failed) console.log("  FAIL:", f.name);
  process.exit(1);
}
