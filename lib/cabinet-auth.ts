// Авторизация клиента личного кабинета: телефон = логин, пароль задаёт клиент.
// Отдельная cookie «client_session» — не конфликтует с сессиями сотрудников.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";

const COOKIE_NAME = "client_session";
const SESSION_DAYS = 30;

export async function hashClientPassword(password: string) {
  return bcrypt.hash(password, 10);
}

// Регистрация: телефон уже должен быть в базе (клиент записался/приносил устройство)
export async function registerClientPassword(phone: string, password: string) {
  const client = await db.client.findUnique({ where: { phone } });
  if (!client) return { ok: false as const, error: "not_found" };
  if (client.passwordHash) return { ok: false as const, error: "already_registered" };
  await db.client.update({
    where: { id: client.id },
    data: { passwordHash: await hashClientPassword(password) },
  });
  return { ok: true as const, client };
}

export async function verifyClientLogin(phone: string, password: string) {
  const client = await db.client.findUnique({ where: { phone } });
  if (!client || !client.passwordHash) return null;
  if (!(await bcrypt.compare(password, client.passwordHash))) return null;
  return client;
}

export async function createClientSession(clientId: number) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.clientSession.create({ data: { id: token, clientId, expiresAt } });
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

// Текущий клиент кабинета или null
export async function getCurrentClient() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await db.clientSession.findUnique({
    where: { id: token },
    include: { client: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.client;
}

export async function requireClient() {
  const client = await getCurrentClient();
  if (!client) redirect("/cabinet/login");
  return client;
}

export async function destroyClientSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) await db.clientSession.deleteMany({ where: { id: token } });
  jar.delete(COOKIE_NAME);
}
