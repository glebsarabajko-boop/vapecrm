// Смоук-тест UI в headless Chromium: весь основной сценарий CRM.
// Запуск: node scripts/smoke-test.mjs  (dev-сервер должен работать на localhost:3000)
// Идемпотентен: номера продаж/ремонтов читаются из фактических данных,
// остатки склада восстанавливаются перед прогоном.
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const BASE = "http://localhost:3000";
const SHOTS = "C:/Users/gleb/.zcode/workspace/1794608265663-20fe0683-abf0-414f-bd06-1eaab098e561/gui-test-screenshots";

// восстановить демо-остатки (прогон расходует товары)
const db = new PrismaClient();
const DEMO_STOCK = [
  { barcode: "4600000000017", qty: 24 },
  { barcode: "4600000000024", qty: 8 },
  { barcode: "4600000000031", qty: 3 },
  { barcode: "4600000000048", qty: 11 },
  { barcode: "4600000000055", qty: 15 },
  { barcode: "4600000000062", qty: 10 },
  { barcode: "4600000000079", qty: 7 },
  { barcode: "4600000000086", qty: 6 },
  { barcode: "4600000000093", qty: 2 },
  { barcode: "4600000000109", qty: 20 },
  { barcode: "4600000000116", qty: 30 },
  { barcode: "4600000000123", qty: 4 },
];
for (const p of DEMO_STOCK) {
  await db.product.update({ where: { barcode: p.barcode }, data: { qty: p.qty } });
}
await db.$disconnect();

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok, extra });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
}
async function shot(page, name) {
  await page.screenshot({ path: join(SHOTS, name), fullPage: false });
}

await mkdir(SHOTS, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(20000);

async function settle(ms = 1200) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(ms);
}
// первый span после h1 — бейдж статуса
const statusBadge = () => page.locator("main h1 ~ span").first();

// ---------- 1. Логин: неверный пароль ----------
await page.goto(BASE + "/");
await page.fill('input[name="login"]', "admin");
await page.fill('input[name="password"]', "wrongpass");
await page.click('button:has-text("Войти")');
await page.waitForURL("**/login?error=1");
await settle(300);
check("Вход с неверным паролем показывает ошибку", await page.isVisible("text=Неверные данные"));
await shot(page, "t2_login_error.png");

// ---------- 2. Логин админом ----------
await page.fill('input[name="login"]', "admin");
await page.fill('input[name="password"]', "admin123");
await page.click('button:has-text("Войти")');
await page.waitForURL("**/repairs");
await settle();
check("Логин admin → редирект на /repairs", page.url().includes("/repairs"));
check("В шапке видно роль админа", await page.isVisible("text=Владелец · админ"));

// ---------- 3. Склад: список, себестоимость, «мало осталось» ----------
await page.click('nav >> text=Склад');
await page.waitForURL("**/inventory");
await settle();
const caliburnRow = page.locator("tr", { hasText: "Картридж Uwell Caliburn G2" });
check("Склад: Caliburn G2 в списке", (await caliburnRow.count()) === 1);
check("Склад: бейдж «мало осталось» на Caliburn (3 < 5)", (await caliburnRow.locator("text=мало осталось").count()) === 1);
check("Склад: админ видит колонку «Себест.»", await page.isVisible("text=Себест."));
check("Склад: админ видит «Добавить товар»", await page.isVisible('a:has-text("Добавить товар")'));
await shot(page, "t3_inventory_admin.png");

// запоминаем остатки до продажи
const qtyOf = async (name) => {
  const text = await page.locator("tr", { hasText: name }).locator("td").last().textContent();
  return Number(text?.match(/\d+/)?.[0]);
};
const qtyXrosBefore = await qtyOf("Картридж Vaporesso XROS 2мл");
const qtyProBefore = await qtyOf("XROS Pro 3мл");

// ---------- 4. Касса: сканер + поиск, корзина, продажа ----------
await page.click('nav >> text=Касса');
await page.waitForURL("**/pos");
await settle();
const posSearch = page.locator('input[placeholder*="Сканер"]');
await posSearch.fill("xros");
await page.waitForSelector('button:has-text("Картридж Vaporesso XROS 2мл")');
const resultCount = await page.locator("main ul >> button").count();
check("Касса: поиск «xros» нашёл товары", resultCount >= 3, `найдено ${resultCount}`);

// сканер: штрихкод + Enter → товар в корзине, итог изменился с 0
await posSearch.fill("4600000000017");
await posSearch.press("Enter");
await page.waitForFunction(
  () => document.body.innerText.includes("12 Br × 1"),
  undefined,
  { timeout: 5000 }
).catch(() => {});
const totalAfterScan = await page.locator("span", { hasText: /^\d[\d\s]* Br$/ }).last().textContent().catch(() => "?");
check("Касса: сканер штрихкода добавил товар (итого 12 Br)", totalAfterScan?.includes("12"), `итого: ${totalAfterScan}`);

await posSearch.fill("xros");
await page.waitForSelector('button:has-text("Картридж Vaporesso XROS Pro 3мл")');
await page.click('button:has-text("Картридж Vaporesso XROS Pro 3мл")');
const total = await page.locator("span", { hasText: /^\d[\d\s]* Br$/ }).last().textContent();
check("Касса: итого 27 Br (12+15)", total?.replace(/\u00a0/g, " ").includes("27"), `итого: ${total}`);

await page.fill('input[placeholder*="Телефон клиента"]', "+7 916 123-45-67");
await page.click('button:has-text("Продать")');
await page.waitForSelector("text=/Продажа №S-\\d+/");
const saleMsg = await page.locator("text=/Продажа №S-\\d+/").first().textContent();
const saleNum = saleMsg?.match(/№(S-\d+)/)?.[1];
check("Касса: продажа проведена на 27 Br", /на 27 Br/.test(saleMsg ?? ""), saleMsg ?? "");
await shot(page, "t5_pos_sold.png");

// ---------- 5. Склад: остатки списались (-1 по каждой позиции) ----------
await page.click('nav >> text=Склад');
await page.waitForURL("**/inventory");
await settle();
const qtyXrosAfter = await qtyOf("Картридж Vaporesso XROS 2мл");
const qtyProAfter = await qtyOf("XROS Pro 3мл");
check("Склад: XROS 2мл списался −1", qtyXrosAfter === qtyXrosBefore - 1, `${qtyXrosBefore} → ${qtyXrosAfter}`);
check("Склад: XROS Pro списался −1", qtyProAfter === qtyProBefore - 1, `${qtyProBefore} → ${qtyProAfter}`);

// ---------- 6. Приёмка ремонта (новый клиент на лету) ----------
await page.click('nav >> text=Ремонты');
await page.waitForURL("**/repairs");
await page.click('a:has-text("Принять в ремонт")');
await page.waitForURL("**/repairs/new");
await settle(500);
await page.fill('input[placeholder*="+7 916"]', "+7 921 333-22-11");
await page.fill('input[placeholder="Иван"]', "Ольга");
await page.fill('input[placeholder="Vaporesso XROS 3"]', "Vaporesso XROS Mini");
await page.fill("textarea", "Перестал парить, мигает синим");
await page.click('button:has-text("Принять в ремонт")');
await page.waitForURL("**/repairs/**");
await settle();
const repairId = page.url().match(/\/repairs\/(\d+)/)?.[1];
const repairNum = `R-${repairId}`;
check("Приёмка: создана карточка заказа", Boolean(repairId), page.url());
check("Приёмка: статус «Принят»", (await statusBadge().textContent())?.includes("Принят"));

// поиск по модели устройства находит заказ (регистр не важен)
await page.goto(BASE + "/repairs?q=" + encodeURIComponent("XROS Mini"));
await settle();
check("Поиск: «XROS Mini» находит свой заказ", (await page.locator("a", { hasText: repairNum }).count()) >= 1);
check("Поиск: не находит чужие номера", (await page.locator("a", { hasText: "R-30-" }).count()) === 0);

// возвращаемся в карточку нового заказа
await page.goto(BASE + "/repairs/" + repairId);
await settle();

// ---------- 7. Карточка: мастер, статусы, запчасть, цена, маржа ----------
await page.getByLabel("Мастер").selectOption({ label: "Артём (мастер)" });
await page.click('button:has-text("Назначить")');
await settle(1500);
// перезагружаем карточку — проверяем сохранение в БД, а не локальное состояние селекта
await page.goto(page.url());
await settle(800);
const masterVal = await page.getByLabel("Мастер").inputValue().catch(() => "?");
check("Карточка: мастер закрепился", masterVal !== "" && masterVal !== "?", `select=${masterVal}`);

await page.click('button:has-text("Диагностика")');
await settle(1500);
await page.click('button:has-text("В работе")');
await settle(1500);
check("Карточка: статус «В работе»", (await statusBadge().textContent())?.includes("В работе"));

const usbLabel = await page.locator("option", { hasText: "Разъём USB-C" }).textContent();
await page.getByLabel("Запчасть со склада").selectOption({ label: usbLabel ?? undefined });
await page.click('button:has-text("Списать")');
await settle(1500);
check("Карточка: запчасть в таблице", (await page.locator("tr", { hasText: "Разъём USB-C" }).count()) === 1);

await page.getByLabel("Цена для клиента, ₽").fill("27");
await page.click('button:has-text("Сохранить")');
await page.waitForSelector("text=Прибыль с ремонта", { timeout: 10000 }).catch(() => {});
await settle(300);
// блок денег: цена 27 − запчасти 1 = прибыль 26 Br
check("Карточка: прибыль 27−1=26 Br видна админу", (await page.locator("text=/^26 Br$/").count()) >= 1);
await shot(page, "t7_repair_card.png");

// ---------- 8. Клиенты: общий таймлайн ----------
await page.click('nav >> text=Клиенты');
await page.waitForURL("**/clients");
await settle();
await page.click('a:has-text("Олег")');
await page.waitForURL("**/clients/**");
await settle();
check("Клиент Олег: история содержит ремонт R-1", (await page.locator("a", { hasText: "R-1" }).count()) >= 1);
await shot(page, "t8_client_history.png");

await page.click('nav >> text=Клиенты');
await page.waitForURL("**/clients");
await page.click('a:has-text("Иван")');
await page.waitForURL("**/clients/**");
await settle();
check("Клиент Иван: история содержит покупку S-1", (await page.locator("li", { hasText: "покупка" }).count()) >= 1);

// ---------- 9. Роль MASTER: нет админских прав ----------
await page.click('button:has-text("Выйти")');
await page.waitForURL("**/login");
await settle(300);
await page.fill('input[name="login"]', "master");
await page.fill('input[name="password"]', "master123");
await page.click('button:has-text("Войти")');
await page.waitForURL("**/repairs");
check("Логин master → тоже /repairs", page.url().includes("/repairs"));

await page.click('nav >> text=Склад');
await page.waitForURL("**/inventory");
await settle();
check("Склад у мастера: нет «Добавить товар»", (await page.locator('a:has-text("Добавить товар")').count()) === 0);
check("Склад у мастера: нет себестоимости", (await page.locator("text=Себест.").count()) === 0);
await shot(page, "t9_inventory_master.png");

// прямое обращение к карточке товара — выкинет на / , а тот на /repairs
await page.goto(BASE + "/inventory/1");
await settle();
check("MASTER не может открыть карточку товара (редирект на /repairs)", new URL(page.url()).pathname === "/repairs", page.url());

// ---------- 10. Финальный скриншот кассы ----------
await page.click('nav >> text=Касса');
await page.waitForURL("**/pos");
await settle();
await shot(page, "t10_pos_master.png");

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log("\n===== ИТОГ =====");
console.log(`Пройдено: ${results.length - failed.length}/${results.length}`);
if (failed.length) {
  console.log("Провалены:");
  for (const f of failed) console.log("  -", f.name, f.extra);
  process.exit(1);
}
