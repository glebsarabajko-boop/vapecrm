import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { orderNumber } from "@/lib/format";
import { btnGhost, btnPrimary } from "@/components/ui";
import PrintButton from "./PrintButton";

// Термоэтикетка 58×40 мм: QR ведёт на публичную страницу статуса заказа.
// Клеится на устройство при приёмке, чтобы не путать одинаковые корпуса.
export default async function LabelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const order = await db.repairOrder.findUnique({ where: { id: Number(id) } });
  if (!order) notFound();

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const statusUrl = `${proto}://${host}/status?n=${orderNumber(order.id)}-${order.accessCode ?? ""}`;
  const qr = await QRCode.toDataURL(statusUrl, { width: 320, margin: 1 });

  return (
    <div className="mx-auto max-w-md space-y-5 py-6">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .label, .label * { visibility: visible; }
          .label { position: fixed; left: 0; top: 0; margin: 0; }
          @page { size: 58mm 40mm; margin: 0; }
        }
      `}</style>

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Этикетка заказа</h1>
        <PrintButton />
      </div>
      <p className="text-sm text-zinc-500">
        Наклейка 58×40 мм: QR ведёт на страницу статуса этого заказа. Печатай на термо-принтере
        или обычном — диалог печати подстроится под размер.
      </p>

      <div
        className="label flex items-center gap-2 bg-white p-2 text-black"
        style={{ width: "58mm", height: "40mm" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="QR статуса заказа" className="h-full" />
        <div className="min-w-0">
          <div className="text-base font-bold leading-tight">
            {orderNumber(order.id)}
            {order.accessCode ? `-${order.accessCode}` : ""}
          </div>
          <div className="text-[10px] font-medium leading-tight">{order.deviceModel}</div>
          <div className="mt-1 text-[8px] leading-tight text-black/70">
            Статус ремонта — сканируй QR
          </div>
        </div>
      </div>

      <div className="text-center text-xs break-all text-zinc-500">{statusUrl}</div>

      <div className="text-center">
        <Link href={`/repairs/${order.id}`} className={btnGhost}>
          ← к карточке заказа
        </Link>
      </div>
    </div>
  );
}
