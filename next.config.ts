import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Отключаем экспериментальные режимы Next 16 — обычное классическое поведение
  cacheComponents: false,
  typedRoutes: false,
  // Самодостаточная сборка для деплоя: server.js + минимальные node_modules
  output: "standalone",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
