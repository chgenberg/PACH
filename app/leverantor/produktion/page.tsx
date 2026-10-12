"use client";

import { useEffect, useMemo, useState } from "react";
import { OrderDrawer, OrderFlags } from "@/components/supplier/OrderDrawer";
import { daysUntil, fmtDate, useOrders } from "@/components/supplier/useSupplier";
import { NEXT_ACTION, SUPPLIER_STAGE_LABEL, SUPPLIER_STAGES, type SupplierOrder } from "@/lib/supplierTypes";

const COLUMNS = SUPPLIER_STAGES.filter((s) => s !== "levererad");

export default function ProductionPage() {
  const { orders, error, act } = useOrders({ poll: 20_000 });
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [now, setNow] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock is only read after mount
    setNow(Date.now());
  }, []);

  const list = useMemo(() => orders ?? [], [orders]);
  const delivered = list.filter((o) => o.state.stage === "levererad").slice(0, 6);
  const selected = list.find((o) => o.number === open) ?? null;

  /** Cards move one step straight from the board – except shipping, which needs a tracking number. */
  const quick = async (o: SupplierOrder) => {
    if (o.state.stage === "packad") return setOpen(o.number);
    setBusy(o.number);
    const err = await act(o.number, { action: "advance" });
    setBusy("");
    setNote(err);
    if (err) setOpen(o.number);
  };

  return (
    <div className="dash-page wide">
      <div className="dash-head">
        <div>
          <h1>Produktion &amp; leverans</h1>
          <p>Flytta ordrarna framåt när de bekräftas, trycks, packas och skickas. PACH och kunden ser samma status direkt.</p>
        </div>
      </div>
      {error || note ? <p className="brandbar-err">{error || note}</p> : null}

      <div className="sp-board">
        {COLUMNS.map((stage) => {
          const cards = list.filter((o) => o.state.stage === stage).sort((a, b) => a.shipBy.localeCompare(b.shipBy));
          return (
            <section key={stage} className="sp-col">
              <h2>
                {SUPPLIER_STAGE_LABEL[stage]} <span>{cards.length}</span>
              </h2>
              {cards.map((o) => {
                const d = daysUntil(o.shipBy, now || undefined);
                return (
                  <article key={o.number} className={`sp-card${o.late ? " is-late" : ""}`}>
                    <button type="button" className="sp-card-open" onClick={() => setOpen(o.number)}>
                      <b>{o.customer}</b>
                      <small>
                        {o.number} · {o.units} st
                      </small>
                      <span className="sp-thumbs">
                        {o.lines.slice(0, 4).map((l) => (
                          // eslint-disable-next-line @next/next/no-img-element -- catalogue image
                          <img key={l.productId} src={l.image} alt={l.name} />
                        ))}
                      </span>
                      <span className="sp-card-meta">
                        {stage === "skickad" ? (
                          <span>{o.state.carrier ?? "Frakt"} · {o.state.tracking}</span>
                        ) : (
                          <span className={d <= 2 ? "is-soon" : ""}>Skickas {fmtDate(o.shipBy)} · {d < 0 ? `${-d} d sen` : d === 0 ? "i dag" : `${d} d`}</span>
                        )}
                        <OrderFlags order={o} />
                      </span>
                    </button>
                    {NEXT_ACTION[stage] ? (
                      <button type="button" className="sp-card-next" disabled={busy === o.number} onClick={() => void quick(o)}>
                        {busy === o.number ? "Sparar…" : `${NEXT_ACTION[stage]} →`}
                      </button>
                    ) : null}
                  </article>
                );
              })}
              {orders && !cards.length ? <p className="sp-col-empty">Inget här</p> : null}
            </section>
          );
        })}
      </div>

      {delivered.length ? (
        <section className="card sp-delivered">
          <h2>Senast levererade</h2>
          <ul>
            {delivered.map((o) => (
              <li key={o.number}>
                <button type="button" onClick={() => setOpen(o.number)}>
                  <b>{o.customer}</b>
                  <span>
                    {o.number} · {o.units} st · {o.state.carrier} {o.state.tracking}
                  </span>
                  <small>{o.state.invoice ? `Fakturerad ${o.state.invoice.number}` : "Ej fakturerad"}</small>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {selected ? <OrderDrawer order={selected} onClose={() => setOpen(null)} act={act} /> : null}
    </div>
  );
}
