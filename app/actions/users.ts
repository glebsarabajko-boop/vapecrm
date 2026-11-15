"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

function toInt(value: FormDataEntryValue | null, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

// Процент мастера от прибыли с ремонта (0–100)
export async function updateMasterPercentAction(formData: FormData) {
  await requireAdmin();
  const userId = toInt(formData.get("userId"));
  const percent = Math.min(100, Math.max(0, toInt(formData.get("percent"))));
  await db.user.update({ where: { id: userId }, data: { masterPercent: percent } });
  revalidatePath("/payroll");
}
