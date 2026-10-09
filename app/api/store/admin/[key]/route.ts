import { NextResponse } from "next/server";
import { campaignCsv, getStoreByAdminKey, storeToQuote } from "@/lib/campaigns";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const c = await getStoreByAdminKey((await params).key);
  if (!c) return new Response("Hittades inte", { status: 404 });
  return new Response(campaignCsv(c), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="butik-ordrar.csv"`, "Cache-Control": "no-store" },
  });
}

/** The employer sends all staff orders to PACH as one quote. */
export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const c = await getStoreByAdminKey((await params).key);
  if (!c) return NextResponse.json({ error: "Hittades inte" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { phone?: string };
  const res = await storeToQuote(c, body);
  if (res.error) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ref: res.ref });
}
