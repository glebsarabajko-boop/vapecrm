"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  createClientSession,
  registerClientPassword,
  verifyClientLogin,
} from "@/lib/cabinet-auth";
import { normalizePhone } from "@/lib/format";

export async function registerClientAction(formData: FormData) {
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (phone.length < 7 || password.length < 6) {
    redirect("/cabinet/register?error=1");
  }

  const result = await registerClientPassword(phone, password);
  if (!result.ok) {
    redirect(`/cabinet/register?error=${result.error}`);
  }

  // имя из формы обновим, если клиент указал
  const client = name
    ? await db.client.update({ where: { id: result.client.id }, data: { name } })
    : result.client;

  await createClientSession(client.id);
  redirect("/my");
}

export async function loginClientAction(formData: FormData) {
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const password = String(formData.get("password") ?? "");

  const client = await verifyClientLogin(phone, password);
  if (!client) redirect("/cabinet/login?error=1");

  await createClientSession(client.id);
  redirect("/my");
}
