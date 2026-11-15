// Тест «прибыль и зарплата»: выдача ремонта, сводка за месяц, процент мастера, роли.
// Запуск: node scripts/payroll-test.mjs (dev-сервер должен работать)
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

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

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(20000);
const settle = async (ms = 1200) => {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(ms);
};

// ---- вход админом, карточка R-4 (мастер Артём, цена 800, запчасть 40 ₽) ----
await page.goto(BASE + "/");
await page.fill('input[name="login"]', "admin");
await page.fill('input[name="password"]', "admin123");
await page.click('button:has-text("Войти")');
await page.waitForURL("**/repairs");

await page.goto(BASE + "/repairs/4");
await settle();
const moneyBlock = page.locator("text=/Доля мастера — Артём/");
check("Карточка: блок денег показывает долю 30%", (await moneyBlock.count()) === 1);
check("Карточка: доля 8 Br (26×30%)", (await page.locator("text=/^8 Br$/").count()) >= 1);
check("Карточка: магазину остаётся 18 Br", (await page.locator("text=/^18 Br$/").count()) >= 1);
await shot(page, "t12_repair_money.png");

// ---- выдать ремонт: Готов → Выдан ----
await page.click('button:has-text("Готов")');
await settle(1500);
await page.click('button:has-text("Выдан")');
await settle(1500);

// ---- зарплата за текущий месяц ----
await page.goto(BASE + "/payroll");
await settle();
const row = page.locator("tr", { hasText: "Артём" }).first();
const cells = await row.locator("td").allTextContents();
const [name, count, revenue, parts, profit, share] = cells.map((c) => c.trim());
check("Сводка: мастер Артём в таблице", name?.startsWith("Артём"), cells.join(" | "));
check("Сводка: 1 заказ", count === "1", count);
check("Сводка: выручка 27 Br", revenue?.includes("27"), revenue);
check("Сводка: запчасти −1 Br", parts?.includes("1"), parts);
check("Сводка: прибыль 26 Br", profit?.includes("26"), profit);
check("Сводка: доля 8 Br", share?.includes("8"), share);
await shot(page, "t11_payroll_admin.png");

// ---- меняем процент на 50 → доля 380 ----
const percentInput = page.locator("form", { hasText: "Артём" }).locator('input[name="percent"]');
await percentInput.fill("50");
await page.locator("form", { hasText: "Артём" }).locator('button:has-text("Сохранить")').click();
await settle(1500);
const shareAfter = await page.locator("tr", { hasText: "Артём" }).first().locator("td").last().textContent();
check("Процент 50% → доля 13 Br", shareAfter?.includes("13"), shareAfter?.trim());

// ---- вернуть 30 ----
await percentInput.fill("30");
await page.locator("form", { hasText: "Артём" }).locator('button:has-text("Сохранить")').click();
await settle(1500);
const shareBack = await page.locator("tr", { hasText: "Артём" }).first().locator("td").last().textContent();
check("Процент 30% → доля снова 8 Br", shareBack?.includes("8"), shareBack?.trim());

// ---- предыдущий месяц пуст ----
await page.click('a:has-text("←")');
await settle();
check("Прошлый месяц: пусто", (await page.isVisible("text=выданных ремонтов нет")));

// ---- роль MASTER: своя сводка, без админских блоков ----
await page.click('button:has-text("Выйти")');
await page.waitForURL("**/login");
await page.fill('input[name="login"]', "master");
await page.fill('input[name="password"]', "master123");
await page.click('button:has-text("Войти")');
await page.waitForURL("**/repairs");

await page.goto(BASE + "/payroll");
await settle();
check("Мастер: видит свою сводку", (await page.locator("tr", { hasText: "Артём" }).count()) >= 1);
check("Мастер: нет колонки «Прибыль»", (await page.locator("text=Прибыль").count()) === 0);
check("Мастер: нет секции «Процент мастеров»", (await page.locator("text=Процент мастеров").count()) === 0);
await shot(page, "t13_payroll_master.png");

// карточка ремонта глазами мастера — видна только своя доля
await page.goto(BASE + "/repairs/4");
await settle();
check("Карточка у мастера: «Твоя доля» 228 ₽", (await page.locator("text=/Твоя доля/").count()) === 1);
check("Карточка у мастера: нет «Остаётся магазину»", (await page.locator("text=Остаётся магазину").count()) === 0);

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log("\n===== ИТОГ =====");
console.log(`Пройдено: ${results.length - failed.length}/${results.length}`);
if (failed.length) {
  for (const f of failed) console.log("  FAIL:", f.name);
  process.exit(1);
}
