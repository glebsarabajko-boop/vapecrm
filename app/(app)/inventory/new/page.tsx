import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { createProductAction } from "@/app/actions/inventory";
import { btnPrimary, Card, Field, inputClass, PageTitle } from "@/components/ui";

const ERRORS: Record<string, string> = {
  name: "Укажите название товара",
  barcode: "Такой штрихкод уже занят — придумайте другой или оставьте поле пустым",
};

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const { error } = await searchParams;

  return (
    <div className="max-w-xl">
      <PageTitle>Новый товар</PageTitle>

      {error && (
        <p className="mb-4 rounded-lg bg-red-950 px-4 py-2 text-sm text-red-300">
          {ERRORS[error] ?? "Ошибка сохранения"}
        </p>
      )}

      <Card>
        <form action={createProductAction} className="space-y-4">
          <Field label="Название">
            <input name="name" className={inputClass} required autoFocus />
          </Field>
          <Field label="Штрихкод (для сканера)">
            <input name="barcode" className={inputClass} placeholder="4600000000017" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Категория">
              <select name="category" className={inputClass} defaultValue="GOODS">
                <option value="GOODS">Товар на продажу</option>
                <option value="PART">Запчасть для ремонта</option>
              </select>
            </Field>
            <Field label="Модель подика (если подходит)">
              <input name="podModel" className={inputClass} placeholder="XROS" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Цена продажи, ₽">
              <input name="price" type="number" min="0" defaultValue="0" className={inputClass} />
            </Field>
            <Field label="Себестоимость, ₽">
              <input name="cost" type="number" min="0" defaultValue="0" className={inputClass} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Остаток, шт">
              <input name="qty" type="number" min="0" defaultValue="0" className={inputClass} />
            </Field>
            <Field label="Минимальный остаток (порог «мало»)">
              <input name="minQty" type="number" min="0" defaultValue="5" className={inputClass} />
            </Field>
          </div>
          <button type="submit" className={btnPrimary}>
            Сохранить
          </button>
        </form>
      </Card>
    </div>
  );
}
