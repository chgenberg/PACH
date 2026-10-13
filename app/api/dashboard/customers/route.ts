import { NextResponse } from "next/server";
import { listCustomers, sellerReorder } from "@/lib/customers";
import { isRef } from "@/lib/quotes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ customers: await listCustomers() });
}

/** { reorder: ref } – a new offer draft from an earlier order, opened in the builder. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { reorder?: unknown };
  if (!isRef(body.reorder)) return NextResponse.json({ error: "Ogiltig offert" }, { status: 400 });
  const res = await sellerReorder(body.reorder);
  if (res.error) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ref: res.ref });
}
