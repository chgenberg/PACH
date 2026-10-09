import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { cacheKey, cachedUrl, readImage, storeImage } from "@/lib/brandCache";
import { familyById } from "@/lib/catalog";
import { BASE_COLOR, colorName, isHex } from "@/lib/colors";
import { normalizeHost } from "@/lib/host";
import { errorMessage, hasOpenAIKey, recolorProduct } from "@/lib/openai";
import { stockColorFile } from "@/lib/stockColors";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { productId?: string; hex?: string; host?: string };
  const family = body.productId ? familyById(body.productId) : null;
  if (!family) return NextResponse.json({ error: "Produkten hittades inte" }, { status: 404 });
  if (!isHex(body.hex)) return NextResponse.json({ error: "Ogiltig färg" }, { status: 400 });

  const hex = body.hex.toUpperCase();
  const host = body.host ? normalizeHost(body.host) : "";
  // The product photo with the logo (or the plain catalogue photo) is the black original.
  const brandedId = host ? cacheKey("product-v1", host, family.id) : "";
  const original = brandedId ? await readImage(brandedId) : null;
  if (hex === BASE_COLOR) return NextResponse.json({ image: original ? (await cachedUrl(brandedId))! : family.image });
  if (!original) {
    const stock = stockColorFile(family.id, hex);
    if (await access(path.join(process.cwd(), "public", stock)).then(() => true, () => false)) return NextResponse.json({ image: stock, stock: true });
  }

  try {
    const id = cacheKey("recolor-v1", host, family.id, hex);
    const hit = await cachedUrl(id);
    if (hit) return NextResponse.json({ image: hit, cached: true });
    if (!hasOpenAIKey()) return NextResponse.json({ error: "OpenAI-nyckel saknas" }, { status: 503 });

    const image = original ?? (await readFile(path.join(process.cwd(), "public", family.image)));
    const shot = await recolorProduct({ image, hex, colorName: colorName(hex), productName: family.name });
    return NextResponse.json({ image: await storeImage(id, shot) });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
