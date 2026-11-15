import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { Card, PageTitle } from "@/components/ui";

export default async function PurchasePage() {
  await requireAdmin();

  const products = await db.product.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  // закупать нужно то, что упало до порога; рекомендация — добить до 2× порога
  const lines = products
    .filter((p) => p.qty <= p.minQty)
    .map((p) => ({ ...p, need: Math.max(0, p.minQty * 2 - p.qty) }))
    .filter((l) => l.need > 0)
    .sort((a, b) => a.qty / a.minQty - b.qty / b.minQty); // самые критичные сверху

  const total = lines.reduce((sum, l) => sum + l.need * l.cost, 0);

  return (
    <div className="space-y-5">
      <PageTitle>Закупка</PageTitle>

      <p className="text-sm text-zinc-500">
        Позиции, доехавшие до минимального порога. Рекомендация — добить запас до 2× порога.
        Товар привезли — сделай «поступление» на карточке товара, и позиция уйдёт из списка сама.
      </p>

      {lines.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-400">
            Всё в достатке — закупка не требуется.
          </p>
        </Card>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Товар</th>
                  <th className="px-4 py-3">Остаток</th>
                  <th className="px-4 py-3">Минимум</th>
                  <th className="px-4 py-3">Заказать</th>
                  <th className="px-4 py-3">Сумма</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {lines.map((l) => (
                  <tr key={l.id} className="hover:bg-zinc-900/60">
                    <td className="px-4 py-3">
                      <Link
                        href={`/inventory/${l.id}`}
                        className="text-emerald-300 hover:underline"
                      >
                        {l.name}
                      </Link>
                      {l.barcode && <div className="text-xs text-zinc-500">{l.barcode}</div>}
                      <div className="mt-1">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                            l.category === "PART"
                              ? "bg-sky-950 text-sky-300"
                              : "bg-zinc-800 text-zinc-300"
                          }`}
                        >
                          {l.category === "PART" ? "запчасть" : "товар"}
                        </span>
                        {l.podModel && <span className="ml-2 text-xs text-zinc-500">{l.podModel}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-red-400">{l.qty} шт</td>
                    <td className="px-4 py-3 text-zinc-400">{l.minQty} шт</td>
                    <td className="px-4 py-3 font-medium text-amber-300">{l.need} шт</td>
                    <td className="px-4 py-3 text-zinc-400">{formatMoney(l.need * l.cost)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-zinc-900/70 font-medium">
                <tr>
                  <td className="px-4 py-3">Позиций: {lines.length}</td>
                  <td colSpan={3} />
                  <td className="px-4 py-3 text-emerald-300">{formatMoney(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="text-xs text-zinc-600">
            Сумма посчитана по себестоимости — столько примерно потратишь на закупку.
          </p>
        </>
      )}
    </div>
  );
}
