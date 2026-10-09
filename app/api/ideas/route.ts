import { NextResponse } from "next/server";
import { isEventId } from "@/lib/eventAgent";
import { hostOk, normalizeHost } from "@/lib/host";
import { ideasFor } from "@/lib/ideas";
import { hasOpenAIKey } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { host?: string; event?: string };
  const host = normalizeHost(body.host ?? "");
  if (!hasOpenAIKey() || !hostOk(host) || !isEventId(body.event)) return NextResponse.json({ ideas: [] });
  return NextResponse.json({ ideas: await ideasFor(host, body.event) });
}
