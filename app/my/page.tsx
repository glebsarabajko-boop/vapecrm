import Link from "next/link";
import { db } from "@/lib/db";
import { requireClient } from "@/lib/cabinet-auth";
import { formatDateTime, formatMoney, formatPhone, orderNumber, saleNumber } from "@/lib/format";
import { statusBadgeClass, statusLabel } from "@/lib/repairs";
import { Badge, btnPrimary, Card, PageTitle } from "@/components/ui";

// Личный кабинет клиента: свои ремонты и покупки, ссылка на запись
export default async function MyPage() {
  const client = await requireClient();

  const [repairs, sales] = await Promise.all([
    db.repairOrder.findMany({ where: { clientId: client.id }, orderBy: { createdAt: "desc" } }),
    db.sale.findMany({ where: { clientId: client.id }, orderBy: { createdAt: "desc" }, include: { items: true } }),
  ]);

  const events = [
    ...repairs.map((r) => ({
      kind: "repair" as const,
      date: r.createdAt,
      title: `Ремонт ${r.deviceModel}`,
      status: r.status,
      href: `/status?n=R-${r.id}-${r.accessCode ?? ""}`,
      amount: r.price,
    })),
    ...sales.map((s) => ({
      kind: "sale" as const,
      date: s.createdAt,
      title: `Покупка (${s.items.reduce((n, i) => n + i.qty, 0)} шт)`,
      status: null,
      href: null,
      amount: s.total,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-5">
      <PageTitle
        right={
          <Link href="/book" className={btnPrimary}>
            Записаться на ремонт
          </Link>
        }
      >
        Мои заказы
      </PageTitle>

      <Card>
        <p className="text-sm text-zinc-400">
          <span className="text-zinc-500">Телефон:</span> {formatPhone(client.phone)}
          {" · "}
          {client.telegramChatId ? (
            <span className="text-emerald-300">Telegram подключён — пришлём уведомления</span>
          ) : (
            <span className="text-amber-300">
              Telegram не подключён: напиши боту /start и свой номер
            </span>
          )}
        </p>
      </Card>

      {events.length === 0 && (
        <Card>
          <p className="text-sm text-zinc-400">
            Пока пусто — запишись на ремонт или купи что-нибудь в кассе.
          </p>
        </Card>
      )}

      <div className="space-y-3">
        {events.map((e) => (
          <Card key={`${e.kind}-${new Date(e.date).getTime()}`} className="!p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Badge
                className={
                  e.kind === "repair"
                    ? "bg-violet-950 text-violet-300"
                    : "bg-emerald-950 text-emerald-300"
                }
              >
                {e.kind === "repair" ? "ремонт" : "покупка"}
              </Badge>
              {e.href ? (
                <Link href={e.href} className="text-sm text-emerald-300 hover:underline">
                  {e.title}
                </Link>
              ) : (
                <span className="text-sm">{e.title}</span>
              )}
              {e.status && (
                <Badge className={statusBadgeClass(e.status)}>{statusLabel(e.status)}</Badge>
              )}
              <span className="ml-auto text-xs text-zinc-500">{formatDateTime(e.date)}</span>
              <span className="w-24 text-right text-sm">{formatMoney(e.amount)}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
