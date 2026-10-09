import { NextResponse } from "next/server";
import { isRef } from "@/lib/quotes";
import { ensureShare } from "@/lib/share";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { ref?: string };
  if (!isRef(body.ref)) return NextResponse.json({ error: "Ogiltig offert" }, { status: 400 });
  const share = await ensureShare(body.ref);
  if (!share) return NextResponse.json({ error: "Offerten hittades inte" }, { status: 404 });
  return NextResponse.json({ path: `/o/${share.token}` });
}
