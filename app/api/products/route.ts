import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// Поиск товаров для кассы: штрихкод, название, модель подика + алиасы совместимости.
// Ввод «xros mini» найдёт картриджи XROS через справочник совместимости.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const terms = q ? [q] : [];

  if (q) {
    const ql = q.toLowerCase();
    const groups = await db.compatibility.findMany();
    for (const g of groups) {
      const aliases = g.aliases
        .split(",")
        .map((a) => a.trim().toLowerCase())
        .filter((a) => a.length >= 3);
      const matched =
        g.model.toLowerCase().includes(ql) ||
        aliases.some((a) => a.includes(ql) || ql.includes(a));
      if (matched && !terms.some((t) => t.toLowerCase() === g.model.toLowerCase())) {
        terms.push(g.model); // алиас указывает на эту линейку — ищем и её
      }
    }
  }

  const products = await db.product.findMany({
    where: {
      isActive: true,
      ...(terms.length
        ? {
            OR: terms.flatMap((t) => [
              { name: { contains: t } },
              { barcode: { contains: t } },
              { podModel: { contains: t } },
            ]),
          }
        : {}),
    },
    orderBy: { name: "asc" },
    take: 20,
    select: {
      id: true,
      name: true,
      barcode: true,
      category: true,
      podModel: true,
      price: true,
      qty: true,
    },
  });

  return NextResponse.json({ products });
}
