"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { MarginBadge } from "@/components/dashboard/MarginBadge";
import { ProductPicker } from "@/components/dashboard/ProductPicker";
import { useCosts } from "@/components/dashboard/useCosts";
import { useQuotes } from "@/components/dashboard/useQuotes";
import { familyById } from "@/lib/catalog";
import { BASE_COLOR, colorName } from "@/lib/colors";
import { DEFAULT_PRICING, economics, marginOf, PRICE_MODE_LABEL, type PriceMode, type Pricing } from "@/lib/costing";
import type { Kalkyl, KalkylSummary } from "@/lib/kalkylTypes";
import { defaultDesign, designSummary, type LogoDesign } from "@/lib/marking";
import { sek } from "@/lib/pricing";
import { type ExtraLine, isEditable, type StoredLine } from "@/lib/quoteTypes";

const DRAFT_KEY = "pach.offer.draft";
const VAT = 0.25;

type Line = { key: string; kalkylId?: string; title?: string; productId: string; qty: number; color: string; design?: LogoDesign; image?: string; pricing: Pricing };
type Customer = { company: string; phone: string; host: string; eventDate: string };
type Draft = { ref?: string; customer: Customer; lines: Line[]; extras: ExtraLine[] };

const PRESETS: { label: string; amount: number; cost: number }[] = [
  { label: "Frakt", amount: 495, cost: 310 },
  { label: "Expresstillägg", amount: 1500, cost: 900 },
  { label: "Designkostnad", amount: 950, cost: 0 },
];

const uid = () => Math.random().toString(36).slice(2, 10);
const noCustomer: Customer = { company: "", phone: "", host: "", eventDate: "" };

const fromKalkyl = (k: Kalkyl | KalkylSummary): Line => ({ key: uid(), kalkylId: k.id, title: k.title, productId: k.productId, qty: k.qty, color: k.color, design: k.design, image: k.image, pricing: k.pricing });

const fromStored = (l: StoredLine): Line => ({
  key: uid(),
  kalkylId: l.kalkylId,
  productId: l.productId,
  qty: l.qty,
  color: l.color ?? BASE_COLOR,
  design: l.design,
  image: l.image,
  pricing: l.pricing?.mode === "markup" ? { mode: "markup", markupPct: l.pricing.markupPct } : l.price ? { mode: "fixed", markupPct: l.pricing?.markupPct ?? 60, unit: l.price.unit, setup: l.price.setup } : DEFAULT_PRICING,
});

async function fetchKalkyl(id: string): Promise<Kalkyl | null> {
  const j = await fetch(`/api/dashboard/kalkyler/${id}`, { cache: "no-store" })
    .then((r) => r.json())
    .catch(() => null);
  return j?.kalkyl ?? null;
}

function Builder() {
  const params = useSearchParams();
  const router = useRouter();
  const table = useCosts();
  const { quotes } = useQuotes();
  const ref = params.get("ref") ?? undefined;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [locked, setLocked] = useState(false);
  const [adding, setAdding] = useState<"" | "kalkyl" | "produkt">("");
  const [saved, setSaved] = useState<KalkylSummary[] | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const loaded = useRef(false);

  // Build the starting point once: an existing offer, chosen kalkyler, or the draft left when making a new kalkyl.
  useEffect(() => {
    if (loaded.current) return;
    if (ref && !quotes) return;
    loaded.current = true;
    void (async () => {
      let base: Draft = { customer: noCustomer, lines: [], extras: [] };
      if (params.get("draft")) {
        try {
          base = { ...base, ...(JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}") as Partial<Draft>) };
        } catch {
          /* a broken draft starts over */
        }
      } else if (ref) {
        const q = quotes?.find((x) => x.ref === ref);
        if (!q) return setError("Offerten hittades inte.");
        if (!isEditable(q)) setLocked(true);
        base = {
          ref,
          customer: { company: q.company, phone: q.phone, host: q.host ?? "", eventDate: q.eventDate ?? "" },
          lines: q.lines.map(fromStored),
          extras: q.extras ?? [],
        };
      }
      const ids = [...(params.get("kalkyler")?.split(",") ?? []), ...(params.get("add") ? [params.get("add")!] : [])].filter(Boolean);
      for (const k of (await Promise.all(ids.map(fetchKalkyl))).filter((x): x is Kalkyl => Boolean(x))) {
        if (base.lines.some((l) => l.productId === k.productId)) {
          setNotice(`${familyById(k.productId)?.name} fanns redan i offerten – ändra antalet på raden.`);
          continue;
        }
        base.lines.push(fromKalkyl(k));
        if (!base.customer.company && k.customer?.company) base.customer = { ...base.customer, company: k.customer.company, host: k.customer.host ?? "" };
      }
      setDraft(base);
    })();
  }, [params, quotes, ref]);

  // Keep the draft so "Ny kalkyl" can come back to it.
  useEffect(() => {
    if (draft && !locked) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [draft, locked]);

  // Saved kalkyler: for the "add" list and to show each row under the name the seller gave it.
  useEffect(() => {
    fetch("/api/dashboard/kalkyler", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setSaved(j.kalkyler ?? []))
      .catch(() => setSaved([]));
  }, []);
  const titles = useMemo(() => new Map((saved ?? []).map((k) => [k.id, k.title])), [saved]);

  const rows = useMemo(
    () =>
      (draft?.lines ?? []).flatMap((l) => {
        const f = familyById(l.productId);
        return f ? [{ l, f, eco: economics(f, l.qty, l.design, table, l.pricing), basis: table?.products[f.id] }] : [];
      }),
    [draft, table],
  );
  const extras = useMemo(() => draft?.extras ?? [], [draft]);
  const sum = useMemo(() => {
    const products = rows.reduce((s, r) => s + r.eco.sale.total, 0);
    const extraSale = extras.reduce((s, e) => s + e.amount, 0);
    const cost = rows.reduce((s, r) => s + r.eco.cost.total, 0) + extras.reduce((s, e) => s + e.cost, 0);
    const net = products + extraSale;
    return { products, extraSale, net, cost, tb: net - cost, pct: marginOf(net, cost) };
  }, [rows, extras]);
  const suppliers = useMemo(() => {
    const m = new Map<string, { name: string; lines: number; cost: number; minOrder: number }>();
    for (const r of rows) {
      const id = r.basis?.supplierId ?? r.f.supplierId;
      const g = m.get(id) ?? { name: r.basis?.supplierName ?? r.f.brand, lines: 0, cost: 0, minOrder: r.basis?.minOrder ?? 0 };
      g.lines += 1;
      g.cost += r.eco.cost.total;
      m.set(id, g);
    }
    return [...m.values()];
  }, [rows]);

  const update = (fn: (d: Draft) => Draft) => setDraft((d) => (d ? fn(d) : d));
  const setLine = (key: string, patch: Partial<Line>) => update((d) => ({ ...d, lines: d.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));
  const setPricing = (key: string, patch: Partial<Pricing>) => update((d) => ({ ...d, lines: d.lines.map((l) => (l.key === key ? { ...l, pricing: { ...l.pricing, ...patch } } : l)) }));
  const setExtra = (id: string, patch: Partial<ExtraLine>) => update((d) => ({ ...d, extras: d.extras.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  const addLine = (line: Line) => {
    if (draft?.lines.some((l) => l.productId === line.productId)) return setNotice(`${familyById(line.productId)?.name} finns redan i offerten – ändra antalet på raden.`);
    setNotice("");
    update((d) => ({ ...d, lines: [...d.lines, line] }));
    setAdding("");
  };

  const submit = async () => {
    if (!draft) return;
    setBusy(true);
    setError("");
    const body = {
      ...draft.customer,
      lines: draft.lines.map((l) => {
        const eco = rows.find((r) => r.l.key === l.key)?.eco;
        const pricing = l.pricing.mode === "fixed" ? { ...l.pricing, unit: l.pricing.unit ?? eco?.sale.unit, setup: l.pricing.setup ?? eco?.sale.setup } : l.pricing;
        return { kalkylId: l.kalkylId, productId: l.productId, qty: l.qty, color: l.color, design: l.design, pricing };
      }),
      extras: draft.extras,
    };
    const res = await fetch(draft.ref ? `/api/dashboard/offers/${draft.ref}` : "/api/dashboard/offers", {
      method: draft.ref ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(j.error ?? "Kunde inte spara offerten.");
    localStorage.removeItem(DRAFT_KEY);
    router.push(`/dashboard/offerter?open=${j.quote.ref}`);
  };

  if (error && !draft) return <div className="dash-page"><p className="brandbar-err">{error}</p></div>;
  if (!draft) return <div className="dash-page"><p className="drawer-note">Hämtar…</p></div>;

  return (
    <div className="dash-page wide kb">
      <div className="dash-head">
        <div>
          <p className="kp-crumb">
            <Link href="/dashboard/offerter">Offerter</Link> / {draft.ref ? draft.ref : "Ny offert"}
          </p>
          <h1>{draft.ref ? `Redigera offert` : "Ny offert"}</h1>
          <p>Lägg ihop kalkyler, ta bort det kunden inte vill ha, ändra antal och lägg till frakt eller andra poster.</p>
        </div>
        <Link href="/" className="dash-btn ghost">
          Bygg i butiken i stället
        </Link>
      </div>

      {locked ? <p className="kp-warn">Offerten är godkänd av kunden och kan inte ändras. Använd ”Beställ igen” under Offerter för att lägga en ny.</p> : null}

      <div className="kp-grid">
        <div className="kp-main">
          <section className="card">
            <h2>Kund</h2>
            <div className="fields">
              <label>
                Företag *
                <input value={draft.customer.company} onChange={(e) => update((d) => ({ ...d, customer: { ...d.customer, company: e.target.value } }))} disabled={locked} />
              </label>
              <label>
                Telefon
                <input value={draft.customer.phone} onChange={(e) => update((d) => ({ ...d, customer: { ...d.customer, phone: e.target.value } }))} disabled={locked} />
              </label>
              <label>
                Webbplats (för loggan)
                <input value={draft.customer.host} onChange={(e) => update((d) => ({ ...d, customer: { ...d.customer, host: e.target.value } }))} placeholder="foretag.se" disabled={locked} />
              </label>
              <label>
                Behövs senast
                <input type="date" value={draft.customer.eventDate} onChange={(e) => update((d) => ({ ...d, customer: { ...d.customer, eventDate: e.target.value } }))} disabled={locked} />
              </label>
            </div>
          </section>

          <section className="card">
            <div className="sp-card-head">
              <h2>Rader</h2>
              <span className="drawer-note">{rows.length} produkter · {suppliers.length} leverantörer</span>
            </div>
            {notice ? <p className="kp-info">{notice}</p> : null}
            {!rows.length ? <p className="drawer-note">Inga rader än. Lägg till en sparad kalkyl eller en produkt ur sortimentet.</p> : null}
            <ul className="kb-lines">
              {rows.map(({ l, f, eco, basis }) => (
                <li key={l.key} className="kb-line">
                  <Image src={l.image || f.image} alt="" width={120} height={120} unoptimized={Boolean(l.image)} />
                  <div className="kb-what">
                    <b>{l.title || (l.kalkylId && titles.get(l.kalkylId)) || f.name}</b>
                    <small>
                      {l.title || (l.kalkylId && titles.get(l.kalkylId)) ? `${f.name} · ` : ""}
                      {basis?.supplierName ?? f.brand} · {colorName(l.color)}
                      {l.design ? ` · ${designSummary(f, l.design)}` : ""}
                    </small>
                    {l.kalkylId ? (
                      <Link className="cz-link" href={`/dashboard/kalkyler/${l.kalkylId}`}>
                        Öppna kalkylen
                      </Link>
                    ) : null}
                    {basis && l.qty < basis.moq ? <small className="kp-warn-inline">Minst {basis.moq} st hos {basis.supplierName}</small> : null}
                  </div>
                  <div className="kb-qty">
                    <button type="button" onClick={() => setLine(l.key, { qty: Math.max(1, l.qty - (l.qty > 100 ? 50 : 10)) })} disabled={locked} aria-label="Minska">
                      −
                    </button>
                    <input type="number" min={1} value={l.qty} onChange={(e) => setLine(l.key, { qty: Math.max(1, Math.round(Number(e.target.value) || 1)) })} disabled={locked} aria-label={`Antal ${f.name}`} />
                    <button type="button" onClick={() => setLine(l.key, { qty: l.qty + (l.qty >= 100 ? 50 : 10) })} disabled={locked} aria-label="Öka">
                      +
                    </button>
                  </div>
                  <div className="kb-price">
                    <select
                      value={l.pricing.mode}
                      disabled={locked}
                      onChange={(e) => {
                        const mode = e.target.value as PriceMode;
                        setPricing(l.key, mode === "fixed" ? { mode, unit: eco.sale.unit, setup: eco.sale.setup } : { mode });
                      }}
                      aria-label="Prismodell"
                    >
                      {(["list", "markup", "fixed"] as PriceMode[]).map((m) => (
                        <option key={m} value={m}>
                          {PRICE_MODE_LABEL[m]}
                        </option>
                      ))}
                    </select>
                    {l.pricing.mode === "markup" ? (
                      <label>
                        <input type="number" value={l.pricing.markupPct} onChange={(e) => setPricing(l.key, { markupPct: Math.round(Number(e.target.value) || 0) })} disabled={locked} aria-label="Påslag i procent" />%
                      </label>
                    ) : l.pricing.mode === "fixed" ? (
                      <label>
                        <input type="number" value={l.pricing.unit ?? ""} onChange={(e) => setPricing(l.key, { unit: Math.max(0, Math.round(Number(e.target.value) || 0)) })} disabled={locked} aria-label="Pris per styck" />
                        kr/st
                      </label>
                    ) : (
                      <small>{sek(eco.sale.unit)}/st</small>
                    )}
                  </div>
                  <div className="kb-sum">
                    <b>{sek(eco.sale.total)}</b>
                    <small>kostnad {sek(eco.cost.total)}</small>
                    <MarginBadge tb={eco.tb} pct={eco.marginPct} />
                  </div>
                  {locked ? null : (
                    <button type="button" className="kb-remove" onClick={() => update((d) => ({ ...d, lines: d.lines.filter((x) => x.key !== l.key) }))} aria-label={`Ta bort ${f.name}`} title="Ta bort raden">
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {locked ? null : (
              <div className="kb-add">
                <button type="button" className="dash-btn ghost sp-small" onClick={() => setAdding(adding === "kalkyl" ? "" : "kalkyl")} aria-pressed={adding === "kalkyl"}>
                  + Sparad kalkyl
                </button>
                <button type="button" className="dash-btn ghost sp-small" onClick={() => setAdding(adding === "produkt" ? "" : "produkt")} aria-pressed={adding === "produkt"}>
                  + Produkt ur sortimentet
                </button>
                <Link className="dash-btn ghost sp-small" href="/dashboard/kalkyler/ny?draft=1">
                  + Ny kalkyl
                </Link>
              </div>
            )}
            {adding === "kalkyl" ? (
              <ul className="kb-saved">
                {saved === null ? <li className="drawer-note">Hämtar…</li> : null}
                {(saved ?? [])
                  .filter((k) => !k.archived)
                  .map((k) => {
                    const f = familyById(k.productId);
                    if (!f) return null;
                    const taken = draft.lines.some((l) => l.productId === k.productId);
                    const e = economics(f, k.qty, k.design, table, k.pricing);
                    return (
                      <li key={k.id}>
                        <button type="button" disabled={taken} onClick={() => addLine(fromKalkyl(k))}>
                          <Image src={k.image || f.image} alt="" width={80} height={80} unoptimized={Boolean(k.image)} />
                          <span>
                            <b>{k.title || f.name}</b>
                            <small>
                              {k.customer?.company ? `${k.customer.company} · ` : ""}
                              {k.qty} st · {sek(e.sale.total)} · {e.marginPct} %
                            </small>
                          </span>
                          <em>{taken ? "Finns redan" : "Lägg till"}</em>
                        </button>
                      </li>
                    );
                  })}
              </ul>
            ) : null}
            {adding === "produkt" ? (
              <ProductPicker
                table={table}
                exclude={draft.lines.map((l) => l.productId)}
                onPick={(pid) => {
                  const f = familyById(pid)!;
                  addLine({ key: uid(), productId: pid, qty: Math.max(50, table?.products[pid]?.moq ?? 1), color: f.variants[0]?.colorHex.toUpperCase() ?? BASE_COLOR, design: defaultDesign(f), pricing: DEFAULT_PRICING });
                }}
              />
            ) : null}
          </section>

          <section className="card">
            <h2>Extra poster</h2>
            <p className="drawer-note">Frakt, expresstillägg, designarbete eller annat – med pris till kunden och din egen kostnad.</p>
            <ul className="kb-extras">
              {extras.map((e) => (
                <li key={e.id}>
                  <input value={e.label} onChange={(ev) => setExtra(e.id, { label: ev.target.value })} placeholder="Beskrivning" aria-label="Beskrivning" disabled={locked} />
                  <label>
                    Pris
                    <input type="number" value={e.amount} onChange={(ev) => setExtra(e.id, { amount: Math.round(Number(ev.target.value) || 0) })} aria-label="Pris till kunden" disabled={locked} />
                  </label>
                  <label>
                    Kostnad
                    <input type="number" value={e.cost} onChange={(ev) => setExtra(e.id, { cost: Math.max(0, Math.round(Number(ev.target.value) || 0)) })} aria-label="Din kostnad" disabled={locked} />
                  </label>
                  <MarginBadge tb={e.amount - e.cost} pct={marginOf(e.amount, e.cost)} compact />
                  {locked ? null : (
                    <button type="button" className="kb-remove" onClick={() => update((d) => ({ ...d, extras: d.extras.filter((x) => x.id !== e.id) }))} aria-label={`Ta bort ${e.label}`}>
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {locked ? null : (
              <div className="kb-add">
                {[...PRESETS, { label: "", amount: 0, cost: 0 }].map((p) => (
                  <button key={p.label || "egen"} type="button" className="dash-btn ghost sp-small" onClick={() => update((d) => ({ ...d, extras: [...d.extras, { id: uid(), ...p }] }))}>
                    + {p.label || "Egen rad"}
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="card kp-sum">
          <h2>Summering</h2>
          <dl className="kp-dl">
            <dt>Produkter</dt>
            <dd>{sek(sum.products)}</dd>
            <dt>Extra poster</dt>
            <dd>{sek(sum.extraSale)}</dd>
            <dt className="kp-strong">Summa exkl. moms</dt>
            <dd className="kp-strong">{sek(sum.net)}</dd>
            <dt>Moms 25 %</dt>
            <dd>{sek(Math.round(sum.net * VAT))}</dd>
            <dt>Att betala</dt>
            <dd>{sek(Math.round(sum.net * (1 + VAT)))}</dd>
            <dt>Din kostnad</dt>
            <dd>{sek(sum.cost)}</dd>
          </dl>
          <div className="kp-result">
            <span>Du tjänar</span>
            <MarginBadge tb={sum.tb} pct={sum.pct} />
          </div>

          {suppliers.length ? (
            <div className="kb-suppliers">
              <p className="drawer-label">Per leverantör</p>
              <ul>
                {suppliers.map((s) => (
                  <li key={s.name} className={s.cost < s.minOrder ? "is-short" : ""}>
                    <span>
                      <b>{s.name}</b>
                      <small>
                        {s.lines} {s.lines === 1 ? "rad" : "rader"} · inköp {sek(s.cost)}
                      </small>
                    </span>
                    {s.cost < s.minOrder ? <small>Under minsta order {sek(s.minOrder)}</small> : <small>✓</small>}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {error ? <p className="brandbar-err">{error}</p> : null}
          {locked ? null : (
            <button type="button" className="drawer-save" disabled={busy || !rows.length || !draft.customer.company.trim()} onClick={() => void submit()}>
              {busy ? "Sparar…" : draft.ref ? "Spara ändringar" : "Skapa offert"}
            </button>
          )}
          {!draft.customer.company.trim() && rows.length ? <p className="drawer-note">Fyll i kundens företag för att spara.</p> : null}
          {draft.ref ? (
            <p className="drawer-note">Kunden ser ändringarna direkt i sin länk. Godkännanden på ändrade rader tas bort.</p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

export default function OfferBuilderPage() {
  return (
    <Suspense>
      <Builder />
    </Suspense>
  );
}
