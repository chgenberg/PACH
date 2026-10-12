"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { downloadCsv, fmtDate, useOrders } from "@/components/supplier/useSupplier";
import { sek } from "@/lib/pricing";
import { SUPPLIER_STAGE_LABEL, type SupplierOrder } from "@/lib/supplierTypes";

type Filter = "att" | "fakturerade" | "alla";

const shipped = (o: SupplierOrder) => o.state.stage === "skickad" || o.state.stage === "levererad";
const sentAt = (o: SupplierOrder) => [...o.state.history].reverse().find((h) => h.stage === "skickad")?.at ?? o.createdAt;

export default function SettlementPage() {
  const { orders, error, act } = useOrders();
  const [filter, setFilter] = useState<Filter>("att");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");

  const list = useMemo(() => (orders ?? []).filter(shipped), [orders]);
  const shown = list.filter((o) => (filter === "att" ? !o.state.invoice : filter === "fakturerade" ? Boolean(o.state.invoice) : true));
  const todo = list.filter((o) => !o.state.invoice);
  const invoiced = list.filter((o) => o.state.invoice);
  const [now, setNow] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock is only read after mount
    setNow(Date.now());
  }, []);
  const today = new Date(now || 0).toISOString().slice(0, 10);
  const soon = new Date((now || 0) + 14 * 86_400_000).toISOString().slice(0, 10);

  const invoice = async (numbers: string[]) => {
    setBusy(numbers.length > 1 ? "alla" : numbers[0]);
    for (const n of numbers) {
      const err = await act(n, { action: "invoice" });
      if (err) setNote(err);
    }
    setBusy("");
  };

  const exportCsv = () =>
    downloadCsv(`nwg-avrakning-${today}.csv`, [
      ["Order", "PACH-order", "Kund", "Skickad", "Produkt", "Antal", "Pris/st", "Tryck/st", "Tryckstart", "Belopp exkl. moms", "Faktura", "Förfaller"],
      ...shown.flatMap((o) => o.lines.map((l) => [o.number, o.ref, o.customer, sentAt(o).slice(0, 10), l.name, l.qty, l.unit, l.printUnit, l.printSetup, l.total, o.state.invoice?.number ?? "", o.state.invoice?.due ?? ""])),
    ]);

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1>Avräkning</h1>
          <p>Skickade ordrar faktureras PACH med 30 dagars betalningsvillkor. Beloppen är exkl. moms och räknas med era priser.</p>
        </div>
        <button type="button" className="dash-btn ghost" onClick={exportCsv} disabled={!shown.length}>
          Exportera CSV
        </button>
      </div>

      <div className="kpis">
        <div>
          <span>Att fakturera</span>
          <strong>{sek(todo.reduce((s, o) => s + o.value, 0))}</strong>
          <small>{todo.length} ordrar</small>
        </div>
        <div>
          <span>Fakturerat</span>
          <strong>{sek(invoiced.reduce((s, o) => s + (o.state.invoice?.amount ?? 0), 0))}</strong>
        </div>
        <div>
          <span>Förfaller inom 14 dagar</span>
          <strong>{sek(invoiced.filter((o) => now && o.state.invoice!.due <= soon).reduce((s, o) => s + (o.state.invoice?.amount ?? 0), 0))}</strong>
        </div>
        <div>
          <span>Betalningsvillkor</span>
          <strong>30 dagar</strong>
        </div>
      </div>

      <div className="sp-toolbar">
        <div className="seg">
          {(
            [
              ["att", `Att fakturera (${todo.length})`],
              ["fakturerade", `Fakturerade (${invoiced.length})`],
              ["alla", "Alla"],
            ] as [Filter, string][]
          ).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>
        {filter === "att" && todo.length > 1 ? (
          <button type="button" className="dash-btn" disabled={Boolean(busy)} onClick={() => void invoice(todo.map((o) => o.number))}>
            {busy === "alla" ? "Fakturerar…" : `Fakturera alla (${todo.length})`}
          </button>
        ) : null}
      </div>

      {error || note ? <p className="brandbar-err">{error || note}</p> : null}

      <div className="table sp-table sp-settle">
        <div className="tr th">
          <span>Order</span>
          <span>Skickad</span>
          <span className="r">Belopp</span>
          <span>Faktura</span>
          <span />
        </div>
        {orders === null ? <p className="table-empty">Hämtar…</p> : null}
        {orders && !shown.length ? <p className="table-empty">{filter === "att" ? "Inget att fakturera just nu." : "Inga ordrar."}</p> : null}
        {shown.map((o) => {
          const isOpen = open === o.number;
          return (
            <Fragment key={o.number}>
              <div className={`tr${isOpen ? " is-open" : ""}`}>
                <button type="button" className="sp-row-btn" onClick={() => setOpen(isOpen ? null : o.number)} aria-expanded={isOpen}>
                  <b>{o.customer}</b>
                  <small>
                    {o.number} · {o.units} st · {SUPPLIER_STAGE_LABEL[o.state.stage]}
                  </small>
                </button>
                <span>{fmtDate(sentAt(o))}</span>
                <span className="r">
                  <b>{sek(o.value)}</b>
                </span>
                <span>
                  {o.state.invoice ? (
                    <>
                      <b>{o.state.invoice.number}</b>
                      <small className={o.state.invoice.due < today ? "is-late" : ""}>Förfaller {fmtDate(o.state.invoice.due)}</small>
                    </>
                  ) : (
                    <small>Ej fakturerad</small>
                  )}
                </span>
                <span className="r">
                  {o.state.invoice ? null : (
                    <button type="button" className="dash-btn ghost sp-small" disabled={Boolean(busy)} onClick={() => void invoice([o.number])}>
                      {busy === o.number ? "…" : "Fakturera"}
                    </button>
                  )}
                </span>
              </div>
              {isOpen ? (
                <div className="sp-variants">
                  <table className="sp-sizes">
                    <thead>
                      <tr>
                        <th>Produkt</th>
                        <th className="r">Antal</th>
                        <th className="r">Pris/st</th>
                        <th className="r">Tryck/st</th>
                        <th className="r">Tryckstart</th>
                        <th className="r">Summa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {o.lines.map((l) => (
                        <tr key={l.productId}>
                          <td>
                            {l.name} <small>{l.brand}</small>
                          </td>
                          <td className="r">{l.qty}</td>
                          <td className="r">{l.unit} kr</td>
                          <td className="r">{l.printUnit} kr</td>
                          <td className="r">{l.printSetup} kr</td>
                          <td className="r">
                            <b>{sek(l.total)}</b>
                          </td>
                        </tr>
                      ))}
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
