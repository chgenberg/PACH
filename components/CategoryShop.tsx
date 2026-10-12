"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrandingLoader } from "@/components/BrandingLoader";
import { useCart } from "@/components/CartProvider";
import { DEMO_GREETING } from "@/components/DemoStart";
import { FavoriteButton } from "@/components/FavoriteButton";
import { Packages } from "@/components/Packages";
import { ProductDrawer } from "@/components/ProductDrawer";
import { isEventId } from "@/lib/eventAgent";
import { hostOk, isBrandbookHost, normalizeHost } from "@/lib/host";
import { PRINT_PER_UNIT, sek } from "@/lib/pricing";
import type { ShopItem } from "@/lib/shopItem";

export type { ShopItem };

type Run = { name: string; done: number; total: number; complete: boolean };

export type LifestylePhoto = { product: string; caption: string };

/** Grid positions (before product n) where the two lifestyle photos are mixed in. */
const PHOTO_SLOTS = [2, 9];

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
  scene,
  stages,
  photos = [],
  items,
  sceneEvent,
}: {
  slug: string;
  name: string;
  hint: string;
  scene: string;
  stages: string[];
  photos?: LifestylePhoto[];
  items: ShopItem[];
  /** Which branded scene to ask for when the page is not an event, e.g. "hero" for categories. */
  sceneEvent?: string;
}) {
  const cart = useCart();
  const { setImage } = cart;
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [run, setRun] = useState<Run | null>(null);
  const [images, setImages] = useState<Record<string, string>>({});
  const [sceneSrc, setSceneSrc] = useState<string | null>(null);
  const [lifestyle, setLifestyle] = useState<(string | null)[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const brandedFor = useRef("");
  const [spots, setSpots] = useState<{ for: string; list: { productId: string; x: number; y: number }[] }>({ for: "", list: [] });
  const shownScene = sceneSrc ?? scene;
  const [greeting, setGreeting] = useState<{ contact: string; brand: string } | null>(null);
  useEffect(() => {
    const raw = sessionStorage.getItem(DEMO_GREETING);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is only readable after hydration
    if (raw) setGreeting(JSON.parse(raw));
  }, []);
  const [ideas, setIdeas] = useState<{ for: string; list: { productId: string; reason: string }[] }>({ for: "", list: [] });

  useEffect(() => {
    if (!cart.host || !isEventId(slug)) return;
    let alive = true;
    const host = cart.host;
    fetch("/api/ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ host, event: slug }) })
      .then((r) => r.json())
      .then((j) => alive && Array.isArray(j.ideas) && setIdeas({ for: host, list: j.ideas }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [cart.host, slug]);

  useEffect(() => {
    if (!isEventId(slug)) return;
    let alive = true;
    fetch("/api/hotspots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: slug, image: shownScene }) })
      .then((r) => r.json())
      .then((j) => {
        if (alive && Array.isArray(j.spots)) setSpots({ for: shownScene, list: j.spots });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [slug, shownScene]);

  const brandAll = useCallback(
    async (host: string, company: string) => {
      let done = 0;
      const tick = () => {
        done += 1;
        setRun((r) => (r ? { ...r, done } : r));
      };
      setRun({ name: company, done: 0, total: items.length + photos.length + 1, complete: false });
      setImages({});
      setSceneSrc(null);
      setLifestyle([]);
      await Promise.all([
        Promise.all(
          photos.map((_, index) =>
            postImage("/api/photo", { event: slug, index, host }).then((img) => {
              tick();
              setLifestyle((l) => Object.assign([...l], { [index]: img }));
            }),
          ),
        ),
        postImage("/api/scene", { event: sceneEvent ?? slug, host }).then((img) => {
          tick();
          if (img) setSceneSrc(img);
        }),
        pool(items, 6, async (it) => {
          const img = await postImage("/api/generate", { productId: it.id, host });
          tick();
          if (!img) return;
          setImages((m) => ({ ...m, [it.id]: img }));
          setImage(it.id, img);
        }),
      ]);
      setRun((r) => (r ? { ...r, complete: true } : r));
      await new Promise((r) => setTimeout(r, 2400));
      setRun(null);
    },
    [items, photos, slug, sceneEvent, setImage],
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
      cart.setBrand(json.host ?? host, json.name ?? host, json.color);
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte läsa adressen.");
    } finally {
      setBusy(false);
    }
  };

  const branded = Boolean(cart.host);
  const [sub, setSub] = useState("alla");
  const [color, setColor] = useState("alla");
  const [brand, setBrand] = useState("alla");
  const [method, setMethod] = useState("alla");
  const [sort, setSort] = useState<"nyast" | "az" | "pris">("nyast");

  const subs = useMemo(() => [...new Set(items.map((i) => i.subcategory))].sort((a, b) => a.localeCompare(b, "sv")), [items]);
  const brands = useMemo(() => [...new Set(items.map((i) => i.brand).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "sv")), [items]);
  const methods = useMemo(() => [...new Set(items.flatMap((i) => i.methods ?? []))].sort((a, b) => a.localeCompare(b, "sv")), [items]);
  const colorOpts = useMemo(() => {
    const seen = new Map<string, string>();
    for (const item of items) {
      item.colorNames?.forEach((name, i) => {
        if (!seen.has(name)) seen.set(name, item.colors[i] ?? item.colors[0] ?? "#111");
      });
    }
    return [...seen.entries()];
  }, [items]);

  const shown = useMemo(() => {
    const next = items.filter((item) => {
      if (sub !== "alla" && item.subcategory !== sub) return false;
      if (brand !== "alla" && item.brand !== brand) return false;
      if (method !== "alla" && !(item.methods ?? []).includes(method)) return false;
      if (color !== "alla" && !(item.colorNames ?? []).includes(color)) return false;
      return true;
    });
    next.sort((a, b) => {
      if (sort === "az") return a.name.localeCompare(b.name, "sv");
      if (sort === "pris") return a.from - b.from;
      return b.id.localeCompare(a.id);
    });
    return next;
  }, [items, sub, brand, method, color, sort]);

  return (
    <div className="cat">
      {greeting && greeting.brand === cart.brand ? (
        <p className="demo-hello">
          {greeting.contact ? `Hej ${greeting.contact}! ` : ""}Vi har förberett {name.toLowerCase()} för {greeting.brand} – allt nedan är på riktigt och kan beställas direkt.
        </p>
      ) : null}
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
              placeholder={cart.host && !isBrandbookHost(cart.host) ? cart.host : "dittforetag.se"}
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
          {!run && spots.for === (sceneSrc ?? scene)
            ? spots.list.map((s, i) => {
                const item = items.find((it) => it.id === s.productId);
                if (!item) return null;
                return (
                  <button
                    key={s.productId}
                    type="button"
                    className={`hotspot${cart.has(s.productId) ? " is-in" : ""}${s.y < 0.22 ? " is-high" : ""}${s.x > 0.78 ? " is-right" : s.x < 0.22 ? " is-left" : ""}`}
                    style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%`, animationDelay: `${i * 0.25}s` }}
                    onClick={() => setOpen(s.productId)}
                    aria-label={`${item.name} – visa produkten`}
                  >
                    <span className="hotspot-label">
                      {item.name}
                      <small>från {sek(item.from)}</small>
                    </span>
                  </button>
                );
              })
            : null}
        </div>
      </section>

      {ideas.for === cart.host && ideas.list.length ? (
        <section className="ideas">
          <h2>Utvalt för {cart.brand || cart.host}</h2>
          <p className="drawer-note">Vår agent har läst på om er verksamhet och valt det som passar er bäst.</p>
          <div className="ideas-grid">
            {ideas.list.map((idea) => {
              const item = items.find((it) => it.id === idea.productId);
              if (!item) return null;
              const src = images[item.id] ?? item.image;
              return (
                <button key={idea.productId} type="button" className="idea" onClick={() => setOpen(item.id)}>
                  <Image src={src} alt={item.name} width={320} height={320} unoptimized={src.startsWith("/api/")} />
                  <span>
                    <b>{item.name}</b>
                    <small>{idea.reason}</small>
                    <em>från {sek(item.from)} · {cart.has(item.id) ? "Tillagd ✓" : "Lägg till +"}</em>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {isEventId(slug) ? <Packages event={slug} images={images} /> : null}

      <div className="goods-head">
        <h2 className="goods-title">Alla produkter</h2>
        <p className="goods-count">{shown.length} av {items.length}</p>
      </div>
      <div className="filters">
        <label>
          <span>Kategori</span>
          <select value={sub} onChange={(e) => setSub(e.target.value)}>
            <option value="alla">Alla kategorier</option>
            {subs.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Färg</span>
          <select value={color} onChange={(e) => setColor(e.target.value)}>
            <option value="alla">Alla färger</option>
            {colorOpts.map(([name]) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        {brands.length > 1 ? (
          <label>
            <span>Varumärke</span>
            <select value={brand} onChange={(e) => setBrand(e.target.value)}>
              <option value="alla">Alla varumärken</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label>
          <span>Märkning</span>
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="alla">Alla metoder</option>
            {methods.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Sorterat på</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="nyast">Nyast</option>
            <option value="az">A–Ö</option>
            <option value="pris">Pris</option>
          </select>
        </label>
      </div>
      <ul className="goods">
        {shown.map((item, index) => {
          const line = cart.itemOf(item.id);
          const brandedImage = images[item.id];
          const src = (line?.color && line.image) || brandedImage || item.image;
          const inCart = Boolean(line);
          const qty = cart.qtyOf(item.id);
          const slot = PHOTO_SLOTS.indexOf(index);
          const shot = slot >= 0 ? lifestyle[slot] : null;
          const shotOf = slot >= 0 ? photos[slot] : null;
          return (
            <Fragment key={item.id}>
              {shot && shotOf ? (
                <li className="good-life">
                  <Image src={shot} alt={shotOf.caption} width={1536} height={1024} sizes="(max-width: 860px) 100vw, 50vw" unoptimized />
                  <div className="good-life-cap">
                    <span>{shotOf.caption}</span>
                    {cart.has(shotOf.product) ? (
                      <em>Tillagd ✓</em>
                    ) : (
                      <button type="button" onClick={() => setOpen(shotOf.product)}>
                        + Lägg till produkten
                      </button>
                    )}
                  </div>
                </li>
              ) : null}
            <li className={`good${inCart ? " picked" : ""}`}>
              <div className="good-photo">
                <Link href={`/p/${item.id}`}>
                  <Image key={src} src={src} alt={item.name} width={760} height={760} sizes="(max-width: 860px) 100vw, 240px" unoptimized={src.startsWith("/api/")} />
                </Link>
                <FavoriteButton id={item.id} name={item.name} compact />
                {!inCart ? (
                  <button type="button" className="good-add" aria-label={`Lägg till ${item.name}`} onClick={() => setOpen(item.id)}>
                    +
                  </button>
                ) : (
                  <button type="button" className="good-check" aria-label={`Ändra ${item.name}`} title="Ändra färg och antal" onClick={() => setOpen(item.id)}>
                    ✓
                  </button>
                )}
                <span className="good-colors">
                  {(line?.color ? [line.color] : item.colors).map((hex, i) => (
                    <i key={i} style={{ background: hex }} />
                  ))}
                </span>
              </div>
              <Link href={`/p/${item.id}`} className="good-name">
                <strong>{item.name}</strong>
              </Link>
              <span>{item.subcategory}</span>
              <em>Från {sek(item.from)} exkl. moms · inkl. tryck</em>

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
            </Fragment>
          );
        })}
      </ul>

      <Link href="/butik/skapa" className="staff-teaser shop-inline">
        <div>
          <p className="kicker">Personalbutik</p>
          <h2>Låt personalen välja själv</h2>
          <p>Ni sätter sortiment och budget. Var och en väljer, med er logga.</p>
          <span className="staff-cta">Sätt ihop er butik →</span>
        </div>
      </Link>

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

      {open ? <ProductDrawer key={open} productId={open} baseImage={images[open] ?? items.find((i) => i.id === open)?.image ?? ""} onClose={() => setOpen(null)} /> : null}

      {run ? <BrandingLoader inline name={run.name} stages={stages} done={run.done} total={run.total} complete={run.complete} /> : null}
    </div>
  );
}
