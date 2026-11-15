import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { updateMasterPercentAction } from "@/app/actions/users";
import { formatDateTime, formatMoney, orderNumber } from "@/lib/format";
import {
  isMonthKey,
  monthKey,
  monthLabel,
  monthRange,
  repairMoney,
  shiftMonth,
} from "@/lib/payroll";
import { Badge, btnGhost, Card, inputClass, PageTitle } from "@/components/ui";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const { m } = await searchParams;
  const month = isMonthKey(m) ? m : monthKey(new Date());
  const range = monthRange(month);

  // выданные ремонты месяца (мастер видит только свои)
  const orders = await db.repairOrder.findMany({
    where: {
      status: "ISSUED",
      price: { not: null },
      issuedAt: range,
      ...(isAdmin ? {} : { masterId: user.id }),
    },
    include: { master: true, client: true, parts: true },
    orderBy: { issuedAt: "desc" },
  });

  const masters = isAdmin
    ? await db.user.findMany({ where: { role: "MASTER" }, orderBy: { name: "asc" } })
    : [];

  // сводка по мастерам
  type Acc = { name: string; count: number; revenue: number; partsCost: number; share: number };
  const summary = new Map<number, Acc>();
  for (const o of orders) {
    if (o.price == null || !o.master) continue;
    const acc = summary.get(o.master.id) ?? {
      name: o.master.name,
      count: 0,
      revenue: 0,
      partsCost: 0,
      share: 0,
    };
    const { partsCost, masterShare } = repairMoney(o.price, o.parts, o.master.masterPercent);
    acc.count += 1;
    acc.revenue += o.price;
    acc.partsCost += partsCost;
    acc.share += masterShare ?? 0;
    summary.set(o.master.id, acc);
  }
  const summaryList = [...summary.entries()].sort((a, b) => b[1].share - a[1].share);
  const totals = summaryList.reduce(
    (t, [, a]) => ({
      count: t.count + a.count,
      revenue: t.revenue + a.revenue,
      partsCost: t.partsCost + a.partsCost,
      share: t.share + a.share,
    }),
    { count: 0, revenue: 0, partsCost: 0, share: 0 }
  );

  return (
    <div className="space-y-5">
      <PageTitle>Зарплата</PageTitle>

      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/payroll?m=${shiftMonth(month, -1)}`} className={btnGhost}>
          ←
        </Link>
        <span className="text-sm font-medium text-zinc-200">{monthLabel(month)}</span>
        <Link href={`/payroll?m=${shiftMonth(month, 1)}`} className={btnGhost}>
          →
        </Link>
        <span className="text-xs text-zinc-500">
          по моменту выдачи ремонта · доля = процент от прибыли (цена − запчасти)
        </span>
      </div>

      {/* сводка по мастерам */}
      <div className="overflow-x-auto rounded-2xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Мастер</th>
              <th className="px-4 py-3">Заказов</th>
              <th className="px-4 py-3">Выручка</th>
              <th className="px-4 py-3">Запчасти</th>
              {isAdmin && <th className="px-4 py-3">Прибыль</th>}
              <th className="px-4 py-3">Доля мастера</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {summaryList.map(([masterId, a]) => (
              <tr key={masterId} className="hover:bg-zinc-900/60">
                <td className="px-4 py-3">{a.name}</td>
                <td className="px-4 py-3 text-zinc-300">{a.count}</td>
                <td className="px-4 py-3">{formatMoney(a.revenue)}</td>
                <td className="px-4 py-3 text-zinc-500">−{formatMoney(a.partsCost)}</td>
                {isAdmin && (
                  <td className="px-4 py-3 text-emerald-300">
                    {formatMoney(a.revenue - a.partsCost)}
                  </td>
                )}
                <td className="px-4 py-3 font-medium text-violet-300">{formatMoney(a.share)}</td>
              </tr>
            ))}
            {summaryList.length > 1 && (
              <tr className="bg-zinc-900/70 font-medium">
                <td className="px-4 py-3">Итого</td>
                <td className="px-4 py-3">{totals.count}</td>
                <td className="px-4 py-3">{formatMoney(totals.revenue)}</td>
                <td className="px-4 py-3 text-zinc-500">−{formatMoney(totals.partsCost)}</td>
                {isAdmin && (
                  <td className="px-4 py-3 text-emerald-300">
                    {formatMoney(totals.revenue - totals.partsCost)}
                  </td>
                )}
                <td className="px-4 py-3 text-violet-300">{formatMoney(totals.share)}</td>
              </tr>
            )}
          </tbody>
        </table>
        {summaryList.length === 0 && (
          <p className="p-6 text-center text-sm text-zinc-500">
            В {monthLabel(month).toLowerCase()} выданных ремонтов нет
          </p>
        )}
      </div>

      {/* выданные ремонты месяца */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Выданные ремонты за месяц
        </h2>
        {orders.length === 0 && <p className="text-sm text-zinc-500">Пусто</p>}
        <ul className="space-y-2">
          {orders.map((o) => {
            const money = repairMoney(o.price, o.parts, o.master?.masterPercent ?? null);
            return (
              <li
                key={o.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm"
              >
                <Link
                  href={`/repairs/${o.id}`}
                  className="font-medium text-emerald-300 hover:underline"
                >
                  {orderNumber(o.id)}
                </Link>
                <span className="text-zinc-300">{o.client.name}</span>
                <span className="text-zinc-500">{o.deviceModel}</span>
                {o.master && (
                  <Badge className="bg-violet-950 text-violet-300">
                    {o.master.name} · {o.master.masterPercent}%
                  </Badge>
                )}
                <span className="ml-auto text-xs text-zinc-500">
                  выдан {formatDateTime(o.issuedAt ?? o.updatedAt)}
                </span>
                <span className="w-24 text-right">{formatMoney(o.price)}</span>
                <span className="w-28 text-right font-medium text-violet-300">
                  {formatMoney(money.masterShare)}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* проценты мастеров — только админ */}
      {isAdmin && (
        <Card>
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Процент мастеров
          </h2>
          <p className="mb-4 text-xs text-zinc-500">
            Доля считается от прибыли с ремонта и применяется при пересчёте
          </p>
          <div className="space-y-3">
            {masters.map((mst) => (
              <form key={mst.id} action={updateMasterPercentAction} className="flex items-center gap-3">
                <input type="hidden" name="userId" value={mst.id} />
                <span className="w-48 text-sm">{mst.name}</span>
                <input
                  name="percent"
                  type="number"
                  min="0"
                  max="100"
                  defaultValue={mst.masterPercent}
                  className={`${inputClass} w-24`}
                />
                <span className="text-xs text-zinc-500">%</span>
                <button type="submit" className={btnGhost}>
                  Сохранить
                </button>
              </form>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
