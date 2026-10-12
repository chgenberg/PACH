"use client";

import { useState } from "react";
import { fmtTime, useCatalog } from "@/components/supplier/useSupplier";
import { METHOD_INFO, METHODS, type Method } from "@/lib/marking";
import type { MethodTerms, ProductTerms } from "@/lib/supplierTypes";

type ProductEdit = Partial<Record<keyof ProductTerms, string>>;
type MethodEdit = Partial<Record<keyof MethodTerms, string>>;

export default function PricesPage() {
  const { items, prices, error, patch } = useCatalog();
  const [products, setProducts] = useState<Record<string, ProductEdit>>({});
  const [methods, setMethods] = useState<Partial<Record<Method, MethodEdit>>>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const changes = Object.values(products).reduce((s, e) => s + Object.keys(e).length, 0) + Object.values(methods).reduce((s, e) => s + Object.keys(e ?? {}).length, 0);

  const setP = (id: string, k: keyof ProductTerms, v: string) => setProducts((x) => ({ ...x, [id]: { ...x[id], [k]: v.replace(/[^\d.,]/g, "") } }));
  const setM = (m: Method, k: keyof MethodTerms, v: string) => setMethods((x) => ({ ...x, [m]: { ...x[m], [k]: v.replace(/[^\d.,]/g, "") } }));
  const toNum = (v: string) => Number(v.replace(",", "."));

  const send = async () => {
    setBusy(true);
    try {
      await patch({
        prices: {
          products: Object.fromEntries(Object.entries(products).map(([id, e]) => [id, Object.fromEntries(Object.entries(e).map(([k, v]) => [k, toNum(v!)]))])),
          methods: Object.fromEntries(Object.entries(methods).map(([m, e]) => [m, Object.fromEntries(Object.entries(e ?? {}).map(([k, v]) => [k, toNum(v!)]))])),
        },
      });
      setProducts({});
      setMethods({});
      setNote("");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Kunde inte spara.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1>Priser</h1>
          <p>Era priser till PACH för produkter och tryck. Ändringar skickas till PACH, som godkänner dem innan de används i offertkalkylen.</p>
        </div>
      </div>

      {error ? <p className="brandbar-err">{error}</p> : null}
      {prices?.pending ? (
        <p className="sp-pending">
          <b>Väntar på PACH</b> Prisändringar skickade {prices.sentAt ? fmtTime(prices.sentAt) : ""}. Era ordrar räknas redan med de nya priserna här i portalen.
        </p>
      ) : null}

      <section className="card">
        <h2>Tryckpriser</h2>
        <div className="sp-price-grid">
          <div className="sp-pr th">
            <span>Metod</span>
            <span className="r">Tryckstart per färg</span>
            <span className="r">Per styck och färg</span>
          </div>
          {METHODS.map((m) => {
            const cur = prices?.methods[m];
            return (
              <div key={m} className="sp-pr">
                <span>
                  <b>{METHOD_INFO[m].label}</b>
                  <small>{m === "digitaltryck" ? "Prissätts som en färg" : m === "gravyr" ? "Alltid en ton" : `Upp till ${METHOD_INFO[m].maxColors} färger`}</small>
                </span>
                <label className="r">
                  <input inputMode="decimal" value={methods[m]?.setupPerColor ?? String(cur?.setupPerColor ?? "")} onChange={(e) => setM(m, "setupPerColor", e.target.value)} aria-label={`${METHOD_INFO[m].label} tryckstart`} />
                  kr
                </label>
                <label className="r">
                  <input inputMode="decimal" value={methods[m]?.unitPerColor ?? String(cur?.unitPerColor ?? "")} onChange={(e) => setM(m, "unitPerColor", e.target.value)} aria-label={`${METHOD_INFO[m].label} per styck`} />
                  kr
                </label>
              </div>
            );
          })}
        </div>
        <p className="drawer-note">Styckpriset staffas automatiskt: −10 % från 50 st, −20 % från 100 st och −30 % från 250 st. Brodyr över 8 cm får +40 %.</p>
      </section>

      <section className="card">
        <h2>Produktpriser</h2>
        <div className="sp-price-grid sp-products">
          <div className="sp-pr th">
            <span>Produkt</span>
            <span className="r">PACH:s riktpris</span>
            <span className="r">Ert pris</span>
            <span className="r">Minsta antal</span>
            <span className="r">Ledtid omärkt</span>
          </div>
          {(items ?? []).map((i) => {
            const e = products[i.productId] ?? {};
            const changed = i.terms.price !== i.defaultTerms.price || i.terms.moq !== i.defaultTerms.moq || i.terms.leadDays !== i.defaultTerms.leadDays;
            return (
              <div key={i.productId} className="sp-pr">
                <span className="sp-prod">
                  {/* eslint-disable-next-line @next/next/no-img-element -- catalogue image */}
                  <img src={i.image} alt="" />
                  <span>
                    <b>{i.name}</b>
                    <small>
                      {i.brand}
                      {changed ? " · ändrat" : ""}
                    </small>
                  </span>
                </span>
                <span className="r sp-mute">{i.listPrice} kr</span>
                <label className="r">
                  <input inputMode="decimal" value={e.price ?? String(i.terms.price)} onChange={(ev) => setP(i.productId, "price", ev.target.value)} aria-label={`Pris ${i.name}`} />
                  kr
                </label>
                <label className="r">
                  <input inputMode="numeric" value={e.moq ?? String(i.terms.moq)} onChange={(ev) => setP(i.productId, "moq", ev.target.value)} aria-label={`Minsta antal ${i.name}`} />
                  st
                </label>
                <label className="r">
                  <input inputMode="numeric" value={e.leadDays ?? String(i.terms.leadDays)} onChange={(ev) => setP(i.productId, "leadDays", ev.target.value)} aria-label={`Ledtid ${i.name}`} />
                  dgr
                </label>
              </div>
            );
          })}
        </div>
      </section>

      {changes ? (
        <div className="save-bar">
          <span>
            {changes} {changes === 1 ? "ändring" : "ändringar"} {note ? `· ${note}` : ""}
          </span>
          <button
            type="button"
            className="dash-btn ghost"
            onClick={() => {
              setProducts({});
              setMethods({});
            }}
          >
            Ångra
          </button>
          <button type="button" className="dash-btn" disabled={busy} onClick={() => void send()}>
            {busy ? "Skickar…" : "Skicka till PACH"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
