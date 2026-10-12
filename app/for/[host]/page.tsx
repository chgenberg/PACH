import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandLanding } from "@/components/BrandLanding";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { hostOk, normalizeHost } from "@/lib/host";
import { readAnalysis } from "@/lib/siteAnalysis";

const pretty = (host: string) => host.split(".")[0].replace(/^./, (c) => c.toUpperCase());

export async function generateMetadata({ params }: { params: Promise<{ host: string }> }): Promise<Metadata> {
  const host = normalizeHost(decodeURIComponent((await params).host));
  const a = hostOk(host) ? await readAnalysis(host).catch(() => null) : null;
  const name = a?.brandName || pretty(host);
  return { title: `${name} × PACH`, description: `Profilprodukter med ${name}s logga – förslag från PACH.` };
}

export default async function BrandPage({ params }: { params: Promise<{ host: string }> }) {
  const host = normalizeHost(decodeURIComponent((await params).host));
  if (!hostOk(host)) notFound();
  const a = await readAnalysis(host).catch(() => null);

  return (
    <div className="shop">
      <SiteHeader />
      <BrandLanding host={host} name={a?.brandName || pretty(host)} color={a?.brandColor || "#1B1A17"} tagline={a?.tagline || ""} known={Boolean(a)} />
      <SiteFooter />
    </div>
  );
}
