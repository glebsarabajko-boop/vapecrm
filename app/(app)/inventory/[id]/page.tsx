import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { updateProductAction, restockAction } from "@/app/actions/inventory";
import { btnPrimary, Card, Field, inputClass, PageTitle } from "@/components/ui";

export default async function ProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const product = await db.product.findUnique({ where: { id: Number(id) } });
  if (!product) notFound();

  return (
    <div className="max-w-xl">
      <PageTitle right={<span className="text-sm text-zinc-400">Остаток: {product.qty} шт</span>}>
        {product.name}
      </PageTitle>

      <Card className="mb-5">
        <form action={updateProductAction} className="space-y-4">
          <input type="hidden" name="id" value={product.id} />
          <Field label="Название">
            <input name="name" defaultValue={product.name} className={inputClass} required />
          </Field>
          <Field label="Штрихкод">
            <input name="barcode" defaultValue={product.barcode ?? ""} className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Категория">
              <select name="category" className={inputClass} defaultValue={product.category}>
                <option value="GOODS">Товар на продажу</option>
                <option value="PART">Запчасть для ремонта</option>
              </select>
            </Field>
            <Field label="Модель подика">
              <input name="podModel" defaultValue={product.podModel ?? ""} className={inputClass} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Цена продажи, ₽">
              <input name="price" type="number" min="0" defaultValue={product.price} className={inputClass} />
            </Field>
            <Field label="Себестоимость, ₽">
              <input name="cost" type="number" min="0" defaultValue={product.cost} className={inputClass} />
            </Field>
          </div>
          <Field label="Минимальный остаток">
            <input name="minQty" type="number" min="0" defaultValue={product.minQty} className={inputClass} />
          </Field>
          <button type="submit" className={btnPrimary}>
            Сохранить
          </button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Поступление товара
        </h2>
        <form action={restockAction} className="flex items-end gap-3">
          <input type="hidden" name="id" value={product.id} />
          <Field label="Сколько штук привезли">
            <input name="add" type="number" min="1" defaultValue="10" className={inputClass} />
          </Field>
          <button type="submit" className={btnPrimary}>
            Прибавить
          </button>
        </form>
      </Card>
    </div>
  );
}
