import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatDateTime, formatMoney, formatPhone, orderNumber, saleNumber } from "@/lib/format";
import { statusBadgeClass, statusLabel } from "@/lib/repairs";
import { updateClientAction } from "@/app/actions/clients";
import { Badge, btnGhost, Card, Field, inputClass, PageTitle } from "@/components/ui";

export default async function ClientCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const clientId = Number(id);
  if (!Number.isFinite(clientId)) notFound();

  const client = await db.client.findUnique({
    where: { id: clientId },
    include: { repairs: true, sales: { include: { items: true } } },
  });
  if (!client) notFound();

  // Единый таймлайн: ремонты + покупки
  const events = [
    ...client.repairs.map((r) => ({
      key: `r${r.id}`,
      kind: "repair" as const,
      date: r.createdAt,
      title: `${orderNumber(r.id)} — ремонт ${r.deviceModel}`,
      status: r.status,
      amount: r.price,
      href: `/repairs/${r.id}`,
    })),
    ...client.sales.map((s) => ({
      key: `s${s.id}`,
      kind: "sale" as const,
      date: s.createdAt,
      title: `${saleNumber(s.id)} — покупка (${s.items.reduce((n, i) => n + i.qty, 0)} шт)`,
      status: null,
      amount: s.total,
      href: null,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-5">
      <PageTitle>{client.name}</PageTitle>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Телефон</dt>
              <dd>{formatPhone(client.phone)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Telegram-бот</dt>
              <dd className={client.telegramChatId ? "text-emerald-300" : "text-amber-300"}>
                {client.telegramChatId ? "подключён" : "не подключён (нужно /start боту)"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">В базе с</dt>
              <dd className="text-zinc-300">{formatDateTime(client.createdAt)}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Данные клиента
          </h2>
          <form action={updateClientAction} className="space-y-3">
            <input type="hidden" name="id" value={client.id} />
            <Field label="Имя">
              <input name="name" defaultValue={client.name} className={inputClass} required />
            </Field>
            <Field label="Телефон">
              <input name="phone" defaultValue={formatPhone(client.phone)} className={inputClass} required />
            </Field>
            <button type="submit" className={btnGhost}>
              Сохранить
            </button>
          </form>
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          История: ремонты и покупки
        </h2>

        {events.length === 0 && (
          <p className="text-sm text-zinc-500">Пока пусто — ни ремонтов, ни покупок</p>
        )}

        <ul className="space-y-3">
          {events.map((e) => (
            <li key={e.key} className="flex items-center gap-3 rounded-lg bg-zinc-900 px-4 py-3">
              <Badge
                className={
                  e.kind === "repair"
                    ? "bg-violet-950 text-violet-300"
                    : "bg-emerald-950 text-emerald-300"
                }
              >
                {e.kind === "repair" ? "ремонт" : "покупка"}
              </Badge>
              <div className="min-w-0 flex-1">
                {e.href ? (
                  <Link href={e.href} className="text-sm text-emerald-300 hover:underline">
                    {e.title}
                  </Link>
                ) : (
                  <span className="text-sm">{e.title}</span>
                )}
                {e.status && (
                  <Badge className={`ml-2 ${statusBadgeClass(e.status)}`}>{statusLabel(e.status)}</Badge>
                )}
              </div>
              <span className="text-xs text-zinc-500">{formatDateTime(e.date)}</span>
              <span className="w-24 text-right text-sm">{formatMoney(e.amount)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
