import { NextResponse } from "next/server";
import { chooseGift } from "@/lib/campaigns";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const body = (await req.json().catch(() => ({}))) as { rid?: string } & Parameters<typeof chooseGift>[2];
  const res = await chooseGift((await params).token, String(body.rid ?? ""), body);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json(res);
}
