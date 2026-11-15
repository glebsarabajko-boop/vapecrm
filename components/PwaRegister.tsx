"use client";

import { useEffect } from "react";

// Регистрирует service worker один раз после загрузки страницы
export default function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
