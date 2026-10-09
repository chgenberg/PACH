import sharp from "sharp";
import { download, loadBrand } from "@/lib/brandLogo";
import { hostOk, normalizeHost } from "@/lib/host";

export const runtime = "nodejs";

/** Same-origin copy of a company logo, so the design tool can draw and export it. */
export async function GET(req: Request) {
  const host = normalizeHost(new URL(req.url).searchParams.get("host") ?? "");
  if (!hostOk(host)) return new Response("Ogiltig adress", { status: 400 });
  try {
    const { logo } = await loadBrand(host);
    // Site icons are often tiny; take the sharpest of the site's own icon and a 256 px favicon.
    const alt = await download(`https://www.google.com/s2/favicons?domain=${host}&sz=256`);
    const width = async (b: Buffer | null) => (b ? ((await sharp(b).metadata()).width ?? 0) : 0);
    const best = (await width(alt)) > (await width(logo)) ? alt! : logo;
    const png = await sharp(best).resize(1024, 1024, { fit: "inside", withoutEnlargement: false, kernel: "lanczos3" }).png().toBuffer();
    return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" } });
  } catch {
    return new Response("Hittades inte", { status: 404 });
  }
}
