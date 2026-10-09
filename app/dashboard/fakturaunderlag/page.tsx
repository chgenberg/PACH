"use client";

import { Fragment, useMemo, useState } from "react";
import { useBrandbook } from "@/components/dashboard/brandbook";
import { fmtDate, useQuotes } from "@/components/dashboard/useQuotes";
import { invoiceBasis } from "@/lib/invoice";
import { sek } from "@/lib/pricing";
import type { QuoteView } from "@/lib/quoteTypes";

type Filter = "alla" | "Väntar" | "Godkänd" | "Fakturerad";

const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

function downloadCsv(rows: QuoteView[]) {
  const head = ["Kund", "Offertnr", "Datum", "Produkt", "Antal", "À-pris inkl. tryck", "Tryckstart", "Belopp exkl. moms", "Kost %", "Kost", "TB", "Z-godkänd", "Fakturanr"];
  const lines = rows.flatMap((q) => {
    const b = invoiceBasis(q);
    return b.lines.map((l) =>
      [q.company, q.ref, fmtDate(q.createdAt), l.name, l.qty, l.unitInclPrint, l.setup, l.lineTotal, l.kostPct, l.cost, l.tb, q.invoice.approved ? "Ja" : "Nej", q.invoice.invoiceNumber ?? ""].map(csvCell).join(";"),
    );
  });
  const blob = new Blob([`\uFEFF${[head.map(csvCell).join(";"), ...lines].join("\n")}`], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `fakturaunderlag-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function InvoicePage() {
  const { quotes, error, patch } = useQuotes();
  const { book } = useBrandbook();
  const [filter, setFilter] = useState<Filter>("alla");
  const [open, setOpen] = useState<string | null>(null);

  /** Orders = quotes the customer accepted. */
  const orders = useMemo(() => (quotes ?? []).filter((q) => q.status === "godkand" || q.status === "fakturerad"), [quotes]);
  const shown = orders.filter((q) => filter === "alla" || invoiceBasis(q).status === filter);
  const kpi = useMemo(() => {
    const bases = orders.map(invoiceBasis);
    const net = bases.reduce((s, b) => s + b.net, 0);
    const tb = bases.reduce((s, b) => s + b.tb, 0);
    return {
      count: orders.length,
      toInvoice: bases.filter((b) => b.status !== "Fakturerad").reduce((s, b) => s + b.net, 0),
      invoiced: bases.filter((b) => b.status === "Fakturerad").reduce((s, b) => s + b.gross, 0),
      tb,
      tbPct: net ? Math.round((tb / net) * 100) : 0,
    };
  }, [orders]);

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1>Fakturaunderlag</h1>
          <p>Godkända offerter blir underlag. Kontrollera kost och TB, Z-godkänn och fakturera.</p>
        </div>
        <button type="button" className="dash-btn ghost" onClick={() => downloadCsv(shown)} disabled={!shown.length}>
          Ladda ner CSV
        </button>
      </div>

      <div className="kpis">
        <div><span>Ordrar</span><strong>{kpi.count}</strong></div>
        <div><span>Att fakturera exkl. moms</span><strong>{sek(kpi.toInvoice)}</strong></div>
        <div><span>Fakturerat inkl. moms</span><strong>{sek(kpi.invoiced)}</strong></div>
        <div><span>Täckningsbidrag</span><strong>{sek(kpi.tb)} <small>{kpi.tbPct} %</small></strong></div>
      </div>

      <div className="seg">
        {(["alla", "Väntar", "Godkänd", "Fakturerad"] as Filter[]).map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === "alla" ? "Alla" : f}
          </button>
        ))}
      </div>

      {error ? <p className="brandbar-err">{error}</p> : null}

      <div className="table">
        <div className="tr th inv">
          <span>Order</span>
          <span>Kund</span>
          <span className="r">Belopp</span>
          <span className="r">TB</span>
          <span>Status</span>
        </div>
        {quotes === null ? <p className="table-empty">Hämtar underlag…</p> : null}
        {quotes && shown.length === 0 ? <p className="table-empty">Inga underlag här. Godkänn en offert under Offerter.</p> : null}
        {shown.map((q) => {
          const b = invoiceBasis(q);
          const isOpen = open === q.ref;
          return (
            <Fragment key={q.ref}>
              <button type="button" className={`tr inv${isOpen ? " is-open" : ""}`} onClick={() => setOpen(isOpen ? null : q.ref)} aria-expanded={isOpen}>
                <span>
                  <b>{q.ref}</b>
                  <small>{fmtDate(q.createdAt)}</small>
                </span>
                <span>
                  <b>{q.company}</b>
                  <small>{q.priced.length} produkter</small>
                </span>
                <span className="r">
                  <b>{sek(b.net)}</b>
                </span>
                <span className="r">
                  {sek(b.tb)} <small>{b.tbPct} %</small>
                </span>
                <span>
                  <i className={`badge badge-${b.status === "Fakturerad" ? "fakturerad" : b.status === "Godkänd" ? "godkand" : "skapad"}`}>{b.status}</i>
                </span>
              </button>
              {isOpen ? (
                <div className="inv-detail">
                  <div className="inv-lines">
                    <div className="il il-head">
                      <span>Produkt</span>
                      <span className="r">Antal</span>
                      <span className="r">À-pris</span>
                      <span className="r">Belopp</span>
                      <span className="r">Kost %</span>
                      <span className="r">TB</span>
                    </div>
                    {b.lines.map((l) => (
                      <div key={l.productId} className="il">
                        <span>
                          <b>{l.name}</b>
                          <small>inkl. tryck · tryckstart {sek(l.setup)}</small>
                        </span>
                        <span className="r">{l.qty}</span>
                        <span className="r">{sek(l.unitInclPrint)}</span>
                        <span className="r">{sek(l.lineTotal)}</span>
                        <span className="r">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            defaultValue={l.kostPct}
                            disabled={Boolean(q.invoice.invoiceNumber)}
                            onBlur={(e) => Number(e.target.value) !== l.kostPct && void patch(q.ref, { kost: { productId: l.productId, pct: Number(e.target.value) } })}
                            aria-label={`Kost i procent för ${l.name}`}
                          />
                        </span>
                        <span className="r">{sek(l.tb)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="inv-side">
                    <dl>
                      <dt>Netto</dt>
                      <dd>{sek(b.net)}</dd>
                      <dt>Moms {book.terms.vatPct} %</dt>
                      <dd>{sek(b.vat)}</dd>
                      <dt>Att betala</dt>
                      <dd className="big">{sek(b.gross)}</dd>
                      <dt>Kost</dt>
                      <dd>{sek(b.cost)}</dd>
                      <dt>TB</dt>
                      <dd>
                        {sek(b.tb)} ({b.tbPct} %)
                      </dd>
                      {b.dueDate ? (
                        <>
                          <dt>Förfaller</dt>
                          <dd>{fmtDate(b.dueDate)}</dd>
                        </>
                      ) : null}
                    </dl>
                    <label className={`toggle${q.invoice.invoiceNumber ? " is-locked" : ""}`}>
                      <input type="checkbox" checked={q.invoice.approved} disabled={Boolean(q.invoice.invoiceNumber)} onChange={() => void patch(q.ref, { approved: !q.invoice.approved })} />
                      <span />
                      Z-godkänd
                    </label>
                    {q.invoice.invoiceNumber ? (
                      <p className="inv-done">Fakturerad · {q.invoice.invoiceNumber}</p>
                    ) : (
                      <button type="button" className="inv-go" disabled={!q.invoice.approved} onClick={() => void patch(q.ref, { invoice: true })}>
                        Fakturera
                      </button>
                    )}
                    <p className="drawer-note">Skapar ett fakturautkast (mock av Fortnox). Betalvillkor {book.terms.paymentDays} dagar.</p>
                  </div>
                </div>
              ) : null}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
