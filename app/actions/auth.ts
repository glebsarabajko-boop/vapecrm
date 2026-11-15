"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, destroySession, verifyPassword } from "@/lib/auth";
import { createClientSession, destroyClientSession, verifyClientLogin } from "@/lib/cabinet-auth";
import { normalizePhone } from "@/lib/format";

// Универсальный вход: сотрудник — логином, клиент — телефоном.
// Система сама определяет, кто есть кто, и заводит в нужную зону.
export async function loginAction(formData: FormData) {
  const login = String(formData.get("login") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  // 1. сотрудник по логину (isActive=false — уволен, вход закрыт)
  const user = await db.user.findUnique({ where: { login, isActive: true } });
  if (user) {
    if (!(await verifyPassword(password, user.passwordHash))) {
      redirect("/login?error=1");
    }
    await createSession(user.id);
    redirect("/");
  }

  // 2. клиент по телефону (логином может быть телефон в любом формате)
  const phone = normalizePhone(login);
  if (phone.length >= 7) {
    const client = await verifyClientLogin(phone, password);
    if (client) {
      await createClientSession(client.id);
      redirect("/my");
    }
  }

  redirect("/login?error=1");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function logoutClientAction() {
  await destroyClientSession();
  redirect("/login");
}
