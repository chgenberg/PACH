import Image from "next/image";
import Link from "next/link";
import { PageHero } from "@/components/PageHero";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata = { title: "Om PACH" };

const VALUES = [
  { t: "Se det innan", d: "Er logga på produkten i 3D och i miljön – innan något är bindande." },
  { t: "Synliga priser", d: "Produkt, tryck per styck och startkostnad. Ingen 0,00 kr och ingen gissning." },
  { t: "Människor bakom", d: "AI gör förslaget snabbt. En person som kan tryck följer ordern hela vägen." },
];

export default function AboutPage() {
  return (
    <div className="shop">
      <SiteHeader />
      <article className="prose-page">
        <div className="about-hero">
          <PageHero
            kicker="Om oss"
            title="Säg det på en grej"
            lede="En tygkasse går inte att scrolla förbi. Ett paraply stänger man inte av. Vi gör profilprodukter som syns i rummet – med er logga, i 3D, innan ni beställer."
          >
            <div className="hero-actions">
              <Link href="/" className="btn-dark">
                Börja med er logga
              </Link>
              <Link href="/kategorier" className="btn-line">
                Se sortimentet
              </Link>
            </div>
          </PageHero>
          <div className="about-photo">
            <Image src="/lifestyle/team.jpg" alt="Kollegor vid en sjö i matchande hoodies med PACH-loggan" width={1536} height={1024} priority />
          </div>
        </div>
        <ul className="value-grid">
          {VALUES.map((v, i) => (
            <li key={v.t}>
              <span>0{i + 1}</span>
              <b>{v.t}</b>
              <p>{v.d}</p>
            </li>
          ))}
        </ul>
        <section className="page-section about-text">
          <h2>Offert först</h2>
          <p>Ni anger webbadress eller brandbook, ser produkterna med er logga, anpassar trycket i 3D och godkänner offert och korrektur. Först då är något bindande.</p>
          <p>Vi bygger vidare på det som redan fungerar i branschen: synliga tryckpriser, mänsklig kontakt och sparade original. Skillnaden är att ni ser objektet på riktigt, inte som en 2D-skiss.</p>
        </section>
      </article>
      <SiteFooter />
    </div>
  );
}