import { NextResponse } from "next/server";
import { createDemo, listDemos } from "@/lib/demos";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ demos: await listDemos() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { host?: string; brand?: string; color?: string; event?: string; contact?: string };
  const demo = await createDemo(body);
  if ("error" in demo) return NextResponse.json({ error: demo.error }, { status: 400 });
  return NextResponse.json({ demo });
}
