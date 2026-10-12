import Link from "next/link";
import { PageHero } from "@/components/PageHero";
import { ProductGrid } from "@/components/ProductGrid";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { SEARCH_CHIPS } from "@/lib/assortment";
import { searchFamilies } from "@/lib/catalog";

export const metadata = { title: "Sök – PACH" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim();
  const hits = q ? searchFamilies(q) : [];

  return (
    <div className="shop">
      <SiteHeader />
      <article className="prose-page">
        <PageHero kicker="Sök" title={q ? `”${q}”` : "Vad letar du efter?"} lede={q ? `${hits.length} ${hits.length === 1 ? "träff" : "träffar"}` : undefined}>
          <form className="page-search" action="/sok">
            <input name="q" defaultValue={q} placeholder="T-shirt, mugg, penna…" aria-label="Sök" />
            <button type="submit">Sök</button>
          </form>
          <div className="seek-chips">
            {SEARCH_CHIPS.map((chip) => (
              <Link key={chip.q} href={`/sok?q=${encodeURIComponent(chip.q)}`} className={`seek-chip${chip.q === q ? " is-on" : ""}`}>
                {chip.label}
              </Link>
            ))}
          </div>
        </PageHero>
        {q && hits.length === 0 ? (
          <div className="empty">
            <b>Inget träffade.</b>
            <p>
              Prova ett annat ord eller bläddra i <Link href="/kategorier">A–Ö</Link>.
            </p>
          </div>
        ) : (
          <ProductGrid items={hits} />
        )}
      </article>
      <SiteFooter />
    </div>
  );
}