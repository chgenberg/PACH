import { NextResponse } from "next/server";
import { listKalkyler, sanitizeKalkyl, saveKalkyl } from "@/lib/kalkyler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ kalkyler: await listKalkyler() });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  const k = sanitizeKalkyl(body);
  if ("error" in k) return NextResponse.json(k, { status: 400 });
  return NextResponse.json({ kalkyl: await saveKalkyl(k) });
}
