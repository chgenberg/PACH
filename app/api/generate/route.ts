import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { familyById } from "@/lib/catalog";
import { brandProductPhoto, errorMessage, hasOpenAIKey } from "@/lib/openai";
import { cacheKey, cachedUrl, storeImage } from "@/lib/brandCache";
import { loadBrand } from "@/lib/brandLogo";
import { normalizeHost } from "@/lib/host";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Decide if the logo reads better on a dark or light backdrop by sampling its average luminance. */
async function logoPrefersDark(logo: Buffer): Promise<boolean> {
  try {
    const { data } = await sharp(logo)
      .ensureAlpha()
      .resize(32, 32, { fit: "inside" })
      .raw()
      .toBuffer({ resolveWithObject: true });
    let sum = 0;
    let weight = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3] / 255;
      const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      sum += lum * a;
      weight += a;
    }
    const avg = weight ? sum / weight : 255;
    return avg > 150; // light-coloured logo → needs a dark backdrop
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!hasOpenAIKey()) {
    return NextResponse.json({ error: "OpenAI-nyckel saknas" }, { status: 503 });
  }

  let body: { productId?: string; host?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }

  const family = body.productId ? familyById(body.productId) : null;
  if (!family) {
    return NextResponse.json({ error: "Produkten hittades inte" }, { status: 404 });
  }
  if (!body.host) {
    return NextResponse.json({ error: "Ange en webbadress" }, { status: 400 });
  }

  try {
    const id = cacheKey("product-v1", normalizeHost(body.host), family.id);
    const hit = await cachedUrl(id);
    if (hit) return NextResponse.json({ productId: family.id, name: family.name, image: hit, cached: true });

    const { logo } = await loadBrand(body.host);
    const productPhoto = await readFile(path.join(process.cwd(), "public", family.image));
    const branded = await brandProductPhoto({
      productPhoto,
      logo,
      productName: family.name,
      darkLogo: await logoPrefersDark(logo),
    });

    return NextResponse.json({ productId: family.id, name: family.name, image: await storeImage(id, branded) });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
