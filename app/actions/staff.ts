"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hashPassword, requireAdmin } from "@/lib/auth";

function toInt(value: FormDataEntryValue | null, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

// Добавить сотрудника (логин уникален, пароль минимум 6 символов)
export async function createStaffAction(formData: FormData) {
  await requireAdmin();
  const login = String(formData.get("login") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "MASTER") === "ADMIN" ? "ADMIN" : "MASTER";
  const password = String(formData.get("password") ?? "");

  if (!login || !name || password.length < 6) redirect("/staff?error=1");

  try {
    await db.user.create({
      data: { login, name, role, passwordHash: await hashPassword(password) },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      redirect("/staff?error=login");
    }
    throw e;
  }
  revalidatePath("/staff");
}

// Сменить пароль сотрудника
export async function changePasswordAction(formData: FormData) {
  await requireAdmin();
  const userId = toInt(formData.get("userId"));
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) redirect("/staff?error=short");
  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(password) },
  });
  revalidatePath("/staff");
}

// Включить/выключить доступ (увольнение: сессии сбрасываются)
export async function toggleActiveAction(formData: FormData) {
  await requireAdmin();
  const userId = toInt(formData.get("userId"));
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return;
  const isActive = !user.isActive;
  await db.user.update({ where: { id: userId }, data: { isActive } });
  if (!isActive) await db.session.deleteMany({ where: { userId } });
  revalidatePath("/staff");
}
