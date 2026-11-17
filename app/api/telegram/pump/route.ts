// Ежедневная прокачка очереди уведомлений (Vercel Cron — см. vercel.json).
// Напоминания «пора сменить картридж» (через 14 дней) и «давно не забираете»
// (через 3 дня) создаются заранее — нужен таймер, чтобы бот о них вспомнил:
// сами они не сработают, пока клиент не напишет боту.
// Vercel Cron шлёт GET с Authorization: Bearer <CRON_SECRET>.
import { NextRequest } from "next/server";
import { pumpViaBot } from "@/lib/bot";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new Response("forbidden", { status: 403 });
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return Response.json({ ok: false, sent: 0, reason: "нет TELEGRAM_BOT_TOKEN" });
  }
  try {
    const sent = await pumpViaBot(token);
    return Response.json({ ok: true, sent });
  } catch (e) {
    console.error("[cron] pump:", e);
    return Response.json({ ok: false, sent: 0 });
  }
}
