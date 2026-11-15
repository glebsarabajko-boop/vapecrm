"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { createSaleAction } from "@/app/actions/sales";
import { formatMoney } from "@/lib/format";
import { btnPrimary, inputClass } from "@/components/ui";

type Product = {
  id: number;
  name: string;
  barcode: string | null;
  category: string;
  podModel: string | null;
  price: number;
  qty: number;
};

type CartLine = { product: Product; qty: number };

async function fetchResults(q: string): Promise<Product[]> {
  const res = await fetch(`/api/products?q=${encodeURIComponent(q)}`);
  const data = await res.json();
  return data.products ?? [];
}

export default function PosClient() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [cart, setCart] = useState<Record<number, CartLine>>({});
  const [clientPhone, setClientPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Живой поиск с небольшой задержкой
  useEffect(() => {
    const q = query.trim();
    const timer = setTimeout(async () => {
      setResults(await fetchResults(q));
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  function addToCart(product: Product) {
    if (product.qty <= 0) return;
    setCart((prev) => {
      const line = prev[product.id];
      const qty = Math.min((line?.qty ?? 0) + 1, product.qty);
      return { ...prev, [product.id]: { product, qty } };
    });
  }

  function setQty(productId: number, qty: number) {
    setCart((prev) => {
      const line = prev[productId];
      if (!line) return prev;
      const clamped = Math.max(0, Math.min(qty, line.product.qty));
      if (clamped === 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: { ...line, qty: clamped } };
    });
  }

  // Enter: точное совпадение по штрихкоду (сканер) либо единственный результат поиска
  async function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    // свежий запрос, чтобы не зависеть от задержки живого поиска
    const list = await fetchResults(q);
    const target = list.find((p) => p.barcode === q) ?? (list.length === 1 ? list[0] : null);

    if (target) {
      addToCart(target);
      setQuery("");
      setResults([]);
      setMessage(null);
      inputRef.current?.focus();
    } else {
      setMessage({ text: `Не найдено: «${q}» — уточни запрос`, ok: false });
    }
  }

  const lines = Object.values(cart);
  const total = lines.reduce((sum, l) => sum + l.product.price * l.qty, 0);

  async function checkout() {
    setBusy(true);
    setMessage(null);
    const res = await createSaleAction(
      lines.map((l) => ({ productId: l.product.id, qty: l.qty })),
      clientPhone
    );
    if (res.ok) {
      setMessage({
        text: `Продажа №S-${res.saleId} на ${formatMoney(res.total)} — остатки обновлены`,
        ok: true,
      });
      setCart({});
      setClientPhone("");
    } else {
      setMessage({ text: `Ошибка: ${res.error}`, ok: false });
    }
    setBusy(false);
    inputRef.current?.focus();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div>
        <input
          ref={inputRef}
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Сканер или поиск: штрихкод, название, модель (например «xros»)"
          className={`${inputClass} text-base`}
        />
        {message && (
          <p className={`mt-2 text-sm ${message.ok ? "text-emerald-300" : "text-red-400"}`}>
            {message.text}
          </p>
        )}

        <ul className="mt-4 space-y-2">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => addToCart(p)}
                disabled={p.qty <= 0}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-left transition-colors hover:border-emerald-600 disabled:opacity-40"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm text-zinc-100">{p.name}</div>
                  <div className="text-xs text-zinc-500">
                    {p.category === "PART" ? "запчасть" : "товар"}
                    {p.podModel ? ` · ${p.podModel}` : ""}
                    {p.barcode ? ` · ${p.barcode}` : ""}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm text-emerald-300">{formatMoney(p.price)}</div>
                  <div className={`text-xs ${p.qty <= 0 ? "text-red-400" : "text-zinc-500"}`}>
                    {p.qty <= 0 ? "нет в наличии" : `осталось ${p.qty}`}
                  </div>
                </div>
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-center text-sm text-zinc-500">
              Найденные товары появятся здесь
            </li>
          )}
        </ul>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Корзина</h2>

        {lines.length === 0 && (
          <p className="mt-4 text-sm text-zinc-500">
            Пусто — отсканируй штрихкод или выбери товар из списка
          </p>
        )}

        <ul className="mt-3 space-y-2">
          {lines.map((l) => (
            <li key={l.product.id} className="flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{l.product.name}</div>
                <div className="text-xs text-zinc-500">
                  {formatMoney(l.product.price)} × {l.qty}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setQty(l.product.id, l.qty - 1)}
                  className="h-7 w-7 rounded border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm">{l.qty}</span>
                <button
                  type="button"
                  onClick={() => setQty(l.product.id, l.qty + 1)}
                  className="h-7 w-7 rounded border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  +
                </button>
              </div>
              <div className="w-24 text-right text-sm">{formatMoney(l.product.price * l.qty)}</div>
            </li>
          ))}
        </ul>

        <input
          value={clientPhone}
          onChange={(e) => setClientPhone(e.target.value)}
          placeholder="Телефон клиента (необязательно)"
          className={`${inputClass} mt-4`}
        />

        <div className="mt-4 flex items-center justify-between border-t border-zinc-800 pt-4">
          <span className="text-sm text-zinc-400">Итого</span>
          <span className="text-lg font-semibold text-emerald-300">{formatMoney(total)}</span>
        </div>

        <button
          type="button"
          onClick={checkout}
          disabled={busy || lines.length === 0}
          className={`${btnPrimary} mt-3 w-full`}
        >
          {busy ? "Проводим…" : "Продать"}
        </button>
      </div>
    </div>
  );
}
