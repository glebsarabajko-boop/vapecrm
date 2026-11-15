import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { saveCompatibilityAction } from "@/app/actions/compatibility";
import { formatMoney } from "@/lib/format";
import { btnGhost, Card, inputClass, PageTitle } from "@/components/ui";

export default async function CompatibilityPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  const groups = await db.compatibility.findMany({ orderBy: { model: "asc" } });
  const products = await db.product.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-5">
      <PageTitle>Совместимость картриджей</PageTitle>

      <p className="text-sm text-zinc-500">
        Подсказка для новичка-продавца: какие картриджи подходят к какой линейке подиков.
        Алиасы работают в поиске кассы — «xros mini» найдёт картриджи XROS.
      </p>

      <div className="space-y-4">
        {groups.map((g) => {
          const fitting = products.filter((p) => p.podModel === g.model);
          return (
            <Card key={g.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold text-zinc-100">{g.model}</h2>
                <div className="flex flex-wrap gap-1.5">
                  {g.aliases
                    .split(",")
                    .map((a) => a.trim())
                    .filter(Boolean)
                    .map((a) => (
                      <span
                        key={a}
                        className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-300"
                      >
                        {a}
                      </span>
                    ))}
                </div>
              </div>

              <div className="mt-3 space-y-1 text-sm">
                {fitting.length === 0 && (
                  <p className="text-zinc-500">Товаров с этой моделью в каталоге нет</p>
                )}
                {fitting.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3">
                    <span className="text-zinc-300">{p.name}</span>
                    <span className="text-xs text-zinc-500">
                      {formatMoney(p.price)} · остаток {p.qty} шт
                    </span>
                  </div>
                ))}
              </div>

              {isAdmin && (
                <form
                  action={saveCompatibilityAction}
                  className="mt-4 flex flex-wrap items-end gap-3 border-t border-zinc-800 pt-4"
                >
                  <input type="hidden" name="id" value={g.id} />
                  <input
                    name="model"
                    defaultValue={g.model}
                    className={`${inputClass} max-w-40`}
                    aria-label="Каноническая модель"
                  />
                  <input
                    name="aliases"
                    defaultValue={g.aliases}
                    placeholder="алиасы через запятую"
                    className={`${inputClass} max-w-sm`}
                    aria-label="Алиасы"
                  />
                  <button type="submit" className={btnGhost}>
                    Сохранить
                  </button>
                </form>
              )}
            </Card>
          );
        })}
      </div>

      {isAdmin && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Новая группа
          </h2>
          <form action={saveCompatibilityAction} className="flex flex-wrap items-end gap-3">
            <input name="model" placeholder="Модель, например Nova" className={`${inputClass} max-w-40`} />
            <input
              name="aliases"
              placeholder="алиасы через запятую"
              className={`${inputClass} max-w-sm`}
            />
            <button type="submit" className={btnGhost}>
              Добавить
            </button>
          </form>
        </Card>
      )}
    </div>
  );
}
