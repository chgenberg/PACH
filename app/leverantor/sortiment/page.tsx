"use client";

import { Fragment, useMemo, useState } from "react";
import { downloadCsv, fmtDate, useCatalog } from "@/components/supplier/useSupplier";
import type { CatalogItem } from "@/lib/supplierTypes";

const LOW = 50;

const statusOf = (item: CatalogItem) => {
  const free = item.stock.map((s) => s.stock - s.allocated);
  if (free.some((n) => n <= 0)) return { label: "Slut i någon variant", tone: "is-out" };
  if (free.some((n) => n < LOW)) return { label: "Lågt lager", tone: "is-low" };
  return { label: "I lager", tone: "is-ok" };
};

/** "sku;antal" or "sku,antal" per row; a header row is skipped. */
function parseCsv(text: string) {
  return text
    .split(/\r?\n/)
    .map((l) => l.split(/[;,\t]/).map((c) => c.replace(/^"|"$/g, "").trim()))
    .filter((c) => c.length >= 2 && /\d/.test(c[1]))
    .map(([sku, n]) => ({ sku, stock: Number(n.replace(/\s/g, "")) }));
}

export default function AssortmentPage() {
  const { items, error, patch } = useCatalog();
  const [brand, setBrand] = useState("alla");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");

  const list = useMemo(() => items ?? [], [items]);
  const brands = useMemo(() => [...new Set(list.map((i) => i.brand))].sort(), [list]);
  const shown = list.filter((i) => (brand === "alla" || i.brand === brand) && `${i.name} ${i.category} ${i.stock.map((s) => s.sku).join(" ")}`.toLowerCase().includes(q.trim().toLowerCase()));
  const all = list.flatMap((i) => i.stock);
  const kpi = {
    skus: all.length,
    units: all.reduce((s, x) => s + x.stock, 0),
    out: all.filter((x) => x.stock - x.allocated <= 0).length,
    low: all.filter((x) => x.stock - x.allocated > 0 && x.stock - x.allocated < LOW).length,
  };

  const saveRow = async (sku: string) => {
    const value = Number(edits[sku]);
    if (!Number.isFinite(value)) return;
    await patch({ stock: [{ sku, stock: value }] });
    setEdits((e) => {
      const next = { ...e };
      delete next[sku];
      return next;
    });
    setNote(`${sku} uppdaterad.`);
  };

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1>Sortiment &amp; lager</h1>
          <p>Era produkter hos PACH med lagersaldo per artikelnummer. Det som är reserverat för öppna ordrar räknas bort från det lediga lagret.</p>
        </div>
        <div className="sp-head-actions">
          <label className="dash-btn ghost sp-file">
            Importera CSV
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                const rows = parseCsv(await f.text());
                const changed = rows.length ? await patch({ stock: rows }) : 0;
                setNote(rows.length ? `${changed} av ${rows.length} rader uppdaterade.` : "Hittade inga rader i formatet artikelnr;antal.");
              }}
            />
          </label>
          <button type="button" className="dash-btn ghost" onClick={() => downloadCsv("nwg-lager.csv", [["Artikelnr", "Antal"], ...all.map((s) => [s.sku, s.stock])])} disabled={!all.length}>
            Ladda ner mall
          </button>
        </div>
      </div>

      <div className="kpis">
        <div>
          <span>Artikelnummer</span>
          <strong>{kpi.skus}</strong>
          <small>{list.length} produkter</small>
        </div>
        <div>
          <span>Styck i lager</span>
          <strong>{kpi.units.toLocaleString("sv-SE")}</strong>
        </div>
        <div>
          <span>Slut</span>
          <strong className={kpi.out ? "is-late" : ""}>{kpi.out}</strong>
        </div>
        <div>
          <span>Lågt (under {LOW})</span>
          <strong>{kpi.low}</strong>
        </div>
      </div>

      <div className="sp-toolbar">
        <div className="seg">
          {["alla", ...brands].map((b) => (
            <button key={b} type="button" aria-pressed={brand === b} onClick={() => setBrand(b)}>
              {b === "alla" ? "Alla" : b}
            </button>
          ))}
        </div>
        <input className="sp-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sök produkt eller artikelnummer…" aria-label="Sök" />
      </div>

      {error ? <p className="brandbar-err">{error}</p> : null}
      {note ? <p className="drawer-note sp-note">{note}</p> : null}

      <div className="table sp-table sp-stock">
        <div className="tr th">
          <span>Produkt</span>
          <span>Varumärke</span>
          <span className="r">I lager</span>
          <span className="r">Reserverat</span>
          <span>Status</span>
        </div>
        {items === null ? <p className="table-empty">Hämtar…</p> : null}
        {shown.map((i) => {
          const st = statusOf(i);
          const isOpen = open === i.productId;
          return (
            <Fragment key={i.productId}>
              <button type="button" className={`tr${isOpen ? " is-open" : ""}`} onClick={() => setOpen(isOpen ? null : i.productId)} aria-expanded={isOpen}>
                <span className="sp-prod">
                  {/* eslint-disable-next-line @next/next/no-img-element -- catalogue image */}
                  <img src={i.image} alt="" />
                  <span>
                    <b>{i.name}</b>
                    <small>
                      {i.category} · {i.stock.length} varianter
                    </small>
                  </span>
                </span>
                <span>{i.brand}</span>
                <span className="r">{i.stock.reduce((s, x) => s + x.stock, 0).toLocaleString("sv-SE")}</span>
                <span className="r">{i.stock.reduce((s, x) => s + x.allocated, 0) || "–"}</span>
                <span>
                  <em className={`sp-stock-pill ${st.tone}`}>{st.label}</em>
                </span>
              </button>
              {isOpen ? (
                <div className="sp-variants">
                  <table className="sp-sizes">
                    <thead>
                      <tr>
                        <th>Artikelnr</th>
                        <th>Färg</th>
                        <th>Storlek</th>
                        <th className="r">Reserverat</th>
                        <th className="r">Ledigt</th>
                        <th className="r">I lager</th>
                      </tr>
                    </thead>
                    <tbody>
                      {i.stock.map((s) => {
                        const free = s.stock - s.allocated;
                        return (
                          <tr key={s.sku} className={free <= 0 ? "is-short" : ""}>
                            <td>{s.sku}</td>
                            <td>{s.color}</td>
                            <td>{s.size}</td>
                            <td className="r">{s.allocated || "–"}</td>
                            <td className="r">
                              {free <= 0 ? (s.restock ? `Slut · åter ${fmtDate(s.restock)}` : "Slut") : free.toLocaleString("sv-SE")}
                            </td>
                            <td className="r">
                              <span className="sp-stock-edit">
                                <input
                                  inputMode="numeric"
                                  value={edits[s.sku] ?? String(s.stock)}
                                  onChange={(e) => setEdits((x) => ({ ...x, [s.sku]: e.target.value.replace(/\D/g, "") }))}
                                  onKeyDown={(e) => e.key === "Enter" && void saveRow(s.sku)}
                                  aria-label={`Lagersaldo ${s.sku}`}
                                />
                                {edits[s.sku] !== undefined && edits[s.sku] !== String(s.stock) ? (
                                  <button type="button" className="cz-link" onClick={() => void saveRow(s.sku)}>
                                    Spara
                                  </button>
                                ) : null}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
