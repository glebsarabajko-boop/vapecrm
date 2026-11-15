import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";

const COOKIE_NAME = "session";
const SESSION_DAYS = 30;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

// Создать сессию и положить токен в httpOnly-cookie
export async function createSession(userId: number) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { id: token, userId, expiresAt } });
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

// Текущий пользователь или null (для страниц, экшенов и API-роутов).
// Уволенный сотрудник (isActive=false) теряет доступ даже с живой сессией.
export async function getCurrentUser() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: token },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  if (!session.user.isActive) return null;
  return session.user;
}

// Для страниц и экшенов: без сессии — на логин
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// Только для админских страниц и экшенов
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) await db.session.deleteMany({ where: { id: token } });
  jar.delete(COOKIE_NAME);
}
