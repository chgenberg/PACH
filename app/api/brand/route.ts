import { NextResponse } from "next/server";
import { loadBrand } from "@/lib/brandLogo";
import { hostOk, normalizeHost } from "@/lib/host";
import { errorMessage } from "@/lib/openai";
import { logoFromFile } from "@/lib/scrape/logo";
import { readAnalysis, type SiteAnalysis, storeAnalysis } from "@/lib/siteAnalysis";

export const runtime = "nodejs";
export const maxDuration = 180;

const HEX = /^#[0-9a-f]{6}$/i;

function view(a: SiteAnalysis | null, host: string, name: string, color: string) {
  return {
    host,
    name: a?.brandName || name,
    color: a?.brandColor || color,
    palette: a?.palette ?? [],
    tagline: a?.tagline ?? "",
    note: a?.logoNote ?? "",
    industry: a?.industryEn ?? "",
    rev: a?.rev ?? 0,
    logo: `/api/brand-logo?host=${encodeURIComponent(host)}&v=${a?.rev ?? 0}`,
  };
}

/** What the agents found about the brand – waits for the analysis, so the customer can confirm it. */
export async function GET(req: Request) {
  const host = normalizeHost(new URL(req.url).searchParams.get("host") ?? "");
  if (!hostOk(host)) return NextResponse.json({ error: "Ogiltig adress" }, { status: 400 });
  try {
    const { profile, analysis } = await loadBrand(host);
    return NextResponse.json(view(analysis, profile.host, profile.name, profile.color));
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

/** The customer's corrections: name, colour, tagline or a new logo. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { host?: string; name?: string; color?: string; tagline?: string; logo?: string };
  const host = normalizeHost(body.host ?? "");
  if (!hostOk(host)) return NextResponse.json({ error: "Ogiltig adress" }, { status: 400 });
  try {
    const { profile, analysis } = await loadBrand(host);
    const base: SiteAnalysis = analysis ??
      (await readAnalysis(host)) ?? {
        host,
        brandName: profile.name,
        industryEn: "",
        offeringEn: "",
        tone: "",
        brandColor: HEX.test(profile.color) ? profile.color : null,
        tagline: "",
        scene: { screen: "", rollup: "", counter: "", shelves: "", staff: "", materials: "", lighting: "" },
        products: [],
        logoLight: null,
        logoDark: null,
        logoSource: "",
        logoNote: "",
      };
    let logo: { light: Buffer; dark: Buffer } | null = null;
    if (body.logo?.startsWith("data:image/")) {
      const data = Buffer.from(body.logo.split(",", 2)[1] ?? "", "base64");
      if (data.byteLength > 10_000_000) return NextResponse.json({ error: "Loggan är för stor." }, { status: 413 });
      logo = await logoFromFile(data, base.brandName).catch(() => {
        throw new Error("Kunde inte läsa loggan. Använd PNG, JPG eller SVG med tydlig bakgrund.");
      });
    }
    const next = await storeAnalysis(
      {
        ...base,
        brandName: (body.name ?? base.brandName).trim().slice(0, 40) || base.brandName,
        brandColor: body.color && HEX.test(body.color) ? body.color.toUpperCase() : base.brandColor,
        tagline: body.tagline !== undefined ? body.tagline.trim().slice(0, 36) : base.tagline,
        logoSource: logo ? "uppladdad av kunden" : base.logoSource,
        logoNote: logo ? "" : base.logoNote,
        rev: (base.rev ?? 0) + 1,
      },
      logo,
    );
    return NextResponse.json(view(next, host, next.brandName, next.brandColor ?? profile.color));
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
