import sharp from "sharp";
import { download, loadBrand } from "@/lib/brandLogo";
import { hostOk, normalizeHost } from "@/lib/host";
import { analysisLogo } from "@/lib/siteAnalysis";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Same-origin copy of a company logo (?variant=dark for dark products), so the 3D tool and design tool can draw and export it. */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const host = normalizeHost(params.get("host") ?? "");
  if (!hostOk(host)) return new Response("Ogiltig adress", { status: 400 });
  try {
    const { logo, analysis } = await loadBrand(host);
    const verified = await analysisLogo(analysis, params.get("variant") === "dark" ? "dark" : "light");
    // Without a verified logo from the analysis, take the sharpest of the site icon and a 256 px favicon.
    const alt = verified ? null : await download(`https://www.google.com/s2/favicons?domain=${host}&sz=256`);
    const width = async (b: Buffer | null) => (b ? ((await sharp(b).metadata()).width ?? 0) : 0);
    const best = verified ?? (alt && (await width(alt)) > (await width(logo)) ? alt : logo);
    const png = await sharp(best).resize(1024, 1024, { fit: "inside", withoutEnlargement: false, kernel: "lanczos3" }).png().toBuffer();
    return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" } });
  } catch {
    return new Response("Hittades inte", { status: 404 });
  }
}
