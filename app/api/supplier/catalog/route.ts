import { NextResponse } from "next/server";
import { addContent, catalog, priceList, savePrices, saveStock } from "@/lib/supplier";

export const runtime = "nodejs";

export async function GET() {
  const [items, prices] = await Promise.all([catalog(), priceList()]);
  return NextResponse.json({ items, prices });
}

/** Stock levels (one SKU or a whole CSV import) and price-list changes. */
export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { stock?: { sku: string; stock: number }[]; prices?: Parameters<typeof savePrices>[0] };
  let changed = 0;
  if (Array.isArray(body.stock)) changed = await saveStock(body.stock.slice(0, 5000).map((r) => ({ sku: String(r.sku ?? "").trim(), stock: Number(r.stock) })));
  if (body.prices && typeof body.prices === "object") await savePrices(body.prices);
  const [items, prices] = await Promise.all([catalog(), priceList()]);
  return NextResponse.json({ items, prices, changed });
}

/** New product content (lifestyle image, size guide) for PACH to review. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { productId?: string; image?: string; note?: string };
  const res = await addContent(String(body.productId ?? ""), String(body.image ?? ""), body.note);
  if (res.error) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ items: await catalog() });
}
