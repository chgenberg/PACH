import sharp from "sharp";
import { readProfile, type Profile } from "@/lib/profile";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

async function download(url: string): Promise<Buffer | null> {
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

/** Read the company profile from its website and download its logo. */
export async function loadBrand(host: string): Promise<{ profile: Profile; logo: Buffer }> {
  const profile = await readProfile(host);
  const logo = (await download(profile.logo)) ?? (await download(`https://www.google.com/s2/favicons?domain=${profile.host}&sz=256`));
  if (!logo) throw new Error("Kunde inte hämta logotypen");
  return { profile, logo };
}
