import { NextResponse } from "next/server";
import { applyShareAction, getShared, type ShareAction } from "@/lib/share";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const quote = await getShared(token);
  if (!quote) return NextResponse.json({ error: "Länken är inte giltig" }, { status: 404 });
  return NextResponse.json({ quote }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as ShareAction;
  if (!["approve", "unapprove", "comment"].includes(body.action)) return NextResponse.json({ error: "Okänd åtgärd" }, { status: 400 });
  const res = await applyShareAction(token, body);
  if (res.error) return NextResponse.json({ error: res.error }, { status: res.error === "Länken är inte giltig" ? 404 : 400 });
  return NextResponse.json({ quote: res.quote });
}
