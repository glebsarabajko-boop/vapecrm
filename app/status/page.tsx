import Link from "next/link";
import { db } from "@/lib/db";
import { formatDateTime, formatMoney, orderNumber } from "@/lib/format";
import { parseOrderQuery } from "@/lib/codes";
import { REPAIR_STATUSES } from "@/lib/repairs";
import { btnPrimary, inputClass } from "@/components/ui";

// Публичная страница для клиента: статус ремонта по номеру с квитанции.
// Номер защищён коротким кодом: R-123-KX4P (код выдаёт мастерская).
// Без авторизации. Показываем только статус, устройство и цену — без личных данных.
export default async function StatusPage({
  searchParams,
}: {
  searchParams: Promise<{ n?: string }>;
}) {
  const { n = "" } = await searchParams;
  const query = n.trim();

  // формат «R-123-KX4P»: номер + обязательный код
  const parsed = parseOrderQuery(query);
  const order = parsed
    ? await db.repairOrder.findUnique({ where: { id: parsed.id } })
    : null;
  const found = Boolean(
    order && parsed && order.accessCode && order.accessCode === parsed.code
  );

  const searched = query.length > 0;
  const currentStep =
    found && order ? REPAIR_STATUSES.findIndex((s) => s.key === order.status) : -1;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <h1 className="text-center text-lg font-semibold text-emerald-400">VapeCRM</h1>
        <p className="mt-1 text-center text-xs text-zinc-500">Статус ремонта</p>

        <form action="/status" className="mt-6 flex gap-2">
          <input
            name="n"
            defaultValue={query}
            placeholder="Номер с квитанции, например R-3-KX4P"
            className={inputClass}
          />
          <button type="submit" className={btnPrimary}>
            Проверить
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-zinc-600">
          <Link href="/login" className="underline hover:text-zinc-400">
            Личный кабинет
          </Link>{" "}
          ·{" "}
          <Link href="/book" className="underline hover:text-zinc-400">
            записаться на ремонт
          </Link>
        </p>

        {searched && !found && (
          <p className="mt-5 rounded-xl bg-red-950 px-4 py-3 text-sm text-red-300">
            Заказ «{query}» не найден. Введи номер вместе с кодом — как написано на квитанции
            (например R-3-KX4P).
          </p>
        )}

        {found && order && (
          <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{orderNumber(order.id)}</span>
              <span className="text-xs text-zinc-600">код {order.accessCode}</span>
              <span className="text-xs text-zinc-500">
                принят {formatDateTime(order.createdAt)}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-300">{order.deviceModel}</p>

            <div className="mt-5 space-y-2.5">
              {REPAIR_STATUSES.map((s, i) => {
                const done = i < currentStep;
                const current = i === currentStep;
                return (
                  <div key={s.key} className="flex items-center gap-3 text-sm">
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                        current
                          ? "bg-emerald-400 ring-4 ring-emerald-400/20"
                          : done
                            ? "bg-emerald-600"
                            : "bg-zinc-700"
                      }`}
                    />
                    <span
                      className={
                        current
                          ? "font-medium text-emerald-300"
                          : done
                            ? "text-zinc-400"
                            : "text-zinc-600"
                      }
                    >
                      {s.label}
                    </span>
                    {current && (
                      <span className="ml-auto text-xs text-zinc-500">
                        обновлено {formatDateTime(order.updatedAt)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {order.price != null && (
              <div className="mt-5 flex justify-between border-t border-zinc-800 pt-3 text-sm">
                <span className="text-zinc-500">Стоимость</span>
                <span>{formatMoney(order.price)}</span>
              </div>
            )}

            <p className="mt-4 text-xs text-zinc-600">
              Вопросы по заказу — пиши или звони в мастерскую.{" "}
              <Link href="/login" className="underline hover:text-zinc-400">
                Личный кабинет
              </Link>{" "}
              ·{" "}
              <Link href="/book" className="underline hover:text-zinc-400">
                записаться на ремонт
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
