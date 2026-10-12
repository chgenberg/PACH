import { NextResponse } from "next/server";
import { isRef } from "@/lib/quotes";
import { listOrders, supplierStatusFor } from "@/lib/supplier";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ref = new URL(req.url).searchParams.get("ref");
  if (ref !== null) {
    if (!isRef(ref)) return NextResponse.json({ error: "Ogiltigt offertnummer" }, { status: 400 });
    return NextResponse.json({ status: await supplierStatusFor(ref) });
  }
  return NextResponse.json({ orders: await listOrders() });
}
