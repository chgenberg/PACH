"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCart } from "@/components/CartProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { families, type Family } from "@/lib/catalog";
import { BASE_COLOR, colorName, suggestions } from "@/lib/colors";
import { hostOk, normalizeHost } from "@/lib/host";
import { defaultDesign } from "@/lib/marking";
import { priceLine, sek } from "@/lib/pricing";

const STORE_QTY = 50;
const TABS = [
  { id: "klader", label: "Kläder", test: (f: Family) => f.shop === "klader" || f.id === "DEMO-P010" },
  { id: "vaskor", label: "Väskor", test: (f: Family) => f.shop === "vaskor" },
  { id: "kontor", label: "Mugg & kontor", test: (f: Family) => f.shop === "kontor" || f.shop === "pennor" },
  { id: "tech", label: "Tech", test: (f: Family) => f.shop === "elektronik" },
  { id: "ovrigt", label: "Övrigt", test: (f: Family) => ["paraplyer", "massa-event", "sakerhet", "godis"].includes(f.shop) && !["DEMO-P040", "DEMO-P010"].includes(f.id) },
] as const;
const STARTER = ["DEMO-P002", "DEMO-P004", "DEMO-P006", "DEMO-P011", "DEMO-P012", "DEMO-P015", "DEMO-P019"];
const unit = (f: Family) => priceLine(f, STORE_QTY, defaultDesign(f)).unitInclPrint;

const post = (url: string, body: object) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then(async (r) => ({ ok: r.ok, json: await r.json().catch(() => ({})) }))
    .catch(() => ({ ok: false, json: {} as Record<string, unknown> }));

export function StoreBuilder() {
  const cart = useCart();
  const [site, setSite] = useState("");
  const [brand, setBrand] = useState("");
  const [reading, setReading] = useState(false);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("klader");
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [images, setImages] = useState<Record<string, string>>({});
  const [budget, setBudget] = useState("3000");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [links, setLinks] = useState<{ store: string; admin: string } | null>(null);
  const [copied, setCopied] = useState("");
  const jobs = useRef(new Map<string, Promise<string | null>>());

  const host = cart.host;
  const company = brand || cart.brand;
  const budgetSek = Number(budget.replace(/\D/g, "")) || 0;
  const chosen = families.filter((f) => picked[f.id]);
  const avg = chosen.length ? chosen.reduce((s, f) => s + unit(f), 0) / chosen.length : 0;
  const swatches = suggestions(cart.brandColor);

  /** Branded photo in the chosen colour; started as soon as a product is picked so it is ready when the store opens. */
  const ensure = useCallback(
    (id: string, hex: string) => {
      if (!host) return Promise.resolve(null);
      const key = `${id}|${hex}`;
      const known = jobs.current.get(key);
      if (known) return known;
      const job = (async () => {
        const base = await post("/api/generate", { productId: id, host });
        let img = base.ok ? (base.json.image as string) : null;
        if (img && hex !== BASE_COLOR) {
          const re = await post("/api/recolor", { productId: id, hex, host });
          img = re.ok ? (re.json.image as string) : img;
        }
        if (img) setImages((x) => ({ ...x, [key]: img! }));
        return img;
      })();
      jobs.current.set(key, job);
      return job;
    },
    [host],
  );

  useEffect(() => {
    for (const [id, hex] of Object.entries(picked)) void ensure(id, hex);
  }, [picked, ensure]);

  const readSite = async () => {
    const h = normalizeHost(site);
    if (!hostOk(h)) return setError("Skriv er webbadress, t.ex. volvo.com");
    setReading(true);
    setError("");
    const res = await post("/api/profile", { url: h });
    setReading(false);
    if (!res.ok) return setError((res.json.error as string) || "Kunde inte läsa adressen.");
    const found = (res.json.host as string) ?? h;
    cart.setBrand(found, (res.json.name as string) ?? h, res.json.color as string | undefined);
    setBrand((res.json.name as string) ?? "");
    jobs.current.clear();
    setImages({});
    // The verified brand colour and name come from the site analysis, which can take a moment the first time.
    const brandInfo = await fetch(`/api/brand?host=${encodeURIComponent(found)}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    if (brandInfo?.color) {
      cart.setBrand(found, brandInfo.name || (res.json.name as string) || h, brandInfo.color);
      if (brandInfo.name) setBrand(brandInfo.name);
    }
  };

  const toggle = (id: string) =>
    setPicked((p) => {
      if (p[id]) {
        const rest = { ...p };
        delete rest[id];
        return rest;
      }
      return { ...p, [id]: BASE_COLOR };
    });

  const create = async () => {
    setError("");
    if (!company.trim()) return setError("Ange företagets namn eller webbadress.");
    if (chosen.length < 2) return setError("Välj minst två produkter.");
    setBusy(true);
    try {
      const imgs = await Promise.all(chosen.map((f) => ensure(f.id, picked[f.id])));
      const res = await post("/api/store", {
        host: host || undefined,
        brand: company,
        title,
        budget: budgetSek,
        products: chosen.map((f, i) => ({ productId: f.id, color: picked[f.id], image: imgs[i] ?? undefined })),
      });
      if (!res.ok) throw new Error((res.json.error as string) || "Kunde inte skapa butiken.");
      const origin = window.location.origin;
      setLinks({ store: `${origin}${res.json.store}`, admin: `${origin}${res.json.admin}` });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte skapa butiken.");
    } finally {
      setBusy(false);
    }
  };

  const copy = (t: string) => {
    void navigator.clipboard?.writeText(t).catch(() => {});
    setCopied(t);
    setTimeout(() => setCopied(""), 1800);
  };

  if (links) {
    return (
      <div className="shop">
        <SiteHeader back={{ href: "/", label: "Till startsidan" }} />
        <div className="cat sb-done">
          <div className="offer-thanks-mark" aria-hidden>
            ✓
          </div>
          <h1>{title || `${company} Store`} är öppen</h1>
          <p className="lede">Skicka butikslänken till personalen. Var och en väljer det de gillar inom {sek(budgetSek)}. Adminlänken är bara för dig – spara den.</p>
          <div className="sb-links">
            <div>
              <span>Till personalen</span>
              <code>{links.store.replace(/^https?:\/\//, "")}</code>
              <button type="button" className="offer-submit" onClick={() => copy(links.store)}>
                {copied === links.store ? "Kopierad ✓" : "Kopiera butikslänk"}
              </button>
            </div>
            <div>
              <span>Din adminsida</span>
              <code>{links.admin.replace(/^https?:\/\//, "")}</code>
              <button type="button" className="offer-share" onClick={() => copy(links.admin)}>
                {copied === links.admin ? "Kopierad ✓" : "Kopiera adminlänk"}
              </button>
            </div>
          </div>
          <p className="sb-open">
            <Link href={links.store.replace(window.location.origin, "")} target="_blank">
              Öppna butiken
            </Link>{" "}
            ·{" "}
            <Link href={links.admin.replace(window.location.origin, "")} target="_blank">
              Öppna adminsidan
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="shop">
      <SiteHeader back={{ href: "/", label: "Till startsidan" }} />
      <div className="cat sb">
        <p className="kicker">Personalbutik</p>
        <h1>Låt personalen välja själv</h1>
        <p className="lede">Ni bestämmer sortiment och budget. Varje anställd får en länk och väljer de profilkläder de gillar bäst – med er logga.</p>

        <section className="sb-step">
          <h2>
            <i>1</i> Företaget
          </h2>
          {host && company ? (
            <div className="sb-brand">
              {/* eslint-disable-next-line @next/next/no-img-element -- same-origin logo */}
              <img src={`/api/brand-logo?host=${encodeURIComponent(host)}`} alt="" />
              <input value={company} onChange={(e) => setBrand(e.target.value)} aria-label="Företagsnamn" />
              <button
                type="button"
                className="cz-link"
                onClick={() => {
                  cart.setBrand("", "");
                  setBrand("");
                  setImages({});
                  jobs.current.clear();
                }}
              >
                Byt företag
              </button>
            </div>
          ) : (
            <form
              className="brandbar sb-site"
              onSubmit={(e) => {
                e.preventDefault();
                void readSite();
              }}
            >
              <input value={site} onChange={(e) => setSite(e.target.value)} placeholder="dittforetag.se" inputMode="url" autoCapitalize="none" aria-label="Webbadress" />
              <button type="submit" disabled={reading}>
                {reading ? "Läser…" : "Hämta logga"}
              </button>
            </form>
          )}
        </section>

        <section className="sb-step">
          <h2>
            <i>2</i> Sortiment <span>{chosen.length} valda</span>
          </h2>
          <div className="sb-toolbar">
            <div className="seg">
              {TABS.map((t) => (
                <button key={t.id} type="button" aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
                  {t.label} <small>{families.filter((f) => t.test(f) && picked[f.id]).length || ""}</small>
                </button>
              ))}
            </div>
            {!chosen.length ? (
              <button type="button" className="cz-link" onClick={() => setPicked(Object.fromEntries(STARTER.map((id) => [id, BASE_COLOR])))}>
                Föreslå ett sortiment
              </button>
            ) : (
              <button type="button" className="cz-link" onClick={() => setPicked({})}>
                Rensa
              </button>
            )}
          </div>
          <div className="sb-grid">
            {families
              .filter((f) => TABS.find((t) => t.id === tab)!.test(f))
              .map((f) => {
                const hex = picked[f.id];
                const src = (hex && images[`${f.id}|${hex}`]) || images[`${f.id}|${BASE_COLOR}`] || f.image;
                const loading = Boolean(hex && host && !images[`${f.id}|${hex}`]);
                return (
                  <article key={f.id} className={`sb-item${hex ? " is-on" : ""}`}>
                    <button type="button" className="sb-pick" onClick={() => toggle(f.id)} aria-pressed={Boolean(hex)}>
                      <Image src={src} alt={f.name} width={300} height={300} unoptimized={src.startsWith("/api/")} />
                      {loading ? <span className="sb-busy loader-spin" aria-hidden /> : null}
                      <span className="sb-check" aria-hidden>
                        {hex ? "✓" : "+"}
                      </span>
                    </button>
                    <b>{f.name}</b>
                    <small>{sek(unit(f))} inkl. logga</small>
                    {hex ? (
                      <div className="swatches sb-swatches">
                        {swatches.map((s) => (
                          <button
                            key={s.hex}
                            type="button"
                            className="swatch"
                            title={s.name}
                            aria-label={s.name}
                            aria-pressed={hex === s.hex.toUpperCase()}
                            style={{ background: s.hex }}
                            onClick={() => setPicked((p) => ({ ...p, [f.id]: s.hex.toUpperCase() }))}
                          />
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
          </div>
        </section>

        <section className="sb-step">
          <h2>
            <i>3</i> Budget och namn
          </h2>
          <div className="sb-budget">
            <label>
              <span>Budget per anställd</span>
              <div className="sb-presets">
                {[1500, 3000, 5000].map((b) => (
                  <button key={b} type="button" aria-pressed={budgetSek === b} onClick={() => setBudget(String(b))}>
                    {sek(b)}
                  </button>
                ))}
                <input value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="numeric" aria-label="Egen budget" />
              </div>
            </label>
            <label>
              <span>Butikens namn</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${company || "Företaget"} Store`} />
            </label>
          </div>
          {chosen.length && budgetSek ? (
            <p className="sb-hint">
              Med {sek(budgetSek)} väljer varje anställd i snitt ca <b>{Math.max(1, Math.floor(budgetSek / avg))} plagg</b> ur {chosen.length} produkter i{" "}
              {[...new Set(chosen.map((f) => colorName(picked[f.id]).toLowerCase()))].slice(0, 3).join(", ")}.
            </p>
          ) : null}
        </section>

        {error ? <p className="brandbar-err">{error}</p> : null}
        <button type="button" className="offer-submit sb-create" disabled={busy} onClick={() => void create()}>
          {busy ? "Öppnar butiken – lägger loggan på allt…" : "Öppna butiken"}
        </button>
        <p className="drawer-note sb-fine">Priserna är riktpriser inkl. tryck vid ca {STORE_QTY} st. Beställningen bygger på det personalen faktiskt väljer.</p>
      </div>
    </div>
  );
}
