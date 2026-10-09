import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { toFile } from "openai";
import sharp from "sharp";
import { readImageUrl, storeImage } from "@/lib/brandCache";
import { loadBrand } from "@/lib/brandLogo";
import { familyById } from "@/lib/catalog";
import { colorName, isHex } from "@/lib/colors";
import { hostOk, normalizeHost } from "@/lib/host";
import { errorMessage, hasOpenAIKey, IMAGE_MODEL, IMAGE_QUALITY, openai } from "@/lib/openai";
import { analysisLogo } from "@/lib/siteAnalysis";

export const runtime = "nodejs";
export const maxDuration = 300;

const PHOTO = /^data:image\/(png|jpeg|webp);base64,/;

/** Dress the people in an uploaded team photo in the branded garment. The photo itself is never stored. */
export async function POST(req: Request) {
  if (!hasOpenAIKey()) return NextResponse.json({ error: "Bildtjänsten är inte tillgänglig just nu" }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as { host?: string; productId?: string; photo?: string; image?: string; color?: string };
  const family = body.productId ? familyById(body.productId) : null;
  if (!family || family.shop !== "klader") return NextResponse.json({ error: "Fungerar för kläder" }, { status: 400 });
  if (!body.photo || !PHOTO.test(body.photo) || body.photo.length > 14_000_000) return NextResponse.json({ error: "Ladda upp ett foto (JPG eller PNG)" }, { status: 400 });
  const host = normalizeHost(body.host ?? "");
  if (!hostOk(host)) return NextResponse.json({ error: "Ange företagets webbadress först" }, { status: 400 });

  try {
    const team = await sharp(Buffer.from(body.photo.split(",", 2)[1], "base64")).rotate().resize(1536, 1536, { fit: "inside" }).png().toBuffer();
    const productRaw = (body.image?.startsWith("/api/img/") ? await readImageUrl(body.image) : null) ?? (await readFile(path.join(process.cwd(), "public", family.image)));
    const product = await sharp(productRaw).flatten({ background: "#ffffff" }).resize(1024, 1024, { fit: "contain", background: "#ffffff" }).png().toBuffer();
    const { logo, analysis } = await loadBrand(host);
    const verified = (await analysisLogo(analysis, "light")) ?? logo;
    const logoRef = await sharp(verified).flatten({ background: "#ffffff" }).resize(1024, 1024, { fit: "contain", background: "#ffffff" }).png().toBuffer();
    const colour = isHex(body.color) ? `${colorName(body.color)} (${body.color})` : "the colour shown in the second image";
    const { width = 1536, height = 1024 } = await sharp(team).metadata();
    const size = width > height * 1.15 ? "1536x1024" : height > width * 1.15 ? "1024x1536" : "1024x1024";

    const prompt = `Edit the first photo: dress every clearly visible person in the ${family.name.toLowerCase()} from the second image, in ${colour}, with the company logo from the third image printed crisply on the chest, following the fabric's folds and light.
Keep everything else exactly as in the first photo: the same people, faces, expressions, hair, skin, bodies, poses, hands, framing, background and lighting. Do not add, remove or change any person. The garment fits each person naturally over their body.
The logo keeps its exact shapes, letters and colours – no invented or distorted characters, no other text or logos. Photorealistic, indistinguishable from a real photo.`;
    const res = await openai().images.edit({
      model: IMAGE_MODEL,
      image: [
        await toFile(team, "team.png", { type: "image/png" }),
        await toFile(product, "garment.png", { type: "image/png" }),
        await toFile(logoRef, "logo.png", { type: "image/png" }),
      ],
      prompt,
      size,
      quality: IMAGE_QUALITY,
      output_format: "jpeg",
    });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error("Bildmodellen returnerade ingen bild");
    const url = await storeImage(randomBytes(12).toString("hex"), Buffer.from(b64, "base64"));
    return NextResponse.json({ image: url });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
