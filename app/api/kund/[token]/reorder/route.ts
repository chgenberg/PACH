import { NextResponse } from "next/server";
import { portalView, requestReorder } from "@/lib/customers";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const res = await requestReorder(token, body);
  if (res.error) return NextResponse.json({ error: res.error }, { status: res.error === "Länken är inte giltig" ? 404 : 400 });
  return NextResponse.json({ portal: await portalView(token) });
}
