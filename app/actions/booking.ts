"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/format";
import { generateAccessCode } from "@/lib/codes";
import { hashClientPassword } from "@/lib/cabinet-auth";

// Публичная запись на ремонт с сайта /book — без авторизации.
// Antispam-ловушка: скрытое поле «website» человек не заполняет, а бот заполняет.
export async function createBookingAction(formData: FormData) {
  const website = String(formData.get("website") ?? "").trim();
  if (website !== "") redirect("/book");

  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const name = String(formData.get("name") ?? "").trim();
  const deviceModel = String(formData.get("deviceModel") ?? "").trim();
  const problem = String(formData.get("problem") ?? "").trim();

  // без нормализованного номера (7+ цифр) и модели заявку не принимаем
  if (phone.length < 7 || !deviceModel) redirect("/book?error=1");

  // желаемое время визита — необязательное поле с сайта
  const preferredRaw = String(formData.get("preferredAt") ?? "").trim();
  const preferredAt = preferredRaw && !Number.isNaN(new Date(preferredRaw).getTime())
    ? new Date(preferredRaw)
    : null;

  // пароль кабинета: задаётся при записи, если клиент его ещё не имеет
  const password = String(formData.get("password") ?? "");
  const passwordHash =
    password.length >= 6 ? await hashClientPassword(password) : null;

  const order = await db.$transaction(async (tx) => {
    let client = await tx.client.findUnique({ where: { phone } });
    if (!client) {
      client = await tx.client.create({ data: { phone, name: name || "Без имени" } });
    }
    // существующий пароль не перезаписываем — только задаём впервые
    if (passwordHash && !client.passwordHash) {
      await tx.client.update({
        where: { id: client.id },
        data: { passwordHash },
      });
    }
    return tx.repairOrder.create({
      data: {
        clientId: client.id,
        deviceModel,
        problem: problem || "Запись с сайта — детали уточним при звонке",
        status: "INTAKE",
        accessCode: generateAccessCode(),
        ...(preferredAt ? { preferredAt } : {}),
      },
    });
  });

  redirect(`/book?ok=${order.id}-${order.accessCode}&phone=${encodeURIComponent(phone)}`);
}
