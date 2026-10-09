import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { cacheKey, cachedUrl, storeImage } from "@/lib/brandCache";
import { loadBrand, logoPrefersDark } from "@/lib/brandLogo";
import { familyById } from "@/lib/catalog";
import { eventOf } from "@/lib/events";
import { normalizeHost } from "@/lib/host";
import { brandLifestyle, errorMessage, hasOpenAIKey } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(req: Request) {
  if (!hasOpenAIKey()) return NextResponse.json({ error: "OpenAI-nyckel saknas" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { event?: string; index?: number; host?: string };
  const ev = body.event ? eventOf(body.event) : null;
  const photo = ev && (body.index === 0 || body.index === 1) ? ev.photos[body.index] : null;
  const family = photo ? familyById(photo.product) : null;
  if (!ev || !photo || !family) return NextResponse.json({ error: "Fotot hittades inte" }, { status: 404 });
  if (!body.host) return NextResponse.json({ error: "Ange en webbadress" }, { status: 400 });

  try {
    const id = cacheKey("photo-v2", normalizeHost(body.host), ev.slug, String(body.index));
    const hit = await cachedUrl(id);
    if (hit) return NextResponse.json({ image: hit, cached: true });

    const { logo } = await loadBrand(body.host);
    const productPhoto = await readFile(path.join(process.cwd(), "public", family.image));
    const shot = await brandLifestyle({ productPhoto, logo, productName: family.name, scene: photo.scene, darkLogo: await logoPrefersDark(logo) });
    return NextResponse.json({ image: await storeImage(id, shot) });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
