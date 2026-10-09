import { NextResponse } from "next/server";
import { ensureCollect } from "@/lib/collect";
import { isRef } from "@/lib/quotes";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { ref?: string };
  if (!isRef(body.ref)) return NextResponse.json({ error: "Ogiltig offert" }, { status: 400 });
  const collect = await ensureCollect(body.ref);
  if (!collect) return NextResponse.json({ error: "Offerten hittades inte" }, { status: 404 });
  return NextResponse.json({ path: `/s/${collect.token}` });
}
