// Форматирование и нормализация — общие для приложения и бота

// Все цены в приложении — целые белорусские рубли (BYN), копейки не хранятся
export function formatMoney(value: number | null | undefined) {
  if (value == null) return "—";
  return `${value.toLocaleString("ru-RU")} Br`;
}

export function formatDateTime(value: Date | string) {
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Приводим ввод к «национальному номеру без кода страны»:
// Беларусь — 9 цифр (291234567), Россия/Казахстан — 10 цифр (9161234567).
// Понимаем +375…, 375…, 8 029…, +7…, 8…
export function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("375") && digits.length === 12) return digits.slice(3); // +375 29 …
  if (digits.startsWith("80") && digits.length === 11) return digits.slice(2); // 8 025/029/033/044 …
  if (digits.startsWith("8") && digits.length === 10) return digits.slice(1); // 8 25/29/33/44 … (без 0)
  if ((digits.startsWith("7") || digits.startsWith("8")) && digits.length === 11) {
    return digits.slice(1); // +7 / 8 … (Россия/Казахстан)
  }
  return digits;
}

// «291234567» → «+375 29 123-45-67», «9161234567» → «+7 916 123-45-67»
export function formatPhone(phone: string) {
  if (phone.length === 9) {
    return `+375 ${phone.slice(0, 2)} ${phone.slice(2, 5)}-${phone.slice(5, 7)}-${phone.slice(7)}`;
  }
  if (phone.length === 10) {
    return `+7 ${phone.slice(0, 3)} ${phone.slice(3, 6)}-${phone.slice(6, 8)}-${phone.slice(8)}`;
  }
  return phone;
}

export function orderNumber(id: number) {
  return `R-${id}`;
}

export function saleNumber(id: number) {
  return `S-${id}`;
}
