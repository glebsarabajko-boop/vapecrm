import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { Badge, btnPrimary, inputClass, PageTitle } from "@/components/ui";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string }>;
}) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const { q = "", cat = "" } = await searchParams;

  // плашка «требуется закупка» — считаем по всем товарам, не по отфильтрованным
  const stockLevels = await db.product.findMany({
    where: { isActive: true },
    select: { qty: true, minQty: true, cost: true },
  });
  const lowItems = stockLevels.filter((p) => p.qty <= p.minQty);
  const lowBudget = lowItems.reduce(
    (sum, p) => sum + Math.max(0, p.minQty * 2 - p.qty) * p.cost,
    0
  );

  const products = await db.product.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { barcode: { contains: q } },
              { podModel: { contains: q } },
            ],
          }
        : {}),
      ...(cat === "PART" || cat === "GOODS" ? { category: cat } : {}),
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return (
    <div>
      <PageTitle
        right={
          isAdmin ? (
            <Link href="/inventory/new" className={btnPrimary}>
              Добавить товар
            </Link>
          ) : undefined
        }
      >
        Склад
      </PageTitle>

      {isAdmin && lowItems.length > 0 && (
        <Link
          href="/purchase"
          className="mb-4 flex items-center justify-between rounded-xl border border-amber-900 bg-amber-950/60 px-4 py-3 text-sm text-amber-200 transition-colors hover:border-amber-700"
        >
          <span>
            Требуется закупка: {lowItems.length} поз. · {formatMoney(lowBudget)}
          </span>
          <span className="text-xs">открыть список →</span>
        </Link>
      )}

      <form className="mb-4 flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Поиск: название, штрихкод, модель"
          className={`${inputClass} max-w-xs`}
        />
        <select name="cat" defaultValue={cat} className={`${inputClass} max-w-48`}>
          <option value="">Все категории</option>
          <option value="GOODS">Товары на продажу</option>
          <option value="PART">Запчасти</option>
        </select>
        <button type="submit" className={btnPrimary}>
          Найти
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Товар</th>
              <th className="px-4 py-3">Модель</th>
              {isAdmin && <th className="px-4 py-3">Себест.</th>}
              <th className="px-4 py-3">Цена</th>
              <th className="px-4 py-3">Остаток</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {products.map((p) => {
              const low = p.qty <= p.minQty;
              return (
                <tr key={p.id} className="hover:bg-zinc-900/60">
                  <td className="px-4 py-3">
                    {isAdmin ? (
                      <Link
                        href={`/inventory/${p.id}`}
                        className="text-emerald-300 hover:underline"
                      >
                        {p.name}
                      </Link>
                    ) : (
                      p.name
                    )}
                    {p.barcode && <div className="text-xs text-zinc-500">{p.barcode}</div>}
                    {low && (
                      <Badge className="mt-1 bg-red-950 text-red-300">мало осталось</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    <Badge className={p.category === "PART" ? "bg-sky-950 text-sky-300" : "bg-zinc-800 text-zinc-300"}>
                      {p.category === "PART" ? "запчасть" : "товар"}
                    </Badge>
                    {p.podModel && <span className="ml-2">{p.podModel}</span>}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-zinc-400">{formatMoney(p.cost)}</td>
                  )}
                  <td className="px-4 py-3">{formatMoney(p.price)}</td>
                  <td className={`px-4 py-3 font-medium ${low ? "text-red-400" : "text-zinc-200"}`}>
                    {p.qty} шт
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {products.length === 0 && (
          <p className="p-6 text-center text-sm text-zinc-500">Ничего не найдено</p>
        )}
      </div>
    </div>
  );
}
