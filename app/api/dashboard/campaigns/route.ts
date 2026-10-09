import { NextResponse } from "next/server";
import { createCampaign, listCampaigns } from "@/lib/campaigns";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ campaigns: await listCampaigns() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Parameters<typeof createCampaign>[0];
  const c = await createCampaign(body);
  if ("error" in c) return NextResponse.json({ error: c.error }, { status: 400 });
  return NextResponse.json({ campaign: c });
}
