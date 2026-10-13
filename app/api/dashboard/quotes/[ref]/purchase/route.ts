import { NextResponse } from "next/server";
import { applyPoAction, type PoAction, purchaseOrdersFor } from "@/lib/purchasing";
import { getQuote } from "@/lib/quotes";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const q = await getQuote((await params).ref);
  if (!q) return NextResponse.json({ error: "Ordern hittades inte" }, { status: 404 });
  return NextResponse.json({ orders: await purchaseOrdersFor(q) }, { headers: { "Cache-Control": "no-store" } });
}

/** { action: "send" | "sendAll" | "advance", number?, tracking? } – e-mail is simulated, NWG gets it in its portal. */
export async function POST(req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const body = (await req.json().catch(() => ({}))) as PoAction;
  if (!["send", "sendAll", "advance"].includes(body.action)) return NextResponse.json({ error: "Okänd åtgärd" }, { status: 400 });
  const res = await applyPoAction((await params).ref, body);
  if (res.error) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ orders: res.orders });
}
