"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Автообновление страницы: новые заявки из бота и записи с сайта
// появляются в списке сами, без F5
export default function AutoRefresh({ intervalMs = 20000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);
  return null;
}
