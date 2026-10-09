import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { readImageUrl } from "@/lib/brandCache";
import { isEventId } from "@/lib/eventAgent";
import { eventOf, familiesForEvent } from "@/lib/events";
import { findHotspots } from "@/lib/hotspots";
import { hasOpenAIKey } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  if (!hasOpenAIKey()) return NextResponse.json({ spots: [] });
  const body = (await req.json().catch(() => ({}))) as { event?: string; image?: string };
  const ev = body.event ? eventOf(body.event) : null;
  if (!ev || !isEventId(ev.slug)) return NextResponse.json({ error: "Händelsen hittades inte" }, { status: 404 });

  const src = body.image || ev.scene;
  // Only the event's own scene or images from our cache – never arbitrary paths.
  const image = src === ev.scene ? await readFile(path.join(process.cwd(), "public", ev.scene)).catch(() => null) : await readImageUrl(src);
  if (!image) return NextResponse.json({ error: "Bilden hittades inte" }, { status: 404 });

  const spots = await findHotspots(`${ev.slug}|${src}`, image, familiesForEvent(ev.slug));
  return NextResponse.json({ spots });
}
