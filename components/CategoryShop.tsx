"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
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

type GenState = { loading?: boolean; image?: string; error?: boolean };

async function pool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) await worker(items[i++]);
  });
  await Promise.all(runners);
}

export function CategoryShop({ slug, name, hint, tone, items }: { slug: string; name: string; hint: string; tone: string; items: ShopItem[] }) {
  const cart = useCart();
  const [url, setUrl] = useState(cart.host);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [gen, setGen] = useState<Record<string, GenState>>({});

  const brandAll = async (host: string) => {
    setGen(Object.fromEntries(items.map((it) => [it.id, { loading: true }])));
    await pool(items, 3, async (it) => {
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: it.id, host }),
        });
        const json = await res.json();
        if (!res.ok || !json.image) throw new Error(json.error || "fail");
        setGen((prev) => ({ ...prev, [it.id]: { image: json.image } }));
        if (cart.has(it.id)) cart.setImage(it.id, json.image);
      } catch {
        setGen((prev) => ({ ...prev, [it.id]: { error: true } }));
      }
    });
  };

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
      void brandAll(json.host ?? host);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte läsa adressen.");
    } finally {
      setBusy(false);
    }
  };

  const branded = Boolean(cart.host);

  return (
    <div className="cat">
      <p className="kicker">{items.length} produkter</p>
      <h1>{name}</h1>
      <p className="lede">{hint}</p>

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
          placeholder={cart.host || "företag.se"}
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Webbadress"
        />
        <button type="submit" disabled={busy}>
          {busy ? "Läser…" : branded ? "Byt logga" : "Lägg min logga på produkterna"}
        </button>
      </form>
      {error ? <p className="brandbar-err">{error}</p> : branded ? <p className="brandbar-ok">{cart.brand} på produkterna · tryck ingår ({sek(PRINT_PER_UNIT)}/st)</p> : null}

      <ul className="goods">
        {items.map((item) => {
          const state = gen[item.id];
          const src = state?.image ?? item.image;
          const inCart = cart.has(item.id);
          const qty = cart.qtyOf(item.id);
          return (
            <li key={item.id} className={`good${inCart ? " picked" : ""}`}>
              <div className={`good-photo${state?.loading ? " loading" : ""}`} style={{ background: tone }}>
                <Image src={src} alt={item.name} width={760} height={760} sizes="(max-width: 860px) 100vw, 240px" unoptimized={Boolean(state?.image)} />
                {state?.loading ? <span className="tile-spin" aria-hidden /> : null}
                {!inCart ? (
                  <button
                    type="button"
                    className="good-add"
                    aria-label={`Lägg till ${item.name}`}
                    onClick={() => cart.add(item.id, state?.image)}
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
    </div>
  );
}
