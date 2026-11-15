// Статусы ремонта и тексты уведомлений — общий источник для приложения и бота

export const REPAIR_STATUSES = [
  { key: "INTAKE", label: "Принят" },
  { key: "DIAGNOSTICS", label: "Диагностика" },
  { key: "WAITING_PARTS", label: "Ждёт запчасть" },
  { key: "IN_WORK", label: "В работе" },
  { key: "READY", label: "Готов" },
  { key: "ISSUED", label: "Выдан" },
] as const;

export type RepairStatus = (typeof REPAIR_STATUSES)[number]["key"];

export const REPAIR_STATUS_KEYS = REPAIR_STATUSES.map((s) => s.key) as RepairStatus[];

export function isRepairStatus(value: string): value is RepairStatus {
  return (REPAIR_STATUS_KEYS as string[]).includes(value);
}

export function statusLabel(key: string) {
  return REPAIR_STATUSES.find((s) => s.key === key)?.label ?? key;
}

export function statusBadgeClass(key: string) {
  switch (key) {
    case "INTAKE":
      return "bg-zinc-800 text-zinc-300";
    case "DIAGNOSTICS":
      return "bg-sky-950 text-sky-300";
    case "WAITING_PARTS":
      return "bg-amber-950 text-amber-300";
    case "IN_WORK":
      return "bg-violet-950 text-violet-300";
    case "READY":
      return "bg-emerald-950 text-emerald-300";
    case "ISSUED":
      return "bg-zinc-700/50 text-zinc-400";
    default:
      return "bg-zinc-800 text-zinc-300";
  }
}

// Текст уведомления клиенту при смене статуса (кладётся в очередь Notification)
export function repairNotifyText(status: string, deviceModel: string, orderId: number) {
  if (status === "READY") {
    return `Готово! Ваш ${deviceModel} отремонтирован (заказ R-${orderId}) — можно забирать. Ждём вас!`;
  }
  return `Заказ R-${orderId} (${deviceModel}) выдан. Спасибо, что выбираете нас!`;
}
