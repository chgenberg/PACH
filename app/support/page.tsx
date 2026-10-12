import Image from "next/image";
import { PageHero } from "@/components/PageHero";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata = { title: "Kundsupport – PACH" };

const STEPS = [
  { t: "Berätta vad ni behöver", d: "Webbadress, brandbook eller sök i sortimentet. Vi kan också föreslå." },
  { t: "Förslag och 3D", d: "Produkter med er logga, ett riktpris och ett 3D-korrektur ni kan snurra på." },
  { t: "Godkänn", d: "Offert och korrektur godkänns digitalt. Inget är bindande före det." },
  { t: "Produktion", d: "Tryck efter godkänt korrektur. Följ ordern och samla storlekar via länk." },
  { t: "Uppföljning", d: "Vi hör av oss när leveransen är framme. Original sparas till nästa gång." },
];

const CONTACT = [
  { t: "Ring oss", v: "08-000 00 00", href: "tel:+46800000000", d: "Mån–tors 08–17, fre 08–16.30" },
  { t: "Mejla oss", v: "hej@pach.se", href: "mailto:hej@pach.se", d: "Svar samma arbetsdag" },
  { t: "Chatta", v: "Stylisten", href: "#", d: "Nere till höger – dygnet runt" },
];

const FAQ = [
  { q: "Får man se trycket innan ordern är bindande?", a: "Ja. Alltid skriftlig offert och 3D-korrektur. Ni godkänner båda." },
  { q: "Vilken fil behövs?", a: "Vektor är bäst: PDF, SVG, AI eller EPS. PNG och JPG går att skicka – vi hjälper till att rita om." },
  { q: "Vad kostar start?", a: "En startkostnad per tryckfärg eller brodyrkort, plus styckpris. Allt syns i kalkylen och på offerten." },
  { q: "Hur lång tid tar det?", a: "Räknas i arbetsdagar från godkänt korrektur, beroende på metod. Express går att fråga om." },
  { q: "Kan vi blanda färger och storlekar?", a: "Ja. Samla storlekar via länk så fyller personalen i själva." },
];

const WORDS = [
  { t: "Korrektur", d: "Loggans storlek, placering och metod på just den produkten. Hos oss i 3D." },
  { t: "Schablon", d: "Mallen för en tryckfärg i screen. En kostnad per färg första gången." },
  { t: "Startkostnad", d: "Maskinsetup eller brodyrkort. Läggs på en gång, inte per styck." },
  { t: "Vektor", d: "Linjer som kan skalas utan att bli suddiga. PDF, SVG, AI, EPS." },
  { t: "Undertryck", d: "Ett vitt lager under färgen på mörka plagg. Räknas som en extra färg." },
  { t: "Brodyrkort", d: "Stygnprogrammet för er logga. Sparas, så påfyllning blir billigare." },
];

export default function SupportPage() {
  return (
    <div className="shop">
      <SiteHeader />
      <article className="prose-page">
        <div className="about-hero support-hero">
          <PageHero kicker="Kundsupport" title="Vi finns här" lede="En människa som kan produkter och tryck – eller stylisten, när det är bråttom. Vi levererar i hela Sverige." />
          <div className="about-photo">
            <Image src="/lifestyle/support.jpg" alt="Kvinna med PACH-keps som håller upp en karta över Sverige" width={1536} height={1024} priority />
          </div>
        </div>
        <ul className="contact-grid">
          {CONTACT.map((c) => (
            <li key={c.t}>
              <span>{c.t}</span>
              <a href={c.href}>{c.v}</a>
              <small>{c.d}</small>
            </li>
          ))}
        </ul>

        <section className="page-section">
          <h2>Så handlar du</h2>
          <ol className="step-grid">
            {STEPS.map((s, i) => (
              <li key={s.t}>
                <span>{i + 1}</span>
                <b>{s.t}</b>
                <p>{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="page-section">
          <h2>Vanliga frågor</h2>
          <div className="faq-list">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="page-section">
          <h2>Ordlista</h2>
          <dl className="word-grid">
            {WORDS.map((w) => (
              <div key={w.t}>
                <dt>{w.t}</dt>
                <dd>{w.d}</dd>
              </div>
            ))}
          </dl>
        </section>
      </article>
      <SiteFooter />
    </div>
  );
}