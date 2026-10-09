"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrandingLoader } from "@/components/BrandingLoader";
import { useCart } from "@/components/CartProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { familyById } from "@/lib/catalog";
import { EVENTS } from "@/lib/events";
import { hostOk, normalizeHost } from "@/lib/host";

const EXAMPLES = [
  { label: "Volvo", host: "volvocars.com" },
  { label: "IKEA", host: "ikea.com" },
  { label: "Spotify", host: "spotify.com" },
];

export function HomeStudio() {
  const cart = useCart();
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [picking, setPicking] = useState(false);
  const reset = useRef(false);

  useEffect(() => {
    if (!cart.ready || reset.current) return;
    reset.current = true;
    cart.clear();
  }, [cart]);

  useEffect(() => {
    if (!picking) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setPicking(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [picking]);

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
      cart.setBrand(json.host ?? host, json.name ?? host, json.color);
      setPicking(true);
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
      cart.setBrand(json.host, json.name, json.color ?? undefined);
      setPicking(true);
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
        className="cta"
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
        <p className="kicker">Profilprodukter med er logga</p>
        <h1>Er logga. På allt.</h1>
        <p className="lede">Skriv in er webbadress så visar vi hela eventet och varje produkt med er logga – innan ni beställer.</p>
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
        {error ? (
          <p className="brandbar-err">{error}</p>
        ) : (
          <p className="cta-try">
            eller testa:{" "}
            {EXAMPLES.map((ex) => (
              <button
                key={ex.host}
                type="button"
                onClick={() => {
                  setUrl(ex.host);
                  void start(ex.host);
                }}
              >
                {ex.label}
              </button>
            ))}
          </p>
        )}
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
      </section>

      <h2 className="mosaic-title">Välj en händelse</h2>
      <div className="mosaic">
        {EVENTS.map((ev) => {
          const src = familyById(ev.hero)?.image;
          return (
            <Link key={ev.slug} href={`/handelse/${ev.slug}`} className={`tile tile-${ev.slug}`} style={{ background: ev.tone, color: ev.ink }}>
              {src ? <Image className="tile-photo" src={src} alt="" width={900} height={900} sizes="(max-width: 860px) 100vw, 45vw" /> : null}
              <span className="tile-name">{ev.name}</span>
            </Link>
          );
        })}
      </div>

      {picking ? (
        <div className="picker-veil" onClick={() => setPicking(false)}>
          <div className="picker" role="dialog" aria-modal="true" aria-labelledby="picker-title" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="picker-close" onClick={() => setPicking(false)} aria-label="Stäng">
              ×
            </button>
            <p className="kicker">Steg 2 av 3</p>
            <h2 id="picker-title">Vad ska {cart.brand || "ni"} planera?</h2>
            <p className="lede">Välj tillfälle så bygger vi miljön och tar fram produkterna som passar – med er logga.</p>
            <div className="picker-grid">
              {EVENTS.map((ev) => (
                <button key={ev.slug} type="button" className="picker-card" onClick={() => router.push(`/handelse/${ev.slug}`)}>
                  <Image src={ev.scene} alt="" width={480} height={320} sizes="(max-width: 860px) 45vw, 260px" />
                  <strong>{ev.name}</strong>
                  <span>{ev.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
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
    </div>
  );
}
