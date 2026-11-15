import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatDateTime, formatMoney, formatPhone, orderNumber } from "@/lib/format";
import { repairMoney } from "@/lib/payroll";
import { REPAIR_STATUSES, statusBadgeClass, statusLabel } from "@/lib/repairs";
import {
  addPartAction,
  removePartAction,
  setMasterAction,
  setPriceAction,
  setStatusAction,
} from "@/app/actions/repairs";
import { Badge, btnDanger, btnGhost, btnPrimary, Card, Field, inputClass } from "@/components/ui";

export default async function RepairCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const { id } = await params;
  const { error } = await searchParams;

  const orderId = Number(id);
  if (!Number.isFinite(orderId)) notFound();

  const order = await db.repairOrder.findUnique({
    where: { id: orderId },
    include: {
      client: true,
      master: true,
      parts: { include: { product: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();

  const masters = await db.user.findMany({ where: { role: "MASTER" } });
  const partProducts = await db.product.findMany({
    where: { category: "PART", isActive: true, qty: { gt: 0 } },
    orderBy: { name: "asc" },
  });

  const money = repairMoney(order.price, order.parts, order.master?.masterPercent ?? null);
  const telegramConnected = Boolean(order.client.telegramChatId);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{orderNumber(order.id)}</h1>
        <Badge className={statusBadgeClass(order.status)}>{statusLabel(order.status)}</Badge>
        <span className="text-sm text-zinc-500">создан {formatDateTime(order.createdAt)}</span>
        <Link href={`/repairs/${order.id}/label`} className={`${btnGhost} ml-auto`}>
          Этикетка с QR
        </Link>
      </div>

      {error && (
        <p className="rounded-lg bg-red-950 px-4 py-2 text-sm text-red-300">{error}</p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Информация о заказе */}
        <Card>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Клиент</dt>
              <dd>
                <Link href={`/clients/${order.clientId}`} className="text-emerald-300 hover:underline">
                  {order.client.name}
                </Link>
                <span className="ml-2 text-zinc-400">{formatPhone(order.client.phone)}</span>
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Устройство</dt>
              <dd>{order.deviceModel}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Проблема</dt>
              <dd className="max-w-[60%] text-right text-zinc-300">{order.problem || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Обновлён</dt>
              <dd className="text-zinc-300">{formatDateTime(order.updatedAt)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Telegram</dt>
              <dd className={telegramConnected ? "text-emerald-300" : "text-amber-300"}>
                {telegramConnected
                  ? "подключён — клиент получит уведомление"
                  : "не подключён (клиенту нужно написать боту /start)"}
              </dd>
            </div>
            {order.preferredAt && (
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Клиент хочет прийти</dt>
                <dd className="text-amber-300">{formatDateTime(order.preferredAt)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Статус клиенту</dt>
              <dd className="text-zinc-300">
                {order.accessCode ? (
                  <>
                    <span className="text-zinc-100">
                      /status?n={orderNumber(order.id)}-{order.accessCode}
                    </span>{" "}
                    — отправь клиенту ссылку
                  </>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>

          <form action={setMasterAction} className="mt-4 flex items-end gap-3 border-t border-zinc-800 pt-4">
            <input type="hidden" name="orderId" value={order.id} />
            <Field label="Мастер">
              <select name="masterId" defaultValue={order.masterId ?? ""} className={inputClass}>
                <option value="">— не назначен —</option>
                {masters.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
            <button type="submit" className={btnGhost}>
              Назначить
            </button>
          </form>
          {isAdmin && order.master && (
            <p className="mt-2 text-xs text-zinc-500">
              Процент {order.master.name}: {order.master.masterPercent}% — меняется на странице
              «Зарплата»
            </p>
          )}
        </Card>

        {/* Статусы и цена */}
        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Статус ремонта
          </h2>
          <div className="flex flex-wrap gap-2">
            {REPAIR_STATUSES.map((s) => (
              <form action={setStatusAction} key={s.key}>
                <input type="hidden" name="orderId" value={order.id} />
                <button
                  type="submit"
                  name="status"
                  value={s.key}
                  disabled={s.key === order.status}
                  className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                    s.key === order.status
                      ? statusBadgeClass(s.key)
                      : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  }`}
                >
                  {s.label}
                </button>
              </form>
            ))}
          </div>

          <form action={setPriceAction} className="mt-5 flex items-end gap-3 border-t border-zinc-800 pt-4">
            <input type="hidden" name="orderId" value={order.id} />
            <Field label="Цена для клиента, ₽">
              <input
                name="price"
                type="number"
                min="0"
                defaultValue={order.price ?? ""}
                className={inputClass}
                placeholder="например 1500"
              />
            </Field>
            <button type="submit" className={btnGhost}>
              Сохранить
            </button>
          </form>
        </Card>
      </div>

      {/* Запчасти */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Запчасти
        </h2>

        {order.parts.length === 0 ? (
          <p className="text-sm text-zinc-500">Запчасти не списаны</p>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-zinc-800">
              {order.parts.map((part) => (
                <tr key={part.id}>
                  <td className="py-2">{part.product.name}</td>
                  <td className="w-20 py-2 text-center text-zinc-400">× {part.qty}</td>
                  {isAdmin && <td className="w-28 py-2 text-right text-zinc-500">{formatMoney(part.cost * part.qty)}</td>}
                  <td className="w-24 py-2 text-right">
                    <form action={removePartAction}>
                      <input type="hidden" name="partId" value={part.id} />
                      <button type="submit" className={btnDanger}>
                        вернуть
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* деньги: админ видит всё, мастер — только свою долю */}
        {isAdmin && (
          <div className="mt-4 space-y-1.5 rounded-xl bg-zinc-900 px-4 py-3 text-sm">
            {order.price == null ? (
              <p className="text-zinc-500">
                Цена ещё не указана — прибыль и доля мастера посчитаются автоматически
              </p>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Цена для клиента</span>
                  <span>{formatMoney(order.price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Запчасти (себестоимость)</span>
                  <span>−{formatMoney(money.partsCost)}</span>
                </div>
                <div className="flex justify-between border-t border-zinc-800 pt-1.5">
                  <span className="text-zinc-400">Прибыль с ремонта</span>
                  <span className="text-emerald-300">{formatMoney(money.margin)}</span>
                </div>
                {order.master ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">
                        Доля мастера — {order.master.name} ({order.master.masterPercent}%)
                      </span>
                      <span className="text-violet-300">{formatMoney(money.masterShare)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Остаётся магазину</span>
                      <span>{formatMoney(money.shopShare)}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-amber-300">
                    Мастер не назначен — доля не начисляется
                  </p>
                )}
              </>
            )}
          </div>
        )}
        {!isAdmin && user.id === order.masterId && money.masterShare != null && (
          <div className="mt-4 flex justify-between rounded-xl bg-zinc-900 px-4 py-3 text-sm">
            <span className="text-zinc-500">
              Твоя доля ({order.master?.masterPercent}%)
            </span>
            <span className="font-medium text-violet-300">{formatMoney(money.masterShare)}</span>
          </div>
        )}

        <form action={addPartAction} className="mt-4 flex items-end gap-3 border-t border-zinc-800 pt-4">
          <input type="hidden" name="orderId" value={order.id} />
          <Field label="Запчасть со склада">
            <select name="productId" className={`${inputClass} min-w-64`} required>
              {partProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (осталось {p.qty})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Количество">
            <input name="qty" type="number" min="1" defaultValue="1" className={`${inputClass} w-24`} />
          </Field>
          <button type="submit" className={btnPrimary}>
            Списать
          </button>
        </form>
      </Card>

      <Link href="/repairs" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← ко всем ремонтам
      </Link>
    </div>
  );
}
