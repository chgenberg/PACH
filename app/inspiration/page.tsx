import Image from "next/image";
import Link from "next/link";
import { PageHero } from "@/components/PageHero";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { EVENTS } from "@/lib/events";

export const metadata = { title: "Inspiration – PACH" };

const EXAMPLE: Record<string, string> = {
  massa: "Volvo",
  kickoff: "Spotify",
  konferens: "Klarna",
  sommar: "Coca-Cola",
  event: "Oatly",
  julklapp: "IKEA",
};

export default function InspirationPage() {
  return (
    <div className="shop">
      <SiteHeader />
      <article className="prose-page">
        <PageHero kicker="Inspiration" title="Så kan det se ut" lede="Varje miljö byggs om med er logga när ni anger webbadressen. Välj ett rum och börja där.">
          <div className="hero-actions">
            <Link href="/handelse/julklapp" className="btn-line">
              Julgåvor
            </Link>
            <Link href="/handelse/sommar" className="btn-line">
              Sommargåvor
            </Link>
            <Link href="/butik/skapa" className="btn-line">
              Personalbutik
            </Link>
          </div>
        </PageHero>
        <div className="inspo-grid">
          {EVENTS.map((ev, i) => (
            <Link key={ev.slug} href={`/handelse/${ev.slug}`} className={`inspo-card${i === 0 || i === EVENTS.length - 1 ? " is-wide" : ""}`}>
              <span className="inspo-photo">
                <Image src={`/inspiration/${ev.slug}.jpg`} alt={`${ev.name} i ${EXAMPLE[ev.slug]}s profil`} width={1536} height={1024} sizes="(max-width: 860px) 100vw, 50vw" />
                <span className="inspo-brand">Exempel: {EXAMPLE[ev.slug]}</span>
              </span>
              <div>
                <h2>{ev.name}</h2>
                <p>{ev.hint}</p>
                <em>Utforska →</em>
              </div>
            </Link>
          ))}
        </div>
        <p className="inspo-note">Varumärkena visar bara hur det kan se ut. De är inte kunder eller samarbetspartner till PACH.</p>
      </article>
      <SiteFooter />
    </div>
  );
}