"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

function toInt(value: FormDataEntryValue | null, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function productData(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const barcode = String(formData.get("barcode") ?? "").trim();
  const podModel = String(formData.get("podModel") ?? "").trim();
  return {
    name,
    barcode: barcode || null,
    category: String(formData.get("category") ?? "GOODS") === "PART" ? "PART" : "GOODS",
    podModel: podModel || null,
    price: Math.max(0, toInt(formData.get("price"))),
    cost: Math.max(0, toInt(formData.get("cost"))),
    minQty: Math.max(0, toInt(formData.get("minQty"), 5)),
  };
}

export async function createProductAction(formData: FormData) {
  await requireAdmin();
  const data = productData(formData);
  if (!data.name) redirect("/inventory/new?error=name");

  const qty = Math.max(0, toInt(formData.get("qty")));
  try {
    await db.product.create({ data: { ...data, qty } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      redirect("/inventory/new?error=barcode"); // штрихкод уже занят
    }
    throw e;
  }
  revalidatePath("/inventory");
  redirect("/inventory");
}

export async function updateProductAction(formData: FormData) {
  await requireAdmin();
  const id = toInt(formData.get("id"));
  await db.product.update({ where: { id }, data: productData(formData) });
  revalidatePath("/inventory");
  redirect("/inventory");
}

// Поступление товара на склад
export async function restockAction(formData: FormData) {
  await requireAdmin();
  const id = toInt(formData.get("id"));
  const add = toInt(formData.get("add"));
  if (add > 0) {
    await db.product.update({ where: { id }, data: { qty: { increment: add } } });
  }
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${id}`);
}
