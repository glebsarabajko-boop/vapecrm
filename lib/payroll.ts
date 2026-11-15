// Расчёты зарплаты мастера — общие для страницы «Зарплата» и карточки ремонта

type PartLike = { cost: number; qty: number };

export function partsCostOf(parts: PartLike[]) {
  return parts.reduce((sum, p) => sum + p.cost * p.qty, 0);
}

// Прибыль = цена для клиента − себестоимость запчастей.
// Доля мастера = процент от прибыли (округляем до рубля, при минусе — 0).
export function repairMoney(price: number | null, parts: PartLike[], masterPercent: number | null) {
  const partsCost = partsCostOf(parts);
  const margin = price == null ? null : price - partsCost;
  const masterShare =
    margin != null && masterPercent != null
      ? Math.max(0, Math.round((margin * masterPercent) / 100))
      : null;
  const shopShare = margin != null && masterShare != null ? margin - masterShare : null;
  return { partsCost, margin, masterShare, shopShare };
}

// ----- месяцы: ключ «YYYY-MM» -----
export function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function isMonthKey(s: string | undefined | null): s is string {
  return !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

export function monthRange(key: string) {
  const [y, m] = key.split("-").map(Number);
  return { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
}

export function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleString("ru-RU", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function shiftMonth(key: string, delta: number) {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}
