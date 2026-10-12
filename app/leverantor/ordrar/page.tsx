"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { OrderDrawer, OrderFlags, StageBadge } from "@/components/supplier/OrderDrawer";
import { downloadCsv, fmtDate, useOrders } from "@/components/supplier/useSupplier";
import { sek } from "@/lib/pricing";
import { SUPPLIER_STAGES, type SupplierOrder } from "@/lib/supplierTypes";

const FILTERS = [
  { id: "alla", label: "Alla", test: () => true },
  { id: "nya", label: "Nya", test: (o: SupplierOrder) => o.state.stage === "ny" },
  { id: "pagaende", label: "Pågående", test: (o: SupplierOrder) => ["bekraftad", "i-tryck", "packad"].includes(o.state.stage) },
  { id: "skickade", label: "Skickade", test: (o: SupplierOrder) => o.state.stage === "skickad" || o.state.stage === "levererad" },
  { id: "flaggor", label: "Behöver åtgärd", test: (o: SupplierOrder) => o.late || o.short || Object.values(o.state.issues).some((i) => !i.resolved) },
] as const;

function Orders() {
  const params = useSearchParams();
  const router = useRouter();
  const { orders, error, act } = useOrders({ poll: 30_000 });
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("alla");
  const [q, setQ] = useState("");
  const open = params.get("open");
  const setOpen = (n: string | null) => router.replace(n ? `/leverantor/ordrar?open=${n}` : "/leverantor/ordrar", { scroll: false });

  const list = useMemo(() => orders ?? [], [orders]);
  const shown = useMemo(() => {
    const test = FILTERS.find((f) => f.id === filter)!.test;
    const needle = q.trim().toLowerCase();
    return list.filter((o) => test(o) && (!needle || `${o.number} ${o.customer} ${o.ref} ${o.lines.map((l) => `${l.name} ${l.brand} ${l.rows.map((r) => r.sku).join(" ")}`).join(" ")}`.toLowerCase().includes(needle)));
  }, [list, filter, q]);
  const selected = list.find((o) => o.number === open) ?? null;

  const kpi = {
    open: list.filter((o) => SUPPLIER_STAGES.indexOf(o.state.stage) < SUPPLIER_STAGES.indexOf("skickad")).length,
    units: list.filter((o) => SUPPLIER_STAGES.indexOf(o.state.stage) < SUPPLIER_STAGES.indexOf("skickad")).reduce((s, o) => s + o.units, 0),
    action: list.filter(FILTERS[4].test).length,
    value: list.reduce((s, o) => s + o.value, 0),
  };

  const exportCsv = () =>
    downloadCsv(`nwg-ordrar-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Order", "PACH-order", "Kund", "Status", "Skickas senast", "Artikelnr", "Produkt", "Varumärke", "Färg", "Storlek", "Antal", "Märkning"],
      ...shown.flatMap((o) =>
        o.lines.flatMap((l) => l.rows.map((r) => [o.number, o.ref, o.customer, o.state.stage, o.shipBy, r.sku, l.name, l.brand, l.color, r.size, r.qty, l.marking.join(" | ")])),
      ),
    ]);

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1>Inköpsordrar</h1>
          <p>Varje godkänd PACH-offert blir en order per leverantör – med artikelnummer, storlekar, tryckpositioner och korrektur.</p>
        </div>
        <button type="button" className="dash-btn ghost" onClick={exportCsv} disabled={!shown.length}>
          Exportera CSV
        </button>
      </div>

      <div className="kpis">
        <div>
          <span>Öppna ordrar</span>
          <strong>{kpi.open}</strong>
          <small>{kpi.units.toLocaleString("sv-SE")} st</small>
        </div>
        <div>
          <span>Behöver åtgärd</span>
          <strong>{kpi.action}</strong>
        </div>
        <div>
          <span>Ordrar totalt</span>
          <strong>{list.length}</strong>
        </div>
        <div>
          <span>Ordervärde</span>
          <strong>{sek(kpi.value)}</strong>
        </div>
      </div>

      <div className="sp-toolbar">
        <div className="seg">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
              {f.id !== "alla" ? <span className="sp-seg-n">{list.filter(f.test).length}</span> : null}
            </button>
          ))}
        </div>
        <input className="sp-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sök kund, order, artikelnummer…" aria-label="Sök" />
      </div>

      {error ? <p className="brandbar-err">{error}</p> : null}

      <div className="table sp-table">
        <div className="tr th">
          <span>Order</span>
          <span>Produkter</span>
          <span>Skickas senast</span>
          <span className="r">Värde</span>
          <span>Status</span>
        </div>
        {orders === null ? <p className="table-empty">Hämtar…</p> : null}
        {orders && !shown.length ? <p className="table-empty">Inga ordrar matchar.</p> : null}
        {shown.map((o) => (
          <button key={o.number} type="button" className="tr" onClick={() => setOpen(o.number)}>
            <span>
              <b>{o.customer}</b>
              <small>
                {o.number} · {fmtDate(o.createdAt)}
              </small>
            </span>
            <span className="sp-thumbs">
              {o.lines.slice(0, 4).map((l) => (
                // eslint-disable-next-line @next/next/no-img-element -- catalogue image
                <img key={l.productId} src={l.image} alt={l.name} title={`${l.name} · ${l.qty} st`} />
              ))}
              <small>
                {o.units} st · {o.brands.join(", ")}
              </small>
            </span>
            <span>
              <b className={o.late ? "is-late" : ""}>{fmtDate(o.shipBy)}</b>
              <small>{o.needBy ? `Kund: ${fmtDate(o.needBy)}` : "Inget kunddatum"}</small>
            </span>
            <span className="r">
              <b>{sek(o.value)}</b>
            </span>
            <span className="sp-status">
              <StageBadge order={o} />
              <OrderFlags order={o} />
            </span>
          </button>
        ))}
      </div>

      {selected ? <OrderDrawer order={selected} onClose={() => setOpen(null)} act={act} /> : null}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense>
      <Orders />
    </Suspense>
  );
}
