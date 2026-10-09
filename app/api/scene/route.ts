import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { cacheKey, cachedUrl, storeImage } from "@/lib/brandCache";
import { loadBrand } from "@/lib/brandLogo";
import { eventOf } from "@/lib/events";
import { normalizeHost } from "@/lib/host";
import { errorMessage, hasOpenAIKey } from "@/lib/openai";
import { renderScene } from "@/lib/sceneDirector";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  if (!hasOpenAIKey()) return NextResponse.json({ error: "OpenAI-nyckel saknas" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { event?: string; host?: string };
  const ev = body.event === "hero" ? { slug: "hero", scene: "/scenes/hero.jpg" } : body.event ? eventOf(body.event) : null;
  if (!ev) return NextResponse.json({ error: "Händelsen hittades inte" }, { status: 404 });
  if (!body.host) return NextResponse.json({ error: "Ange en webbadress" }, { status: 400 });

  try {
    const id = cacheKey("scene-v3", normalizeHost(body.host), ev.slug);
    const hit = await cachedUrl(id);
    if (hit) return NextResponse.json({ image: hit, cached: true });

    const { profile, logo, analysis } = await loadBrand(body.host);
    const scene = await readFile(path.join(process.cwd(), "public", ev.scene));
    const branded = await renderScene({ event: ev.slug, scene, logo, company: profile.name, analysis });
    return NextResponse.json({ image: await storeImage(id, branded) });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
