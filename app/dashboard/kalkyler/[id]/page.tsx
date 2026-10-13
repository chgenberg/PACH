"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { LogoCustomizer } from "@/components/customizer/LogoCustomizer";
import { MarginBadge } from "@/components/dashboard/MarginBadge";
import { ProductPicker } from "@/components/dashboard/ProductPicker";
import { useCosts } from "@/components/dashboard/useCosts";
import { useQuotes } from "@/components/dashboard/useQuotes";
import { familyById } from "@/lib/catalog";
import { BASE_COLOR } from "@/lib/colors";
import { DEFAULT_PRICING, economics, PRICE_MODE_LABEL, type PriceMode, type Pricing } from "@/lib/costing";
import type { Kalkyl } from "@/lib/kalkylTypes";
import { defaultDesign, designSummary, type LogoDesign } from "@/lib/marking";
import { sek } from "@/lib/pricing";
import { isEditable, type Proof } from "@/lib/quoteTypes";

const QTY_STEPS = [25, 50, 100, 250, 500];

type Draft = {
  productId: string;
  qty: number;
  color: string;
  design?: LogoDesign;
  image?: string;
  proofs?: Proof[];
  pricing: Pricing;
  title: string;
  company: string;
  host: string;
  note: string;
};

const empty = (productId = ""): Draft => {
  const f = productId ? familyById(productId) : null;
  return { productId, qty: 50, color: BASE_COLOR, design: f ? defaultDesign(f) : undefined, pricing: DEFAULT_PRICING, title: "", company: "", host: "", note: "" };
};

const fromKalkyl = (k: Kalkyl): Draft => ({
  productId: k.productId,
  qty: k.qty,
  color: k.color,
  design: k.design,
  image: k.image,
  proofs: k.proofs,
  pricing: k.pricing,
  title: k.title ?? "",
  company: k.customer?.company ?? "",
  host: k.customer?.host ?? "",
  note: k.note ?? "",
});

function Editor() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const table = useCosts();
  const { quotes } = useQuotes();
  const isNew = id === "ny";
  const [draft, setDraft] = useState<Draft | null>(isNew ? empty(params.get("product") ?? "") : null);
  const [usedIn, setUsedIn] = useState<{ ref: string; company: string; status: string }[]>([]);
  const [picking, setPicking] = useState(isNew && !params.get("product"));
  const [designing, setDesigning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [target, setTarget] = useState(params.get("ref") ?? "ny");

  useEffect(() => {
    if (isNew) return;
    let live = true;
    fetch(`/api/dashboard/kalkyler/${id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!live) return;
        if (!j.kalkyl) return setError(j.error ?? "Kalkylen hittades inte.");
        setDraft(fromKalkyl(j.kalkyl));
        setUsedIn(j.usedIn ?? []);
      })
      .catch(() => live && setError("Kunde inte hämta kalkylen."));
    return () => {
      live = false;
    };
  }, [id, isNew]);

  const family = draft?.productId ? familyById(draft.productId) : null;
  const basis = family ? table?.products[family.id] : undefined;
  const eco = useMemo(() => (family && draft ? economics(family, draft.qty, draft.design, table, draft.pricing) : null), [family, draft, table]);
  const colors = useMemo(() => {
    if (!family) return [];
    const seen = new Map<string, string>();
    for (const v of family.variants) seen.set(v.colorHex.toUpperCase(), v.colorName);
    return [...seen.entries()];
  }, [family]);
  const companies = useMemo(() => [...new Set((quotes ?? []).map((q) => q.company))].sort(), [quotes]);
  const editableOffers = useMemo(() => (quotes ?? []).filter(isEditable), [quotes]);

  const set = (patch: Partial<Draft>) => {
    setSaved(false);
    setDraft((d) => (d ? { ...d, ...patch } : d));
  };
  const setPricing = (patch: Partial<Pricing>) => set({ pricing: { ...draft!.pricing, ...patch } });

  /** Saves and returns the kalkyl id, or "" on error. */
  const save = async (): Promise<string> => {
    if (!draft || !family) return "";
    setBusy(true);
    setError("");
    const body = {
      productId: draft.productId,
      qty: draft.qty,
      color: draft.color,
      design: draft.design,
      image: draft.image ?? null,
      proofs: draft.proofs,
      pricing: draft.pricing.mode === "fixed" ? { ...draft.pricing, unit: draft.pricing.unit ?? eco?.sale.unit, setup: draft.pricing.setup ?? eco?.sale.setup } : draft.pricing,
      title: draft.title,
      customer: { company: draft.company, host: draft.host },
      note: draft.note,
    };
    const res = await fetch(isNew ? "/api/dashboard/kalkyler" : `/api/dashboard/kalkyler/${id}`, { method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(j.error ?? "Kunde inte spara.");
      return "";
    }
    setSaved(true);
    if (isNew) router.replace(`/dashboard/kalkyler/${j.kalkyl.id}${params.toString() ? `?${params.toString()}` : ""}`);
    return j.kalkyl.id as string;
  };

  const toOffer = async () => {
    const kid = await save();
    if (!kid) return;
    if (params.get("draft")) router.push(`/dashboard/offerter/bygg?draft=1&add=${kid}`);
    else if (target === "ny") router.push(`/dashboard/offerter/bygg?kalkyler=${kid}`);
    else router.push(`/dashboard/offerter/bygg?ref=${target}&add=${kid}`);
  };

  if (error && !draft) return <div className="dash-page"><p className="brandbar-err">{error}</p></div>;
  if (!draft) return <div className="dash-page"><p className="drawer-note">Hämtar kalkylen…</p></div>;

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <p className="kp-crumb">
            <Link href="/dashboard/kalkyler">Kalkyler</Link> / {isNew ? "Ny kalkyl" : draft.title || family?.name}
          </p>
          <h1>{isNew ? "Ny kalkyl" : draft.title || family?.name || "Kalkyl"}</h1>
          <p>En produkt hos en leverantör – antal, tryck, inköp och pris. Lägg den sedan i en eller flera offerter.</p>
        </div>
      </div>

      {picking || !family ? (
        <section className="card">
          <h2>Välj produkt</h2>
          <ProductPicker
            table={table}
            onPick={(pid) => {
              const f = familyById(pid)!;
              set({ productId: pid, design: defaultDesign(f), color: f.variants[0]?.colorHex.toUpperCase() ?? BASE_COLOR, image: undefined, proofs: undefined, qty: Math.max(draft.qty, table?.products[pid]?.moq ?? 1) });
              setPicking(false);
            }}
          />
        </section>
      ) : (
        <div className="kp-grid">
          <div className="kp-main">
            <section className="card kp-product">
              <Image src={draft.image || family.image} alt="" width={240} height={240} unoptimized={Boolean(draft.image)} />
              <div>
                <h2>{family.name}</h2>
                <p className="drawer-note">
                  {basis?.supplierName ?? family.brand} · {family.subcategory} · {family.material}
                </p>
                <p className="drawer-note">
                  Inköp {sek(basis?.unitCost ?? 0)}/st · minsta antal {basis?.moq ?? "–"} st
                </p>
                <button type="button" className="cz-link" onClick={() => setPicking(true)}>
                  Byt produkt
                </button>
              </div>
            </section>

            <section className="card">
              <h2>Antal och färg</h2>
              <div className="kp-qty">
                <input type="number" min={1} value={draft.qty} onChange={(e) => set({ qty: Math.max(1, Math.round(Number(e.target.value) || 1)) })} aria-label="Antal" />
                <span>st</span>
                <div className="seg">
                  {QTY_STEPS.map((n) => (
                    <button key={n} type="button" aria-pressed={draft.qty === n} onClick={() => set({ qty: n })}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              {basis && draft.qty < basis.moq ? <p className="kp-warn">Under leverantörens minsta antal – {basis.supplierName} säljer minst {basis.moq} st.</p> : null}
              <div className="swatches kp-colors">
                {colors.map(([hex, name]) => (
                  <button key={hex} type="button" className="swatch" title={name} aria-label={name} aria-pressed={draft.color === hex} style={{ background: hex }} onClick={() => set({ color: hex })} />
                ))}
                <span className="drawer-note">{colors.find(([h]) => h === draft.color)?.[1] ?? ""}</span>
              </div>
            </section>

            <section className="card">
              <div className="sp-card-head">
                <h2>Tryck</h2>
                <button type="button" className="dash-btn ghost sp-small" onClick={() => setDesigning(true)}>
                  {draft.proofs?.length ? "Ändra i 3D" : "Designa i 3D"}
                </button>
              </div>
              <p className="drawer-note">{draft.design ? designSummary(family, draft.design) : "Standardtryck med kundens logga"}</p>
              {draft.proofs?.length ? (
                <div className="sp-proofs">
                  {draft.proofs.map((p) => (
                    // eslint-disable-next-line @next/next/no-img-element -- proof data URL
                    <img key={p.label} src={p.image} alt={p.label} title={p.label} />
                  ))}
                  <small>3D-korrektur följer med till offerten</small>
                </div>
              ) : null}
            </section>

            <section className="card">
              <h2>Kund och anteckning</h2>
              <div className="fields">
                <label>
                  Kund (valfritt)
                  <input list="kp-companies" value={draft.company} onChange={(e) => set({ company: e.target.value })} placeholder="T.ex. Bryggeriet Väst" />
                  <datalist id="kp-companies">
                    {companies.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </label>
                <label>
                  Kundens webbplats (för loggan)
                  <input value={draft.host} onChange={(e) => set({ host: e.target.value })} placeholder="foretag.se" />
                </label>
                <label className="wide">
                  Namn på kalkylen
                  <input value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder={`${family.name} till …`} />
                </label>
                <label className="wide">
                  Anteckning
                  <input value={draft.note} onChange={(e) => set({ note: e.target.value })} placeholder="Intern anteckning, syns inte för kunden" />
                </label>
              </div>
            </section>
          </div>

          <aside className="card kp-sum">
            <h2>Kalkyl</h2>
            <div className="seg">
              {(["list", "markup", "fixed"] as PriceMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={draft.pricing.mode === m}
                  onClick={() => setPricing(m === "fixed" ? { mode: m, unit: eco?.sale.unit, setup: eco?.sale.setup } : { mode: m })}
                >
                  {PRICE_MODE_LABEL[m]}
                </button>
              ))}
            </div>
            {draft.pricing.mode === "markup" ? (
              <label className="kp-inline">
                Påslag på inköp
                <input type="number" value={draft.pricing.markupPct} onChange={(e) => setPricing({ markupPct: Math.round(Number(e.target.value) || 0) })} />%
              </label>
            ) : null}
            {draft.pricing.mode === "fixed" ? (
              <div className="kp-fixed">
                <label className="kp-inline">
                  Pris per st inkl. tryck
                  <input type="number" value={draft.pricing.unit ?? ""} onChange={(e) => setPricing({ unit: Math.max(0, Math.round(Number(e.target.value) || 0)) })} />
                  kr
                </label>
                <label className="kp-inline">
                  Tryckstart
                  <input type="number" value={draft.pricing.setup ?? ""} onChange={(e) => setPricing({ setup: Math.max(0, Math.round(Number(e.target.value) || 0)) })} />
                  kr
                </label>
              </div>
            ) : null}

            {eco ? (
              <>
                <dl className="kp-dl">
                  <dt>Inköp produkt</dt>
                  <dd>
                    {eco.qty} × {sek(eco.cost.unit)} = {sek(eco.cost.unit * eco.qty)}
                  </dd>
                  <dt>Tryck</dt>
                  <dd>
                    {eco.qty} × {sek(eco.cost.printUnit)} = {sek(eco.cost.printUnit * eco.qty)}
                  </dd>
                  <dt>Tryckstart (inköp)</dt>
                  <dd>{sek(eco.cost.setup)}</dd>
                  <dt className="kp-strong">Kostnad</dt>
                  <dd className="kp-strong">{sek(eco.cost.total)}</dd>
                  <dt>Pris per st</dt>
                  <dd>
                    {sek(eco.sale.unit)}
                    {draft.pricing.mode !== "list" ? <small> riktpris {sek(eco.list.unit)}</small> : null}
                  </dd>
                  <dt>Tryckstart (kund)</dt>
                  <dd>{sek(eco.sale.setup)}</dd>
                  <dt className="kp-strong">Försäljning</dt>
                  <dd className="kp-strong">{sek(eco.sale.total)}</dd>
                </dl>
                <div className="kp-result">
                  <span>Du tjänar</span>
                  <MarginBadge tb={eco.tb} pct={eco.marginPct} />
                </div>
                {basis && eco.cost.total < basis.minOrder ? (
                  <p className="kp-info">
                    {basis.supplierName} har minsta ordervärde {sek(basis.minOrder)} i inköp – samla fler rader från dem i offerten eller räkna med en avgift.
                  </p>
                ) : null}
              </>
            ) : null}

            {error ? <p className="brandbar-err">{error}</p> : null}
            <button type="button" className="drawer-save" disabled={busy} onClick={() => void save()}>
              {busy ? "Sparar…" : saved ? "Sparad ✓" : "Spara kalkyl"}
            </button>
            <div className="kp-offer">
              {params.get("draft") ? null : (
                <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Välj offert">
                  <option value="ny">Ny offert</option>
                  {editableOffers.map((q) => (
                    <option key={q.ref} value={q.ref}>
                      {q.company} · {q.ref}
                    </option>
                  ))}
                </select>
              )}
              <button type="button" className="dash-btn" disabled={busy} onClick={() => void toOffer()}>
                {params.get("draft") ? "Spara och tillbaka till offerten" : "Lägg i offert"}
              </button>
            </div>
            {usedIn.length ? (
              <p className="drawer-note">
                Används i{" "}
                {usedIn.map((u, i) => (
                  <span key={u.ref}>
                    {i ? ", " : ""}
                    <Link href={`/dashboard/offerter?open=${u.ref}`}>{u.company}</Link>
                  </span>
                ))}
                . Ändringar här påverkar inte redan sparade offerter.
              </p>
            ) : null}
          </aside>
        </div>
      )}

      {designing && family ? (
        <LogoCustomizer
          family={family}
          initial={draft.design ?? defaultDesign(family)}
          color={draft.color}
          qty={draft.qty}
          brandLogo={draft.host ? `/api/brand-logo?host=${encodeURIComponent(draft.host)}` : null}
          onClose={() => setDesigning(false)}
          saveLabel="Spara i kalkylen"
          onSave={(r) => {
            set({ design: r.design, color: r.color, image: r.preview || undefined, proofs: r.proofs.length ? r.proofs : undefined, qty: Math.max(draft.qty, r.design.names?.list.length ?? 0) });
            setDesigning(false);
          }}
        />
      ) : null}
    </div>
  );
}

export default function KalkylPage() {
  return (
    <Suspense>
      <Editor />
    </Suspense>
  );
}
