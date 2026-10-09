import { NextResponse } from "next/server";
import { addCollectEntry } from "@/lib/collect";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { name?: string; sizes?: Record<string, string>; print?: string };
  const res = await addCollectEntry(token, body);
  if (res.error) return NextResponse.json({ error: res.error }, { status: res.error === "Länken är inte giltig" ? 404 : 400 });
  return NextResponse.json({ ok: true });
}
