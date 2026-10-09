"use client";

import { useState } from "react";
import { type Brandbook, FONTS, useBrandbook } from "@/components/dashboard/brandbook";
import { hostOk, normalizeHost } from "@/lib/host";

export default function SettingsPage() {
  const { book, save, reset } = useBrandbook();
  const [edits, setEdits] = useState<Brandbook | null>(null);
  const draft = edits ?? book;
  const setDraft = (fn: (d: Brandbook) => Brandbook) => setEdits((e) => fn(e ?? book));
  const [siteEdit, setSite] = useState<string | null>(null);
  const site = siteEdit ?? book.company.website;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const set = <K extends keyof Brandbook>(key: K, value: Partial<Brandbook[K]>) => setDraft((d) => ({ ...d, [key]: { ...d[key], ...value } }));

  const fetchBrand = async () => {
    const host = normalizeHost(site);
    if (!hostOk(host)) return setMsg("Skriv en webbadress, till exempel volvo.com");
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: host }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const accent = /^#[0-9a-f]{6}$/i.test(json.color) && json.color.toLowerCase() !== "#1b1a17" ? [json.color] : [];
      setDraft((d) => ({
        ...d,
        company: { ...d.company, name: json.name, website: host },
        brand: { ...d.brand, logo: `/api/brand-logo?host=${host}`, colors: [...accent, "#111111", "#FFFFFF", "#9A9CA1", "#F4F3EF"].slice(0, 5) },
      }));
      setMsg("Logga och färg hämtade. Glöm inte att spara.");
    } catch {
      setMsg("Kunde inte läsa webbplatsen.");
    } finally {
      setBusy(false);
    }
  };

  const upload = (file: File | undefined) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => typeof r.result === "string" && set("brand", { logo: r.result });
    r.readAsDataURL(file);
  };

  return (
    <div className="dash-page narrow">
      <div className="dash-head">
        <div>
          <h1>Inställningar</h1>
          <p>Företagsuppgifter, brandbook och offertvillkor. Brandbooken används i designverktyget.</p>
        </div>
      </div>

      <section className="card">
        <h2>Företag</h2>
        <div className="fields">
          <label>
            Företagsnamn
            <input value={draft.company.name} onChange={(e) => set("company", { name: e.target.value })} />
          </label>
          <label>
            Organisationsnummer
            <input value={draft.company.orgnr} onChange={(e) => set("company", { orgnr: e.target.value })} />
          </label>
          <label className="wide">
            Fakturaadress
            <input value={draft.company.address} onChange={(e) => set("company", { address: e.target.value })} />
          </label>
          <label>
            E-post för fakturor
            <input type="email" value={draft.company.email} onChange={(e) => set("company", { email: e.target.value })} />
          </label>
          <label>
            Telefon
            <input value={draft.company.phone} onChange={(e) => set("company", { phone: e.target.value })} />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Brandbook</h2>
        <div className="brand-fetch">
          <input value={site} onChange={(e) => setSite(e.target.value)} placeholder="dittforetag.se" aria-label="Webbadress" />
          <button type="button" onClick={() => void fetchBrand()} disabled={busy}>
            {busy ? "Hämtar…" : "Hämta från webbadress"}
          </button>
        </div>
        <div className="brand-grid">
          <div>
            <p className="drawer-label">Logotyp</p>
            <div className="logo-box">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {draft.brand.logo ? <img src={draft.brand.logo} alt="Logotyp" /> : <span>Ingen logga</span>}
            </div>
            <label className="file-btn">
              Ladda upp logga
              <input type="file" accept="image/png,image/svg+xml,image/jpeg" onChange={(e) => upload(e.target.files?.[0])} />
            </label>
          </div>
          <div>
            <p className="drawer-label">Färger</p>
            <div className="palette">
              {draft.brand.colors.map((c, i) => (
                <label key={i} className="palette-chip">
                  <input
                    type="color"
                    value={c.toLowerCase()}
                    onChange={(e) => set("brand", { colors: draft.brand.colors.map((x, j) => (j === i ? e.target.value.toUpperCase() : x)) })}
                  />
                  <span style={{ background: c }} />
                  <small>{c.toUpperCase()}</small>
                </label>
              ))}
            </div>
            <p className="drawer-label">Typsnitt</p>
            <div className="fields">
              <label>
                Rubriker
                <select value={draft.brand.headingFont} onChange={(e) => set("brand", { headingFont: e.target.value })}>
                  {FONTS.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </label>
              <label>
                Brödtext
                <select value={draft.brand.bodyFont} onChange={(e) => set("brand", { bodyFont: e.target.value })}>
                  {FONTS.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="type-preview" style={{ fontFamily: `"${draft.brand.bodyFont}", sans-serif` }}>
              <strong style={{ fontFamily: `"${draft.brand.headingFont}", sans-serif`, color: draft.brand.colors[0] }}>{draft.company.name || "Rubrik"}</strong>
              <span>Brödtext i {draft.brand.bodyFont}. Så här ser era texter ut på produkterna.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Offertvillkor</h2>
        <div className="fields">
          <label>
            Tryck per styck (kr)
            <input type="number" value={draft.terms.printPerUnit} onChange={(e) => set("terms", { printPerUnit: Number(e.target.value) })} />
          </label>
          <label>
            Tryckstart per produkt (kr)
            <input type="number" value={draft.terms.setup} onChange={(e) => set("terms", { setup: Number(e.target.value) })} />
          </label>
          <label>
            Offerten gäller (dagar)
            <input type="number" value={draft.terms.validDays} onChange={(e) => set("terms", { validDays: Number(e.target.value) })} />
          </label>
          <label>
            Betalvillkor (dagar)
            <input type="number" value={draft.terms.paymentDays} onChange={(e) => set("terms", { paymentDays: Number(e.target.value) })} />
          </label>
          <label>
            Moms (%)
            <input type="number" value={draft.terms.vatPct} onChange={(e) => set("terms", { vatPct: Number(e.target.value) })} />
          </label>
        </div>
        <p className="drawer-note">I demon räknar offerterna fortfarande med sajtens standardpriser.</p>
      </section>

      <div className="save-bar">
        {msg ? <span>{msg}</span> : <span />}
        <button
          type="button"
          className="dash-btn ghost"
          onClick={() => {
            reset();
            setEdits(null);
            setSite(null);
            setMsg("Återställt till demo-brandbooken.");
          }}
        >
          Återställ
        </button>
        <button
          type="button"
          className="dash-btn"
          onClick={() => {
            save(draft);
            setEdits(null);
            setMsg("Sparat.");
          }}
        >
          Spara
        </button>
      </div>
    </div>
  );
}
