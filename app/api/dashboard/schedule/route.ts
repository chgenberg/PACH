import { NextResponse } from "next/server";
import { poContext, purchaseOrdersFor } from "@/lib/purchasing";
import { listQuotes } from "@/lib/quotes";
import { type Schedule, scheduleFor } from "@/lib/schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The critical path of every order with a date. ?now=YYYY-MM-DD shows how the warnings look on another day. */
export async function GET(req: Request) {
  const asked = new URL(req.url).searchParams.get("now");
  const today = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : new Date().toISOString().slice(0, 10);
  const quotes = (await listQuotes()).filter((q) => q.eventDate);
  const ctx = await poContext();
  const schedules: Record<string, Schedule> = {};
  for (const q of quotes) {
    const pos = q.status === "godkand" ? (await purchaseOrdersFor(q, ctx)).map((p) => ({ supplierId: p.supplierId, status: p.status })) : [];
    const s = scheduleFor(q, pos, today);
    if (s) schedules[q.ref] = s;
  }
  return NextResponse.json({ today, schedules }, { headers: { "Cache-Control": "no-store" } });
}
