import Link from "next/link";
import { PageHero } from "@/components/PageHero";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata = { title: "Garanti – PACH" };

const PROMISES = [
  { t: "Rätt pris", d: "Synlig kalkyl: produkt, tryck per styck och startkostnad. Riktpris tills offerten är skriven." },
  { t: "Mänsklig kontakt", d: "En person som kan produkter och tryck. Inte bara en bot." },
  { t: "3D-korrektur", d: "Ni ser loggan på produkten, i rätt metod och storlek, innan något är bindande." },
  { t: "Prover", d: "Otryckta prover går att beställa när färg och känsla spelar roll." },
  { t: "Trygga leveranser", d: "Beräknat datum i arbetsdagar från godkänt korrektur. Spårning när ordern är i gång." },
  { t: "Uppföljning", d: "Vi hör av oss efter leverans. Original sparas så påfyllning går snabbt." },
];

export default function GuaranteePage() {
  return (
    <div className="shop">
      <SiteHeader />
      <article className="prose-page">
        <PageHero kicker="Kundlöfte" title="Trygg hela vägen" lede="Sex saker vi håller. Inget binds förrän ni godkänt offert och 3D-korrektur." />
        <ul className="value-grid is-six">
          {PROMISES.map((p, i) => (
            <li key={p.t}>
              <span>0{i + 1}</span>
              <b>{p.t}</b>
              <p>{p.d}</p>
            </li>
          ))}
        </ul>
        <div className="cta-band">
          <div>
            <b>Redo att se er logga på riktigt?</b>
            <p>Börja med webbadressen – det tar en minut.</p>
          </div>
          <Link href="/" className="btn-dark">
            Kom igång
          </Link>
        </div>
      </article>
      <SiteFooter />
    </div>
  );
}