"use client";

import { useEffect, useState } from "react";
import type { SupplierSettings } from "@/lib/supplierTypes";

const TEXT: { key: keyof SupplierSettings; label: string; wide?: boolean }[] = [
  { key: "company", label: "Företag" },
  { key: "orgnr", label: "Organisationsnummer" },
  { key: "contact", label: "Kontaktperson för PACH" },
  { key: "email", label: "E-post för ordrar" },
  { key: "phone", label: "Telefon" },
];

export default function SupplierSettingsPage() {
  const [saved, setSaved] = useState<SupplierSettings | null>(null);
  const [form, setForm] = useState<SupplierSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    fetch("/api/supplier/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        setSaved(j.settings);
        setForm(j.settings);
      })
      .catch(() => setNote("Kunde inte hämta inställningarna."));
  }, []);

  const put = async (body: Partial<SupplierSettings> & { rotateKey?: boolean }) => {
    setBusy(true);
    const j = await fetch("/api/supplier/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then((r) => r.json())
      .catch(() => null);
    setBusy(false);
    if (!j?.settings) return setNote("Kunde inte spara.");
    setSaved(j.settings);
    setForm(j.settings);
    setNote("Sparat.");
  };

  if (!form || !saved) return <div className="dash-page narrow">{note ? <p className="brandbar-err">{note}</p> : <p className="drawer-note">Hämtar…</p>}</div>;
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const set = <K extends keyof SupplierSettings>(k: K, v: SupplierSettings[K]) => setForm({ ...form, [k]: v });

  return (
    <div className="dash-page narrow">
      <div className="dash-head">
        <div>
          <h1>Inställningar</h1>
          <p>Kontaktuppgifter, lager och hur ordrarna från PACH når er.</p>
        </div>
      </div>

      <section className="card">
        <h2>Företag</h2>
        <div className="fields">
          {TEXT.map((f) => (
            <label key={f.key}>
              {f.label}
              <input value={String(form[f.key])} onChange={(e) => set(f.key, e.target.value as never)} />
            </label>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Lager och frakt</h2>
        <div className="fields">
          <label className="wide">
            Lager som skickar PACH-ordrar
            <input value={form.warehouse} onChange={(e) => set("warehouse", e.target.value)} />
          </label>
          <label>
            Sista ordertid för utskick samma dag
            <input type="time" value={form.cutoff} onChange={(e) => set("cutoff", e.target.value)} />
          </label>
          <label>
            Standard fraktbolag
            <select value={form.carrier} onChange={(e) => set("carrier", e.target.value)}>
              {["PostNord", "DHL", "DB Schenker", "Bring", "UPS"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Notiser</h2>
        <div className="sp-toggles">
          {(
            [
              ["orders", "Ny order från PACH", "E-post direkt när en kund godkänner en offert med era produkter."],
              ["issues", "Svar på flaggor", "När PACH har löst en flagga eller valt ersättare."],
              ["weekly", "Veckoprognos", "Måndagar: vad som ligger i offerter och sannolikt blir order."],
            ] as [keyof SupplierSettings["notify"], string, string][]
          ).map(([k, label, help]) => (
            <label key={k} className="sp-toggle">
              <input type="checkbox" checked={form.notify[k]} onChange={(e) => set("notify", { ...form.notify, [k]: e.target.checked })} />
              <span>
                <b>{label}</b>
                <small>{help}</small>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Integration</h2>
        <label className="sp-toggle">
          <input type="checkbox" checked={form.edi} onChange={(e) => set("edi", e.target.checked)} />
          <span>
            <b>Ta emot ordrar via EDI</b>
            <small>Ordrarna skickas som EDIFACT ORDERS till ert affärssystem i stället för att bekräftas här.</small>
          </span>
        </label>
        <div className="sp-api">
          <span>API-nyckel</span>
          <code>{shown ? form.apiKey : `${form.apiKey.slice(0, 9)}••••••••••••`}</code>
          <button type="button" className="cz-link" onClick={() => setShown((s) => !s)}>
            {shown ? "Dölj" : "Visa"}
          </button>
          <button type="button" className="cz-link" disabled={busy} onClick={() => void put({ rotateKey: true })}>
            Skapa ny nyckel
          </button>
        </div>
        <p className="drawer-note">
          Hämta ordrar med <code>GET /api/supplier/orders</code> och uppdatera lager med <code>PATCH /api/supplier/catalog</code>. I demon behövs ingen nyckel.
        </p>
      </section>

      {dirty || note ? (
        <div className="save-bar">
          <span>{dirty ? "Osparade ändringar" : note}</span>
          {dirty ? (
            <>
              <button type="button" className="dash-btn ghost" onClick={() => setForm(saved)}>
                Ångra
              </button>
              <button type="button" className="dash-btn" disabled={busy} onClick={() => void put(form)}>
                {busy ? "Sparar…" : "Spara"}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
