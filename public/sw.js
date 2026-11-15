// Минимальный service worker: нужен для установки PWA.
// Сознательно ничего не кешируем — все данные серверные, офлайн-режим не требуется.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {}); // passthrough: всегда сеть
