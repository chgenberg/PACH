import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { cacheKey, cachedUrl, storeImage } from "@/lib/brandCache";
import { loadBrand } from "@/lib/brandLogo";
import { eventOf } from "@/lib/events";
import { normalizeHost } from "@/lib/host";
import { brandScene, errorMessage, hasOpenAIKey } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 180;

/** Only a clearly coloured theme colour is worth steering the scene with. */
function accent(hex: string) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return undefined;
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const max = Math.max(r, g, b);
  const sat = max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
  return sat >= 0.25 && max > 60 ? hex : undefined;
}

export async function POST(req: Request) {
  if (!hasOpenAIKey()) return NextResponse.json({ error: "OpenAI-nyckel saknas" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { event?: string; host?: string };
  const ev = body.event === "hero" ? { slug: "hero", scene: "/scenes/hero.jpg" } : body.event ? eventOf(body.event) : null;
  if (!ev) return NextResponse.json({ error: "Händelsen hittades inte" }, { status: 404 });
  if (!body.host) return NextResponse.json({ error: "Ange en webbadress" }, { status: 400 });

  try {
    const id = cacheKey("scene-v1", normalizeHost(body.host), ev.slug);
    const hit = await cachedUrl(id);
    if (hit) return NextResponse.json({ image: hit, cached: true });

    const { profile, logo } = await loadBrand(body.host);
    const scene = await readFile(path.join(process.cwd(), "public", ev.scene));
    const branded = await brandScene({ scene, logo, company: profile.name, color: accent(profile.color) });
    return NextResponse.json({ image: await storeImage(id, branded) });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
