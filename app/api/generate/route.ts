import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { cacheKey, cachedUrl, storeImage } from "@/lib/brandCache";
import { loadBrand, logoPrefersDark } from "@/lib/brandLogo";
import { familyById } from "@/lib/catalog";
import { normalizeHost } from "@/lib/host";
import { brandProductPhoto, errorMessage, hasOpenAIKey } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 120;

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
    const id = cacheKey("product-v3", normalizeHost(body.host), family.id);
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
