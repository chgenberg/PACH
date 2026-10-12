"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AssortmentGrid } from "@/components/AssortmentGrid";
import { BrandConfirm } from "@/components/BrandConfirm";
import { BrandingLoader } from "@/components/BrandingLoader";
import { useCart } from "@/components/CartProvider";
import { HeroCarousel, type Slide } from "@/components/HeroCarousel";
import { LifeFrames, type Frame } from "@/components/LifeFrames";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { useBrandedScene } from "@/lib/brandedImage";
import { familyById } from "@/lib/catalog";
import { EVENTS } from "@/lib/events";
import { hostOk, normalizeHost } from "@/lib/host";

const HERO_SLIDES: Slide[] = [
  { src: "/lifestyle/stockholm.jpg", place: "Gamla stan, Stockholm", product: "Paraply Storm", href: "/p/DEMO-P029" },
  { src: "/lifestyle/skog.jpg", place: "Tyresta, morgon", product: "Hoodie Urban", href: "/p/DEMO-P004" },
  { src: "/lifestyle/skargard.jpg", place: "Skärgården, juli", product: "Keps Six", href: "/p/DEMO-P011" },
  { src: "/lifestyle/massa.jpg", place: "Mässan, Älvsjö", product: "Mässpaketet", href: "/handelse/massa" },
];

const LIFE_FRAMES: Frame[] = [
  { src: "/lifestyle/team.jpg", title: "Kick-off vid sjön", text: "Samma hoodie, samma logga – hela laget.", href: "/handelse/kickoff", cta: "Planera kick-off" },
  { src: "/lifestyle/kontor.jpg", title: "Varje morgon på kontoret", text: "Mugg och block som står kvar på skrivbordet.", href: "/kategori/kontor", cta: "Kontor" },
  { src: "/lifestyle/vinter.jpg", title: "Julklappen som används", text: "Mössa och termos genom hela vintern.", href: "/handelse/julklapp", cta: "Julgåvor" },
];

const HOW_STEPS = [
  { title: "Skriv in er webbadress", text: "Eller ladda upp er brandbook. Vi hämtar logga, färger och typsnitt automatiskt." },
  { title: "Se allt med er logga", text: "Hela eventet och varje produkt visas med just er logga – mässan, kick-offen eller julklappen." },
  { title: "Anpassa i 3D", text: "Flytta loggan, välj märkmetod, färg och antal. Priset och leveransdatumet räknas direkt." },
  { title: "Godkänn och klart", text: "Ni får en offert med 3D-korrektur att dela med teamet. Först när ni godkänner blir det en order." },
];

function PickerScene({ event, fallback, host }: { event: string; fallback: string; host: string }) {
  const src = useBrandedScene(event, host, fallback);
  return <Image src={src} alt="" width={480} height={320} sizes="(max-width: 860px) 45vw, 260px" unoptimized={src.startsWith("/api/")} />;
}

function EventTile({ slug, name, hint, scene, host }: { slug: string; name: string; hint: string; scene: string; host: string }) {
  const src = useBrandedScene(slug, host, scene);
  return (
    <Link href={`/handelse/${slug}`} className={`tile tile-${slug}`}>
      <Image key={src} className="tile-photo" src={src} alt="" width={1536} height={1024} sizes={slug === "massa" ? "(max-width: 860px) 100vw, 66vw" : "(max-width: 860px) 100vw, 33vw"} unoptimized={src.startsWith("/api/")} />
      <span className="tile-text">
        <span className="tile-name">{name}</span>
        <small>{hint}</small>
      </span>
      <span className="tile-go" aria-hidden>
        →
      </span>
    </Link>
  );
}

export function HomeStudio() {
  const cart = useCart();
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [picking, setPicking] = useState(false);
  const [how, setHow] = useState(false);
  const [confirmHost, setConfirmHost] = useState<string | null>(null);
  const returning = cart.ready && Boolean(cart.host && cart.brand);

  useEffect(() => {
    if (!picking && !how) return;
    const close = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setPicking(false);
      setHow(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [picking, how]);

  const start = async (raw: string) => {
    const host = normalizeHost(raw);
    if (!hostOk(host)) {
      setError("Skriv en webbadress, till exempel volvo.com");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: host }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Kunde inte läsa adressen.");
      setConfirmHost(json.host ?? host);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte läsa adressen.");
    } finally {
      setBusy(false);
    }
  };

  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState<{ complete: boolean } | null>(null);

  /** Upload a brand book; the agent reads it and the rest of the flow treats it like a website. */
  const readBook = async (list: FileList | null) => {
    setDragging(false);
    const files = [...(list ?? [])].filter((f) => /pdf|png|jpe?g|webp/i.test(f.type || f.name));
    if (!files.length) {
      if (list?.length) setError("Använd en PDF eller bilder (PNG, JPG, WebP).");
      return;
    }
    setError("");
    setReading({ complete: false });
    try {
      const form = new FormData();
      files.slice(0, 8).forEach((f) => form.append("files", f));
      const res = await fetch("/api/brandbook", { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Kunde inte läsa brandbooken.");
      setReading({ complete: true });
      await new Promise((r) => setTimeout(r, 700));
      setConfirmHost(json.host);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte läsa brandbooken.");
    } finally {
      setReading(null);
    }
  };

  return (
    <div className="shop">
      <SiteHeader />

      <section
        className="hero"
        onDragOver={(e) => {
          if (![...e.dataTransfer.types].includes("Files")) return;
          e.preventDefault();
          if (!dragging) setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          void readBook(e.dataTransfer.files);
        }}
      >
        <div className="cta hero-copy">
        <p className="kicker">Profilprodukter med er logga</p>
        <h1>Er logga. På allt.</h1>
        <p className="lede">
          Se er logga på allt – innan ni beställer.{" "}
          <button type="button" className="hero-more" onClick={() => setHow(true)}>
            Läs mer
          </button>
        </p>
        {returning ? (
          <div className="cta-back">
            <span className="cta-back-logo">
              {/* eslint-disable-next-line @next/next/no-img-element -- brand logo from the API */}
              <img src={`/api/brand-logo?host=${encodeURIComponent(cart.host)}`} alt="" />
            </span>
            <div className="cta-back-text">
              <b>Välkommen tillbaka, {cart.brand}</b>
              <small>{cart.count ? `${cart.count} ${cart.count === 1 ? "produkt" : "produkter"} i offerten` : "Er logga ligger redo på alla produkter"}</small>
            </div>
            <div className="cta-back-actions">
              <button type="button" className="drawer-save" onClick={() => setPicking(true)}>
                Fortsätt planera
              </button>
              {cart.count ? (
                <Link href="/offert" className="cta-back-quote">
                  Offerten ({cart.count})
                </Link>
              ) : null}
              <Link href={`/for/${encodeURIComponent(cart.host)}`} className="cta-back-quote">
                Er kampanjsida
              </Link>
              <button type="button" className="cz-link" onClick={() => cart.clear()}>
                Byt företag
              </button>
            </div>
          </div>
        ) : (
        <>
        <form
          className="cta-form"
          onSubmit={(e) => {
            e.preventDefault();
            void start(url);
          }}
        >
          <input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError("");
            }}
            placeholder="dittforetag.se"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Webbadress"
          />
          <button type="submit" disabled={busy}>
            {busy ? "Hämtar logga…" : "Starta"}
          </button>
        </form>
        {error ? <p className="brandbar-err">{error}</p> : null}
        <div className="cta-or">
          <span>eller</span>
        </div>
        <label className={`cta-book${dragging ? " is-dropping" : ""}`}>
          <input
            type="file"
            multiple
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onChange={(e) => {
              void readBook(e.target.files);
              e.target.value = "";
            }}
          />
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M6 3h8l4 4v14H6z M14 3v4h4 M12 10v7 M9 13l3-3 3 3" />
          </svg>
          <span>
            <b>{dragging ? "Släpp brandbooken här" : "Ladda upp er brandbook"}</b>
            <small>PDF eller bilder av sidorna – vi läser logga, färger och typsnitt därifrån</small>
          </span>
        </label>
        </>
        )}
        </div>
        <HeroCarousel slides={HERO_SLIDES} />
      </section>

      <AssortmentGrid />

      <LifeFrames kicker="I verkligheten" title="Merch som följer med ut" frames={LIFE_FRAMES} />

      <h2 className="mosaic-title">Välj en händelse</h2>
      <div className="mosaic">
        {EVENTS.map((ev) => (
          <EventTile key={ev.slug} slug={ev.slug} name={ev.name} hint={ev.hint} scene={ev.scene} host={cart.ready ? cart.host : ""} />
        ))}
      </div>

      <Link href="/butik/skapa" className="staff-teaser">
        <div>
          <p className="kicker">Personalbutik</p>
          <h2>Låt personalen välja själv</h2>
          <p>Ni bestämmer sortiment och budget – till exempel 3 000 kr per person. Var och en väljer de profilkläder de gillar bäst, med er logga.</p>
          <span className="staff-cta">Sätt ihop er butik →</span>
        </div>
        <div className="staff-pics" aria-hidden>
          {["DEMO-P004", "DEMO-P006", "DEMO-P011"].map((id) => {
            const src = familyById(id)?.image;
            return src ? <Image key={id} src={src} alt="" width={360} height={360} /> : null;
          })}
        </div>
      </Link>

      {how ? (
        <div className="picker-veil" onClick={() => setHow(false)}>
          <div className="picker how" role="dialog" aria-modal="true" aria-labelledby="how-title" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="picker-close" onClick={() => setHow(false)} aria-label="Stäng">
              ×
            </button>
            <p className="kicker">Så funkar det</p>
            <h2 id="how-title">Från webbadress till färdig merch</h2>
            <ol className="how-steps">
              {HOW_STEPS.map((s, i) => (
                <li key={s.title}>
                  <span className="how-n">{i + 1}</span>
                  <div>
                    <b>{s.title}</b>
                    <p>{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <ul className="how-promise">
              <li>Skriftlig offert</li>
              <li>3D-korrektur före tryck</li>
              <li>Inget är bindande förrän ni godkänt</li>
            </ul>
            <button
              type="button"
              className="drawer-save how-go"
              onClick={() => {
                setHow(false);
                requestAnimationFrame(() => document.querySelector<HTMLInputElement>(".cta-form input")?.focus());
              }}
            >
              Kom igång
            </button>
          </div>
        </div>
      ) : null}

      {picking ? (
        <div className="picker-veil" onClick={() => setPicking(false)}>
          <div className="picker" role="dialog" aria-modal="true" aria-labelledby="picker-title" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="picker-close" onClick={() => setPicking(false)} aria-label="Stäng">
              ×
            </button>
            <p className="kicker">Steg 3 av 4</p>
            <h2 id="picker-title">Vad ska {cart.brand || "ni"} planera?</h2>
            <p className="lede">Välj tillfälle så bygger vi miljön och tar fram produkterna som passar – med er logga.</p>
            <div className="picker-grid">
              {EVENTS.map((ev) => (
                <button key={ev.slug} type="button" className="picker-card" onClick={() => router.push(`/handelse/${ev.slug}`)}>
                  <PickerScene event={ev.slug} fallback={ev.scene} host={cart.host} />
                  <strong>{ev.name}</strong>
                  <span>{ev.hint}</span>
                </button>
              ))}
              <button type="button" className="picker-card picker-staff" onClick={() => router.push("/butik/skapa")}>
                <Image src={familyById("DEMO-P004")?.image ?? ""} alt="" width={480} height={320} sizes="(max-width: 860px) 45vw, 260px" />
                <strong>Personalbutik</strong>
                <span>Personalen väljer själv inom en budget</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmHost ? (
        <BrandConfirm
          host={confirmHost}
          onClose={() => setConfirmHost(null)}
          onDone={(b) => {
            cart.setBrand(b.host, b.name, b.color);
            setConfirmHost(null);
            setPicking(true);
          }}
        />
      ) : null}

      {reading ? (
        <BrandingLoader
          name="brandbooken"
          sub="Agenten läser brandbooken, hittar och granskar loggan och tolkar färger, typsnitt och regler."
          stages={["Läser brandbookens sidor…", "Hittar den primära loggan…", "Läser färger och typsnitt…", "Tolkar bildspråk och regler…", "Granskar loggan…", "Sista detaljerna…"]}
          done={0}
          total={1}
          complete={reading.complete}
        />
      ) : null}

      <SiteFooter />
    </div>
  );
}
