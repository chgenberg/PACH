"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BrandingLoader } from "@/components/BrandingLoader";
import { useCart } from "@/components/CartProvider";
import { hostOk, normalizeHost } from "@/lib/host";
import { PRINT_PER_UNIT, sek } from "@/lib/pricing";

export type ShopItem = {
  id: string;
  name: string;
  subcategory: string;
  image: string;
  from: number;
  colors: string[];
};

type Run = { name: string; done: number; total: number; complete: boolean };

async function pool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) await worker(items[i++]);
  });
  await Promise.all(runners);
}

const postImage = (url: string, body: object) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then(async (res) => {
      const json = await res.json();
      return res.ok && typeof json.image === "string" ? (json.image as string) : null;
    })
    .catch(() => null);

export function CategoryShop({
  slug,
  name,
  hint,
  tone,
  scene,
  stages,
  items,
}: {
  slug: string;
  name: string;
  hint: string;
  tone: string;
  scene: string;
  stages: string[];
  items: ShopItem[];
}) {
  const cart = useCart();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [run, setRun] = useState<Run | null>(null);
  const [images, setImages] = useState<Record<string, string>>({});
  const [sceneSrc, setSceneSrc] = useState<string | null>(null);
  const brandedFor = useRef("");

  const brandAll = useCallback(
    async (host: string, company: string) => {
      let done = 0;
      const tick = () => {
        done += 1;
        setRun((r) => (r ? { ...r, done } : r));
      };
      setRun({ name: company, done: 0, total: items.length + 1, complete: false });
      const found: Record<string, string> = {};
      let branded: string | null = null;
      await Promise.all([
        postImage("/api/scene", { event: slug, host }).then((img) => {
          branded = img;
          tick();
        }),
        pool(items, 6, async (it) => {
          const img = await postImage("/api/generate", { productId: it.id, host });
          if (img) found[it.id] = img;
          tick();
        }),
      ]);
      setRun((r) => (r ? { ...r, complete: true } : r));
      await new Promise((r) => setTimeout(r, 900));
      setSceneSrc(branded);
      setImages(found);
      for (const [id, img] of Object.entries(found)) cart.setImage(id, img);
      setRun(null);
    },
    [items, slug, cart],
  );

  useEffect(() => {
    if (!cart.host || brandedFor.current === cart.host) return;
    brandedFor.current = cart.host;
    void brandAll(cart.host, cart.brand || cart.host);
  }, [cart.host, cart.brand, brandAll]);

  const submit = async () => {
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
    <div className="cat">
      <section className="evhero">
        <div className="evhero-text">
          <p className="kicker">
            {items.length} produkter · {name}
          </p>
          <h1>{branded && cart.brand ? `${name} för ${cart.brand}` : name}</h1>
          <p className="lede">
            {hint}. Ange er webbadress så lägger vi er logga på hela miljön och på varje produkt.
          </p>
          <form
            className="brandbar"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
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
              {busy ? "Läser…" : branded ? "Byt logga" : "Skapa med min logga"}
            </button>
          </form>
          {error ? (
            <p className="brandbar-err">{error}</p>
          ) : branded ? (
            <p className="brandbar-ok">
              {cart.brand} på produkterna · tryck ingår ({sek(PRINT_PER_UNIT)}/st)
            </p>
          ) : null}
        </div>
        <div className="evhero-scene">
          <Image key={sceneSrc ?? scene} src={sceneSrc ?? scene} alt={`${name} med ${sceneSrc ? cart.brand : "din"} logga`} width={1536} height={1024} sizes="(max-width: 860px) 100vw, 55vw" unoptimized={Boolean(sceneSrc)} priority />
        </div>
      </section>

      <ul className="goods">
        {items.map((item) => {
          const brandedImage = images[item.id];
          const src = brandedImage ?? item.image;
          const inCart = cart.has(item.id);
          const qty = cart.qtyOf(item.id);
          return (
            <li key={item.id} className={`good${inCart ? " picked" : ""}`}>
              <div className="good-photo" style={{ background: tone }}>
                <Image key={src} src={src} alt={item.name} width={760} height={760} sizes="(max-width: 860px) 100vw, 240px" unoptimized={Boolean(brandedImage)} />
                {!inCart ? (
                  <button
                    type="button"
                    className="good-add"
                    aria-label={`Lägg till ${item.name}`}
                    onClick={() => cart.add(item.id, brandedImage)}
                  >
                    +
                  </button>
                ) : (
                  <span className="good-check" aria-hidden>
                    ✓
                  </span>
                )}
                <span className="good-colors">
                  {item.colors.map((hex, i) => (
                    <i key={i} style={{ background: hex }} />
                  ))}
                </span>
              </div>
              <strong>{item.name}</strong>
              <span>{item.subcategory}</span>
              <em>från {item.from} kr{branded ? " + tryck" : ""}</em>

              {inCart ? (
                <div className="stepper" role="group" aria-label={`Antal ${item.name}`}>
                  <button type="button" onClick={() => cart.setQty(item.id, qty - 10)} aria-label="Färre">
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={qty}
                    onChange={(e) => cart.setQty(item.id, Number(e.target.value) || 1)}
                  />
                  <button type="button" onClick={() => cart.setQty(item.id, qty + 10)} aria-label="Fler">
                    +
                  </button>
                  <button type="button" className="stepper-x" onClick={() => cart.remove(item.id)} aria-label="Ta bort">
                    Ta bort
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {cart.count > 0 ? (
        <div className="cartbar">
          <span>
            {cart.count} {cart.count === 1 ? "produkt" : "produkter"} vald{cart.count === 1 ? "" : "a"}
          </span>
          <Link href="/offert" className="cartbar-go">
            Till offert →
          </Link>
        </div>
      ) : null}

      {run ? <BrandingLoader name={run.name} stages={stages} done={run.done} total={run.total} complete={run.complete} /> : null}
    </div>
  );
}
