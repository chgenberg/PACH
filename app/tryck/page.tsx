import Image from "next/image";
import Link from "next/link";
import { PageHero } from "@/components/PageHero";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { familyById } from "@/lib/catalog";
import { familiesForMethod, printIndex } from "@/lib/printMethods";

export const metadata = { title: "Tryckmetoder – PACH" };

const HERO: Record<string, string> = {
  screentryck: "DEMO-P001",
  transfer: "DEMO-P004",
  brodyr: "DEMO-P011",
  gravyr: "DEMO-P021",
  digitaltryck: "DEMO-P014",
};

export default function PrintIndexPage() {
  return (
    <div className="shop">
      <SiteHeader />
      <article className="prose-page">
        <PageHero kicker="Märkning" title="Tryck som passar produkten" lede="Vi visar bara de metoder som faktiskt går på just den grejen – inte samma textil-spec på muggar och pennor." />
        <div className="print-cards">
          {printIndex.map((m) => {
            const hero = familyById(HERO[m.slug])?.image;
            return (
              <Link key={m.slug} href={`/tryck/${m.slug}`} className="print-card">
                <span className="print-card-photo">{hero ? <Image src={hero} alt="" width={360} height={360} /> : null}</span>
                <div>
                  <h2>{m.label}</h2>
                  <p>{m.lede}</p>
                  <small>{m.cheapestWhen}</small>
                  <span className="print-card-meta">
                    {familiesForMethod(m.slug).length} produkter · {m.maxColors.split(/[.,]/)[0]}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </article>
      <SiteFooter />
    </div>
  );
}