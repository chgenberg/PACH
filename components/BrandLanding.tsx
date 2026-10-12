"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/components/CartProvider";
import { useBrandedImage, useBrandedScene } from "@/lib/brandedImage";
import { familyById, fromPrice } from "@/lib/catalog";
import { EVENTS } from "@/lib/events";
import { sek } from "@/lib/pricing";

/** A small kit that fits most companies: wear, carry, drink, write. */
const KIT = ["DEMO-P004", "DEMO-P001", "DEMO-P011", "DEMO-P014", "DEMO-P021", "DEMO-P019", "DEMO-P026", "DEMO-P029"];

function KitItem({ id, host, generate }: { id: string; host: string; generate: boolean }) {
  const f = familyById(id);
  const src = useBrandedImage(id, host, f?.image ?? "", { generate });
  if (!f) return null;
  return (
    <Link href={`/p/${id}`} className="bl-item">
      <span className="bl-photo">
        <Image key={src} src={src} alt={f.name} width={480} height={480} sizes="(max-width: 860px) 50vw, 25vw" unoptimized={src.startsWith("/api/")} />
      </span>
      <b>{f.name}</b>
      <small>Från {sek(fromPrice(f))}</small>
    </Link>
  );
}

function EventCard({ slug, name, hint, scene, host }: { slug: string; name: string; hint: string; scene: string; host: string }) {
  const src = useBrandedScene(slug, host, scene);
  return (
    <Link href={`/handelse/${slug}`} className="bl-event">
      <Image key={src} src={src} alt="" width={1536} height={1024} sizes="(max-width: 860px) 80vw, 30vw" unoptimized={src.startsWith("/api/")} />
      <span>
        <b>{name}</b>
        <small>{hint}</small>
      </span>
    </Link>
  );
}

export function BrandLanding({ host, name, color, tagline, known }: { host: string; name: string; color: string; tagline: string; known: boolean }) {
  const cart = useCart();
  const router = useRouter();
  const hero = useBrandedScene("hero", host, "/scenes/hero.jpg");
  const [copied, setCopied] = useState(false);

  // A colleague who opens the link sees the whole site in the company's colours, unless they already picked another company.
  useEffect(() => {
    if (cart.ready && known && !cart.host) cart.setBrand(host, name, color);
  }, [cart, known, host, name, color]);

  const claim = (href: string) => {
    if (cart.host !== host) cart.setBrand(host, name, color);
    router.push(href);
  };

  return (
    <div className="bl" style={{ ["--brand" as string]: color }}>
      <section className="bl-hero">
        <div className="bl-copy">
          <p className="bl-pair">
            <span className="bl-logo">
              {/* eslint-disable-next-line @next/next/no-img-element -- brand logo from the API */}
              <img src={`/api/brand-logo?host=${encodeURIComponent(host)}`} alt={name} />
            </span>
            <span aria-hidden>×</span>
            <Image src="/PACH_logo.png" alt="PACH" width={2198} height={1069} className="bl-pach" />
          </p>
          <h1>Merch för {name}</h1>
          <p className="lede">
            {tagline ? `”${tagline}” – ` : ""}vi har lagt er logga på ett startkit. Allt är förslag: välj, ändra och få en skriftlig offert med 3D-korrektur.
          </p>
          <div className="bl-cta">
            <button type="button" className="drawer-save" onClick={() => claim("/kategori/klader")}>
              Se hela sortimentet med er logga
            </button>
            <button
              type="button"
              className="cta-back-quote"
              onClick={() => {
                void navigator.clipboard?.writeText(window.location.href).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                });
              }}
            >
              {copied ? "Länk kopierad ✓" : "Dela med kollegorna"}
            </button>
          </div>
          {!known ? <p className="drawer-note">Vi har inte läst in {host} än – loggan hämtas när ni går vidare.</p> : null}
        </div>
        <div className="bl-scene">
          <Image key={hero} src={hero} alt={`Profilprodukter med ${name}s logga`} width={1536} height={1024} sizes="(max-width: 860px) 100vw, 55vw" unoptimized={hero.startsWith("/api/")} priority />
        </div>
      </section>

      <section className="bl-kit">
        <div className="section-head">
          <h2>Ert startkit</h2>
          <span>Från-pris per styck, exkl. moms och tryck</span>
        </div>
        <div className="bl-grid">
          {KIT.map((id) => (
            <KitItem key={id} id={id} host={host} generate={known} />
          ))}
        </div>
      </section>

      <section className="bl-events">
        <div className="section-head">
          <h2>Vad ska {name} planera?</h2>
          <span>Hela miljön med er logga</span>
        </div>
        <div className="bl-row">
          {EVENTS.map((ev) => (
            <EventCard key={ev.slug} slug={ev.slug} name={ev.name} hint={ev.hint} scene={ev.scene} host={host} />
          ))}
        </div>
      </section>

      <section className="bl-close">
        <h2>Redo när ni är det</h2>
        <p>Skriftlig offert och 3D-korrektur innan något är bindande. Leverans i hela Sverige.</p>
        <button type="button" className="drawer-save" onClick={() => claim("/offert")}>
          Starta en offert
        </button>
      </section>
    </div>
  );
}
