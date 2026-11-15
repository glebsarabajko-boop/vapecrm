// Код публичной проверки статуса: R-123-KX4P.
// Алфавит без похожих символов (0/O, 1/I), чтобы клиент не путал.
import { orderNumber } from "./format.ts";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateAccessCode(length = 5) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

// Полный номер для клиента: R-123-KX4P
export function publicOrderNumber(id: number, accessCode: string | null) {
  return accessCode ? `${orderNumber(id)}-${accessCode}` : orderNumber(id);
}

// Разбор запроса клиента «R-123-KX4P» / «r123-kx4p» → { id, code }.
// Код обязателен — без него заказ не открывается (защита от перебора).
// Общий для веб-страницы статуса и бота.
export function parseOrderQuery(raw: string): { id: number; code: string } | null {
  const match = raw.trim().toUpperCase().replace(/\s+/g, "").match(/^R-?(\d+)-([A-Z0-9]{4,8})$/);
  if (!match) return null;
  return { id: Number(match[1]), code: match[2] };
}
