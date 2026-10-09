"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BrandingLoader } from "@/components/BrandingLoader";
import { useCart } from "@/components/CartProvider";
import { familyById } from "@/lib/catalog";
import { EVENTS } from "@/lib/events";
import { hostOk, normalizeHost } from "@/lib/host";

type Run = { name: string; done: number; total: number; complete: boolean };

const STAGES = ["Läser er webbplats…", "Hämtar logga och färger…", "Lägger loggan på produkterna…", "Bygger studiobilden…", "Kvalitetsgranskar bilderna…", "Sista detaljerna…"];

const postImage = (url: string, body: object) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then(async (res) => {
      const json = await res.json();
      return res.ok && typeof json.image === "string" ? (json.image as string) : null;
    })
    .catch(() => null);

export function HomeStudio() {
  const cart = useCart();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [run, setRun] = useState<Run | null>(null);
  const [hero, setHero] = useState<string | null>(null);
  const [tiles, setTiles] = useState<Record<string, string>>({});
  const brandedFor = useRef("");

  const brandAll = useCallback(async (host: string, company: string) => {
    const jobs = EVENTS.flatMap((ev) => {
      const family = familyById(ev.hero);
      return family ? [{ slug: ev.slug as string, id: family.id }] : [];
    });
    let done = 0;
    const tick = () => {
      done += 1;
      setRun((r) => (r ? { ...r, done } : r));
    };
    setRun({ name: company, done: 0, total: jobs.length + 1, complete: false });
    const found: Record<string, string> = {};
    let scene: string | null = null;
    await Promise.all([
      postImage("/api/scene", { event: "hero", host }).then((img) => {
        scene = img;
        tick();
      }),
      ...jobs.map(async (j) => {
        const img = await postImage("/api/generate", { productId: j.id, host });
        if (img) found[j.slug] = img;
        tick();
      }),
    ]);
    setRun((r) => (r ? { ...r, complete: true } : r));
    await new Promise((r) => setTimeout(r, 900));
    setHero(scene);
    setTiles(found);
    setRun(null);
  }, []);

  useEffect(() => {
    if (!cart.host || brandedFor.current === cart.host) return;
    brandedFor.current = cart.host;
    void brandAll(cart.host, cart.brand || cart.host);
  }, [cart.host, cart.brand, brandAll]);

  const apply = async () => {
    const host = normalizeHost(url);
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
      cart.setBrand(json.host ?? host, json.name ?? host);
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte läsa adressen.");
    } finally {
      setBusy(false);
    }
  };

  const branded = Boolean(cart.host);

  return (
    <div className="shop">
      <header className="shop-bar">
        <Link href="/" className="shop-logo" aria-label="PACH">
          <Image src="/PACH_logo.png" alt="PACH profile" width={2198} height={1069} priority />
        </Link>
      </header>

      <section className="evhero home-hero">
        <div className="evhero-text">
          <p className="kicker">Profilprodukter med er logga</p>
          <h1>{branded && cart.brand ? `Så här ser ${cart.brand} ut på allt.` : "Se er logga på allt – innan ni beställer."}</h1>
          <p className="lede">Välj tillfälle, ange er webbadress och se hela miljön och varje produkt med er logga. Offert inklusive tryck på några minuter.</p>
          <ol className="steps">
            <li>Välj händelse</li>
            <li>Ange webbadress</li>
            <li>Välj produkter och få offert</li>
          </ol>
          <form
            className="brandbar"
            onSubmit={(e) => {
              e.preventDefault();
              void apply();
            }}
          >
            <input
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError("");
              }}
              placeholder={cart.host || "dittforetag.se"}
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Webbadress"
            />
            <button type="submit" disabled={busy || Boolean(run)}>
              {busy ? "Läser…" : branded ? "Byt logga" : "Visa med min logga"}
            </button>
          </form>
          {error ? <p className="brandbar-err">{error}</p> : branded ? <p className="brandbar-ok">{cart.brand} på alla bilder. Välj en händelse nedan.</p> : null}
        </div>
        <div className="evhero-scene">
          <Image key={hero ?? "hero"} src={hero ?? "/scenes/hero.jpg"} alt="Profilprodukter med logga" width={1536} height={1024} sizes="(max-width: 860px) 100vw, 55vw" unoptimized={Boolean(hero)} priority />
        </div>
      </section>

      <h2 className="mosaic-title">Välj en händelse</h2>
      <div className="mosaic">
        {EVENTS.map((ev) => {
          const src = tiles[ev.slug] ?? familyById(ev.hero)?.image;
          return (
            <Link key={ev.slug} href={`/handelse/${ev.slug}`} className={`tile tile-${ev.slug}`} style={{ background: ev.tone, color: ev.ink }}>
              {src ? <Image key={src} className="tile-photo" src={src} alt="" width={900} height={900} sizes="(max-width: 860px) 100vw, 45vw" unoptimized={Boolean(tiles[ev.slug])} /> : null}
              <span className="tile-name">{ev.name}</span>
            </Link>
          );
        })}
      </div>

      {run ? <BrandingLoader name={run.name} stages={STAGES} done={run.done} total={run.total} complete={run.complete} /> : null}
    </div>
  );
}
