"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/format";

export async function updateClientAction(formData: FormData) {
  await requireUser();
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  if (!Number.isFinite(id) || !name || !phone) return;

  await db.client.update({ where: { id }, data: { name, phone } });
  revalidatePath(`/clients/${id}`);
  revalidatePath("/clients");
}
