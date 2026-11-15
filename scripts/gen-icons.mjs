// Генерация PWA-иконок из SVG. Запуск: node scripts/gen-icons.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const svg = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="96" fill="#09090b"/>
  <rect x="24" y="24" width="464" height="464" rx="80" fill="none" stroke="#10b981" stroke-width="16"/>
  <text x="256" y="310" text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
        font-size="190" font-weight="bold" fill="#34d399">VC</text>
</svg>`;

await mkdir("public/icons", { recursive: true });
await sharp(Buffer.from(svg)).png().toFile("public/icons/icon-512.png");
await sharp(Buffer.from(svg)).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(Buffer.from(svg)).resize(180, 180).png().toFile("public/icons/icon-180.png");
console.log("иконки созданы: public/icons/icon-{512,192,180}.png");
