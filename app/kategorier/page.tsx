import Link from "next/link";
import { PageHero } from "@/components/PageHero";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { ASSORTMENT } from "@/lib/assortment";
import { catalogIndex, fromPrice } from "@/lib/catalog";
import { sek } from "@/lib/pricing";

export const metadata = { title: "A–Ö – PACH" };

export default function CategoriesPage() {
  const { categories, products } = catalogIndex();
  const letters = new Map<string, typeof products>();
  for (const f of products) {
    const l = f.name.charAt(0).toUpperCase();
    letters.set(l, [...(letters.get(l) ?? []), f]);
  }

  return (
    <div className="shop">
      <SiteHeader />
      <article className="prose-page">
        <PageHero kicker="Katalog" title="Från A till Ö" lede={`${products.length} produkter i ${categories.length} kategorier.`}>
          <nav className="letter-bar" aria-label="Hoppa till bokstav">
            {[...letters.keys()].map((l) => (
              <a key={l} href={`#bokstav-${l}`}>
                {l}
              </a>
            ))}
          </nav>
        </PageHero>

        <section className="page-section">
          <h2>Sortiment</h2>
          <div className="chip-cloud">
            {ASSORTMENT.map((a) => (
              <Link key={a.slug} href={`/kategori/${a.slug}`}>
                {a.name}
              </Link>
            ))}
          </div>
        </section>

        <section className="page-section">
          <h2>Kategorier</h2>
          <div className="chip-cloud">
            {categories.map((c) => (
              <Link key={c.name} href={c.href}>
                {c.name} <span>{c.count}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="page-section">
          <h2>Produkter</h2>
          <div className="az-columns">
            {[...letters.entries()].map(([l, list]) => (
              <div key={l} id={`bokstav-${l}`} className="az-group">
                <b>{l}</b>
                <ul>
                  {list.map((f) => (
                    <li key={f.id}>
                      <Link href={`/p/${f.id}`}>
                        {f.name}
                        <span>från {sek(fromPrice(f))}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </article>
      <SiteFooter />
    </div>
  );
}