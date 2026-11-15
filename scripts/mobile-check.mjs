// Проверка мобильной адаптации: ищем страницы с горизонтальным скроллом на ширине телефона.
// Запуск: node scripts/mobile-check.mjs (dev-сервер должен работать)
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const PAGES = [
  "/login", "/status", "/book",
  "/repairs", "/repairs/new", "/pos", "/inventory", "/inventory/new",
  "/clients", "/payroll", "/compatibility", "/purchase", "/staff",
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(20000);

await page.goto(BASE + "/login");
await page.fill('input[name="login"]', "admin");
await page.fill('input[name="password"]', "admin123");
await page.click('button:has-text("Войти")');
await page.waitForURL("**/repairs", { timeout: 10000 });

let bad = 0;
for (const path of PAGES) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const d = document.documentElement;
    const culprits = [];
    for (const el of document.querySelectorAll("*")) {
      const w = el.getBoundingClientRect().width;
      if (w > d.clientWidth + 1) {
        culprits.push({
          tag: el.tagName,
          cls: String(el.className).slice(0, 50),
          w: Math.round(w),
          text: (el.innerText || "").slice(0, 30).replace(/\n/g, " "),
        });
      }
    }
    // уникальные виновники верхнего уровня
    const seen = new Set();
    const top = culprits.filter((c) => {
      const k = c.tag + "|" + c.cls;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return {
      overflow: d.scrollWidth > d.clientWidth + 1,
      culprits: top.slice(0, 6),
    };
  });
  const mark = r.overflow ? "ПРОБЛЕМА" : "ok";
  if (r.overflow) bad++;
  console.log(`${mark}  ${path}`);
  if (r.overflow) {
    for (const c of r.culprits) console.log(`   · ${c.tag} w=${c.w} .${c.cls} «${c.text}»`);
  }
}
await browser.close();
console.log(bad === 0 ? "\nВСЁ АДАПТИВНО" : `\nстраниц с проблемами: ${bad}`);
