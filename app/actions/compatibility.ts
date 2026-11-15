"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// Сохранить группу совместимости: каноническая модель + алиасы через запятую
export async function saveCompatibilityAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const model = String(formData.get("model") ?? "").trim();
  const aliases = String(formData.get("aliases") ?? "").trim();
  if (!model) return;

  if (Number.isFinite(id) && id > 0) {
    await db.compatibility.update({ where: { id }, data: { model, aliases } });
  } else {
    await db.compatibility.upsert({
      where: { model },
      update: { aliases },
      create: { model, aliases },
    });
  }
  revalidatePath("/compatibility");
}
