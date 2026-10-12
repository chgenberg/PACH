import { NextResponse } from "next/server";
import { applySupplierAction, supplierViews } from "@/lib/suppliers";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ suppliers: await supplierViews() });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { supplierId?: string; kind?: string; payload?: Record<string, string> };
  const payload = Object.fromEntries(Object.entries(body.payload ?? {}).filter(([, v]) => typeof v === "string").map(([k, v]) => [k, v.slice(0, 600)]));
  const error = await applySupplierAction(String(body.supplierId ?? ""), String(body.kind ?? ""), payload);
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ suppliers: await supplierViews() });
}
