import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatPhone } from "@/lib/format";
import { Badge, btnPrimary, inputClass, PageTitle } from "@/components/ui";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireUser();
  const { q = "" } = await searchParams;

  const clients = await db.client.findMany({
    where: q
      ? { OR: [{ name: { contains: q } }, { phone: { contains: q.replace(/\D/g, "") } }] }
      : {},
    include: { repairs: { select: { id: true } }, sales: { select: { id: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageTitle>Клиенты</PageTitle>

      <form className="mb-4 flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Поиск: имя или телефон"
          className={`${inputClass} max-w-xs`}
        />
        <button type="submit" className={btnPrimary}>
          Найти
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Клиент</th>
              <th className="px-4 py-3">Телефон</th>
              <th className="px-4 py-3">Telegram</th>
              <th className="px-4 py-3">Ремонтов</th>
              <th className="px-4 py-3">Покупок</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {clients.map((c) => (
              <tr key={c.id} className="hover:bg-zinc-900/60">
                <td className="px-4 py-3">
                  <Link href={`/clients/${c.id}`} className="text-emerald-300 hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-300">{formatPhone(c.phone)}</td>
                <td className="px-4 py-3">
                  {c.telegramChatId ? (
                    <Badge className="bg-emerald-950 text-emerald-300">подключён</Badge>
                  ) : (
                    <Badge className="bg-zinc-800 text-zinc-400">нет</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-400">{c.repairs.length}</td>
                <td className="px-4 py-3 text-zinc-400">{c.sales.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {clients.length === 0 && (
          <p className="p-6 text-center text-sm text-zinc-500">
            Клиентов нет — они появятся при приёмке ремонтов
          </p>
        )}
      </div>
    </div>
  );
}
