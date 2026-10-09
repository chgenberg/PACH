import OpenAI, { toFile } from "openai";
import sharp from "sharp";

export const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-6-astra";
export const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-flare";
export const IMAGE_QUALITY = (process.env.OPENAI_IMAGE_QUALITY || "medium") as "low" | "medium" | "high";

export const hasOpenAIKey = () => Boolean(process.env.OPENAI_API_KEY);

let client: OpenAI | null = null;
export function openai() {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

/** Normalise any logo (favicon, png, svg raster) onto a clean square for use as a reference. */
async function logoReference(logo: Buffer, dark: boolean): Promise<Buffer> {
  const bg = dark ? "#111111" : "#ffffff";
  return sharp(logo)
    .flatten({ background: bg })
    .resize(1024, 1024, { fit: "contain", background: bg })
    .png()
    .toBuffer();
}

/**
 * Place a brand logo onto an existing product photo.
 * The first reference is the real product photo, the second is the company logo.
 */
export async function brandProductPhoto(opts: {
  productPhoto: Buffer;
  logo: Buffer;
  productName: string;
  darkLogo?: boolean;
}): Promise<Buffer> {
  const ref = await logoReference(opts.logo, Boolean(opts.darkLogo));
  const prompt = `Take the product in the first image (a ${opts.productName}) and keep it exactly as it is – same product, same angle, same colour, same background and lighting. Place the logo from the second image onto the product as a realistic print or embroidery, sized and positioned naturally on the main visible surface, following the material's folds, curvature and light. The logo must keep its exact shapes, letters and proportions – do not invent or distort any characters. No other text or graphics anywhere. Photorealistic, indistinguishable from a real product photo.`;
  const res = await openai().images.edit({
    model: IMAGE_MODEL,
    image: [
      await toFile(opts.productPhoto, "product.png", { type: "image/png" }),
      await toFile(ref, "logo.png", { type: "image/png" }),
    ],
    prompt,
    size: "1024x1024",
    quality: IMAGE_QUALITY,
    output_format: "png",
  });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error("Bildmodellen returnerade ingen bild");
  return Buffer.from(b64, "base64");
}

/** Editorial lifestyle photo of a real-looking person with the product, the company logo printed on it. */
export async function brandLifestyle(opts: { productPhoto: Buffer; logo: Buffer; productName: string; scene: string; darkLogo?: boolean }): Promise<Buffer> {
  const ref = await logoReference(opts.logo, Boolean(opts.darkLogo));
  const prompt = `Hyperrealistic editorial lifestyle campaign photo, shot on a full-frame camera with a 50mm lens, natural light, shallow depth of field. Real skin texture, natural hands and faces, realistic materials and stitching – indistinguishable from a real photo shoot.
${opts.scene}
The product is exactly the ${opts.productName} in the first reference image – same shape, colour and material. On it, the logo from the second reference image is printed crisply, sized and placed naturally on its main visible surface and following folds, curvature and light. The logo keeps its exact shapes, letters and proportions – no invented or distorted characters.
People are fictional and generic, not famous, with anatomically correct hands. No other logos, brands, readable text or signage anywhere in the image.`;
  const res = await openai().images.edit({
    model: IMAGE_MODEL,
    image: [
      await toFile(opts.productPhoto, "product.png", { type: "image/png" }),
      await toFile(ref, "logo.png", { type: "image/png" }),
    ],
    prompt,
    size: "1536x1024",
    quality: IMAGE_QUALITY,
    output_format: "jpeg",
  });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error("Bildmodellen returnerade ingen bild");
  return Buffer.from(b64, "base64");
}

/** Rebrand a neutral "DIN LOGO" scene with the company logo, keeping composition, people and light. */
export async function brandScene(opts: { scene: Buffer; logo: Buffer; company: string; color?: string }): Promise<Buffer> {
  const ref = await logoReference(opts.logo, false);
  const colour = opts.color && /^#[0-9a-f]{6}$/i.test(opts.color) ? ` Brand colour: ${opts.color}. Use it as an accent on the large printed surfaces (walls, banners, flags, tablecloths), combined with white and natural materials.` : "";
  const prompt = `The first image is a photo with "DIN LOGO" placeholders. The second image is the logo of the company "${opts.company}".
Keep the first image exactly as it is – same composition, camera angle, framing, people, poses, products, lighting and background. Only rebrand it: replace every "DIN LOGO" placeholder with this exact logo – identical shapes, letters and proportions, no invented or distorted characters, no other text. On dark surfaces print the logo in white, on light surfaces in its own colours. Small marks on products follow the material naturally.${colour}
It must still look like an unedited photo by a professional event photographer.`;
  const res = await openai().images.edit({
    model: IMAGE_MODEL,
    image: [
      await toFile(opts.scene, "scene.jpg", { type: "image/jpeg" }),
      await toFile(ref, "logo.png", { type: "image/png" }),
    ],
    prompt,
    size: "1536x1024",
    quality: IMAGE_QUALITY,
    output_format: "jpeg",
  });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error("Bildmodellen returnerade ingen bild");
  return Buffer.from(b64, "base64");
}

export function errorMessage(err: unknown) {
  if (err instanceof OpenAI.APIError) return `OpenAI ${err.status ?? ""}: ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}
