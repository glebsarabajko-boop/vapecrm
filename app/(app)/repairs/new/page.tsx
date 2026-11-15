import { createRepairAction } from "@/app/actions/repairs";
import { btnPrimary, Card, Field, inputClass, PageTitle } from "@/components/ui";

export default async function NewRepairPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="max-w-xl">
      <PageTitle>Приёмка в ремонт</PageTitle>

      {error && (
        <p className="mb-4 rounded-lg bg-red-950 px-4 py-2 text-sm text-red-300">
          Укажите телефон клиента и модель устройства
        </p>
      )}

      <Card>
        <form action={createRepairAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Телефон клиента">
              <input
                name="phone"
                className={inputClass}
                placeholder="+375 25/29/33/44 123-45-67 или +7 916 123-45-67"
                required
                autoFocus
              />
            </Field>
            <Field label="Имя клиента">
              <input name="name" className={inputClass} placeholder="Иван" />
            </Field>
          </div>
          <p className="text-xs text-zinc-500">
            Если клиент с таким телефоном уже есть — используем его карточку
          </p>
          <Field label="Модель устройства">
            <input name="deviceModel" className={inputClass} placeholder="Vaporesso XROS 3" required />
          </Field>
          <Field label="Проблема со слов клиента">
            <textarea
              name="problem"
              rows={3}
              className={inputClass}
              placeholder="Не заряжается, не видит кабель"
            />
          </Field>
          <button type="submit" className={btnPrimary}>
            Принять в ремонт
          </button>
        </form>
      </Card>
    </div>
  );
}
