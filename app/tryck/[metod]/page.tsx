import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/PageHero";
import { ProductGrid } from "@/components/ProductGrid";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { METHODS, METHOD_INFO } from "@/lib/marking";
import { familiesForMethod, printPageOf } from "@/lib/printMethods";

export function generateStaticParams() {
  return METHODS.map((metod) => ({ metod }));
}

export async function generateMetadata({ params }: { params: Promise<{ metod: string }> }) {
  const page = printPageOf((await params).metod);
  return { title: page ? `${METHOD_INFO[page.slug].label} – PACH` : "PACH" };
}

export default async function PrintMethodPage({ params }: { params: Promise<{ metod: string }> }) {
  const page = printPageOf((await params).metod);
  if (!page) notFound();
  const info = METHOD_INFO[page.slug];
  const products = familiesForMethod(page.slug);
  const spec = [
    ["Ytor", page.areas],
    ["Maxstorlek", page.maxSize],
    ["Färger", page.maxColors],
    ...(page.underprint ? [["Undertryck", page.underprint]] : []),
    ["När det är billigast", page.cheapestWhen],
    ["Fil", page.file],
  ];

  return (
    <div className="shop">
      <SiteHeader />
      <article className="prose-page">
        <PageHero kicker="Tryck" title={info.label} lede={page.lede}>
          <nav className="method-tabs" aria-label="Tryckmetoder">
            {METHODS.map((m) => (
              <Link key={m} href={`/tryck/${m}`} className={m === page.slug ? "is-on" : ""}>
                {METHOD_INFO[m].label}
              </Link>
            ))}
          </nav>
        </PageHero>
        <dl className="spec-grid">
          {spec.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <section className="page-section">
          <div className="section-head">
            <h2>Produkter som tål {info.label.toLowerCase()}</h2>
            <span>{products.length} st</span>
          </div>
          <ProductGrid items={products} />
        </section>
      </article>
      <SiteFooter />
    </div>
  );
}