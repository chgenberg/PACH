import { NextResponse } from "next/server";
import { placeStoreOrder } from "@/lib/campaigns";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const body = (await req.json().catch(() => ({}))) as Parameters<typeof placeStoreOrder>[1];
  const res = await placeStoreOrder((await params).token, body);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json(res);
}
