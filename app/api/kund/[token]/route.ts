import { NextResponse } from "next/server";
import { portalView } from "@/lib/customers";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const view = await portalView((await params).token);
  if (!view) return NextResponse.json({ error: "Länken är inte giltig" }, { status: 404 });
  return NextResponse.json({ portal: view }, { headers: { "Cache-Control": "no-store" } });
}
