import type { MetadataRoute } from "next";

// PWA-манифест: приложение можно «установить» на телефон/компьютер
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VapeCRM — мастерская и касса",
    short_name: "VapeCRM",
    description: "Учёт ремонтов, склада и продаж для мастерской",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
