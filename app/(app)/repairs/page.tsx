import Link from "next/link";
import AutoRefresh from "@/components/AutoRefresh";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatDateTime, formatMoney, formatPhone, orderNumber } from "@/lib/format";
import { REPAIR_STATUSES, isRepairStatus, statusBadgeClass, statusLabel } from "@/lib/repairs";
import { Badge, btnPrimary, inputClass, PageTitle } from "@/components/ui";

export default async function RepairsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireUser();
  const { status = "", q = "" } = await searchParams;
  const filter = isRepairStatus(status) ? status : null;
  const query = q.trim();

  // поиск: номер заказа, клиент (имя/телефон), модель устройства.
  // SQLite без регистронезависимости для кириллицы — ищем в трёх вариантах регистра
  const variants = query ? [...new Set([query, query.toLowerCase(), query.toUpperCase()])] : [];
  const digits = query.replace(/\D/g, "");

  const orders = await db.repairOrder.findMany({
    where: {
      ...(filter ? { status: filter } : {}),
      ...(variants.length
        ? {
            OR: [
              ...variants.flatMap((v) => [
                { deviceModel: { contains: v } },
                { client: { name: { contains: v } } },
              ]),
              ...(digits
                ? [
                    { client: { phone: { contains: digits } } },
                    { id: Number(digits) },
                  ]
                : []),
            ],
          }
        : {}),
    },
    include: { client: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <AutoRefresh intervalMs={20000} />
      <PageTitle
        right={
          <Link href="/repairs/new" className={btnPrimary}>
            Принять в ремонт
          </Link>
        }
      >
        Ремонты
      </PageTitle>

      <form className="mb-4 flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Поиск: номер, клиент, телефон, устройство"
          className={`${inputClass} max-w-sm`}
        />
        {filter && <input type="hidden" name="status" value={filter} />}
        <button type="submit" className={btnPrimary}>
          Найти
        </button>
        {query && (
          <Link href="/repairs" className="text-sm text-zinc-500 hover:text-zinc-300">
            сбросить
          </Link>
        )}
      </form>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/repairs"
          className={`rounded-full px-3 py-1.5 text-xs ${
            filter ? "bg-zinc-900 text-zinc-400 hover:bg-zinc-800" : "bg-emerald-600/20 text-emerald-300"
          }`}
        >
          Все
        </Link>
        {REPAIR_STATUSES.map((s) => (
          <Link
            key={s.key}
            href={`/repairs?status=${s.key}`}
            className={`rounded-full px-3 py-1.5 text-xs ${
              filter === s.key
                ? "bg-emerald-600/20 text-emerald-300"
                : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Заказ</th>
              <th className="px-4 py-3">Клиент</th>
              <th className="px-4 py-3">Устройство</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3">Цена</th>
              <th className="px-4 py-3">Обновлён</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-zinc-900/60">
                <td className="px-4 py-3">
                  <Link href={`/repairs/${o.id}`} className="font-medium text-emerald-300 hover:underline">
                    {orderNumber(o.id)}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div>{o.client.name}</div>
                  <div className="text-xs text-zinc-500">{formatPhone(o.client.phone)}</div>
                </td>
                <td className="px-4 py-3 text-zinc-300">{o.deviceModel}</td>
                <td className="px-4 py-3">
                  <Badge className={statusBadgeClass(o.status)}>{statusLabel(o.status)}</Badge>
                </td>
                <td className="px-4 py-3">{formatMoney(o.price)}</td>
                <td className="px-4 py-3 text-xs text-zinc-500">{formatDateTime(o.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && (
          <p className="p-6 text-center text-sm text-zinc-500">
            {query || filter ? "Ничего не найдено — попробуй изменить поиск" : "Заказов нет — примите первый ремонт"}
          </p>
        )}
      </div>
    </div>
  );
}
