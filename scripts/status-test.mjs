// Тест «публичный статус»: без логина, код доступа, приватность.
// Запуск: node scripts/status-test.mjs (dev-сервер должен работать)
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const BASE = "http://localhost:3000";
const SHOTS = "C:/Users/gleb/.zcode/workspace/1794608265663-20fe0683-abf0-414f-bd06-1eaab098e561/gui-test-screenshots";

const db = new PrismaClient();
const r1 = await db.repairOrder.findUnique({ where: { id: 1 } });
const r4 = await db.repairOrder.findUnique({ where: { id: 4 } });
await db.$disconnect();

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
// свежий контекст БЕЗ cookie — имитация клиента с улицы
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(20000);
const settle = async (ms = 800) => {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(ms);
};

// ---- публичная страница не требует логина ----
await page.goto(BASE + "/status");
await settle();
check("Страница /status открыта без логина", page.url().includes("/status"), page.url());
check("Форма проверки на месте", await page.isVisible('input[name="n"]'));

// ---- только номер без кода не открывает заказ ----
await page.fill('input[name="n"]', "R-1");
await page.click('button:has-text("Проверить")');
await settle();
check("R-1 без кода: «не найден» (защита)", await page.isVisible("text=не найден"));

// ---- номер с кодом открывает статус ----
await page.fill('input[name="n"]', `R-1-${r1.accessCode}`);
await page.click('button:has-text("Проверить")');
await page.waitForURL(`**/status?n=R-1-${r1.accessCode}`, { timeout: 10000 }).catch(() => {});
await settle();
check("R-1 + код: статус «Диагностика»", await page.isVisible("text=Диагностика"));
check("R-1 + код: устройство видно", await page.isVisible("text=Vaporesso XROS 3 Mini"));
check("Приватность: имени клиента нет", (await page.locator("text=Олег").count()) === 0);
check("Приватность: телефона нет", (await page.locator("text=905 777").count()) === 0);
check("Приватность: описания проблемы нет", (await page.locator("text=разболтался").count()) === 0);
await shot(page, "t17_status.png");

// ---- неверный код ----
await page.fill('input[name="n"]', "R-1-XXXXX");
await page.click('button:has-text("Проверить")');
await page.waitForURL("**/status?n=R-1-XXXXX", { timeout: 10000 }).catch(() => {});
await settle();
check("R-1 + неверный код: «не найден»", await page.isVisible("text=не найден"));

// ---- несуществующий номер ----
await page.fill('input[name="n"]', "R-999-ABCDE");
await page.click('button:has-text("Проверить")');
await page.waitForURL("**/status?n=R-999-ABCDE", { timeout: 10000 }).catch(() => {});
await settle();
check("R-999: сообщение «не найден»", await page.isVisible("text=не найден"));

// ---- нормализация: маленькими буквами ----
await page.fill('input[name="n"]', `r4-${r4.accessCode.toLowerCase()}`);
await page.click('button:has-text("Проверить")');
await page.waitForURL(`**/status?n=r4-${r4.accessCode.toLowerCase()}`, { timeout: 10000 }).catch(() => {});
await settle();
check("«r4-код» → заказ R-4 найден", await page.isVisible("text=Vaporesso XROS Mini"));
check("R-4: статус «Выдан» и цена видны", (await page.isVisible("text=27 Br")));

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log("\n===== ИТОГ =====");
console.log(`Пройдено: ${results.length - failed.length}/${results.length}`);
if (failed.length) {
  for (const f of failed) console.log("  FAIL:", f.name);
  process.exit(1);
}
