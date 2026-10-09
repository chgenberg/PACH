import sharp from "sharp";
import { readProfile, type Profile } from "@/lib/profile";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

export async function download(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "image/*" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 200) return null;
    const meta = await sharp(buf).metadata();
    return meta.width ? buf : null;
  } catch {
    return null;
  }
}

/** Decide if the logo reads better on a dark or light backdrop by sampling its average luminance. */
export async function logoPrefersDark(logo: Buffer): Promise<boolean> {
  try {
    const { data } = await sharp(logo).ensureAlpha().resize(32, 32, { fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
    let sum = 0;
    let weight = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3] / 255;
      sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) * a;
      weight += a;
    }
    return (weight ? sum / weight : 255) > 150;
  } catch {
    return false;
  }
}

/** Read the company profile from its website and download its logo. */
export async function loadBrand(host: string): Promise<{ profile: Profile; logo: Buffer }> {
  const profile = await readProfile(host);
  const logo = (await download(profile.logo)) ?? (await download(`https://www.google.com/s2/favicons?domain=${profile.host}&sz=256`));
  if (!logo) throw new Error("Kunde inte hämta logotypen");
  return { profile, logo };
}
