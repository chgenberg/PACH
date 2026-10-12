"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { OrderDrawer, OrderFlags, StageBadge } from "@/components/supplier/OrderDrawer";
import { daysUntil, fmtDate, fmtTime, useDemand, useOrders } from "@/components/supplier/useSupplier";
import { sek } from "@/lib/pricing";
import { SUPPLIER_STAGES, type SupplierOrder } from "@/lib/supplierTypes";

type Todo = { order: SupplierOrder; text: string; urgent: boolean };

const isOpen = (o: SupplierOrder) => SUPPLIER_STAGES.indexOf(o.state.stage) < SUPPLIER_STAGES.indexOf("skickad");

function todosOf(orders: SupplierOrder[]): Todo[] {
  const out: Todo[] = [];
  for (const o of orders) {
    const issues = Object.values(o.state.issues).filter((i) => !i.resolved);
    if (o.short && !issues.length) out.push({ order: o, text: "Lagret räcker inte – flagga raden eller fyll på", urgent: true });
    if (o.late) out.push({ order: o, text: `Skulle ha skickats ${fmtDate(o.shipBy)} – föreslå nytt datum`, urgent: true });
    if (o.state.stage === "ny" && !o.short) out.push({ order: o, text: `Ny order · ${o.units} st · bekräfta`, urgent: daysUntil(o.shipBy) <= 5 });
    if (o.state.stage === "packad") out.push({ order: o, text: "Packad – fyll i spårningsnummer och skicka", urgent: false });
  }
  return out.sort((a, b) => Number(b.urgent) - Number(a.urgent)).slice(0, 8);
}

export default function SupplierOverview() {
  const { orders, error, act } = useOrders({ poll: 20_000 });
  const { demand } = useDemand();
  const [open, setOpen] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock is only read after mount
    setNow(Date.now());
  }, []);

  const list = useMemo(() => orders ?? [], [orders]);
  const kpi = useMemo(() => {
    const fresh = list.filter((o) => o.state.stage === "ny");
    const making = list.filter((o) => ["bekraftad", "i-tryck", "packad"].includes(o.state.stage));
    const week = list.filter((o) => isOpen(o) && daysUntil(o.shipBy, now || undefined) <= 7);
    const month = list.filter((o) => now && now - new Date(o.createdAt).getTime() < 30 * 86_400_000);
    return {
      fresh: fresh.length,
      freshUnits: fresh.reduce((s, o) => s + o.units, 0),
      making: making.length,
      week: week.length,
      month: month.reduce((s, o) => s + o.value, 0),
      monthUnits: month.reduce((s, o) => s + o.units, 0),
    };
  }, [list, now]);
  const todos = useMemo(() => todosOf(list), [list]);
  const shipping = useMemo(() => list.filter(isOpen).sort((a, b) => a.shipBy.localeCompare(b.shipBy)).slice(0, 6), [list]);
  const feed = useMemo(
    () =>
      list
        .flatMap((o) => o.state.history.map((h) => ({ ...h, order: o })))
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 10),
    [list],
  );
  const selected = list.find((o) => o.number === open) ?? null;

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1>Översikt</h1>
          <p>Ordrar från PACH att bekräfta, det som ska ut den här veckan och vad kunderna designar just nu.</p>
        </div>
        <Link href="/leverantor/ordrar" className="dash-btn">
          Alla ordrar
        </Link>
      </div>

      <div className="kpis">
        <div>
          <span>Nya att bekräfta</span>
          <strong>{kpi.fresh}</strong>
          <small>{kpi.freshUnits} st</small>
        </div>
        <div>
          <span>I produktion</span>
          <strong>{kpi.making}</strong>
        </div>
        <div>
          <span>Ska skickas inom 7 dagar</span>
          <strong>{kpi.week}</strong>
        </div>
        <div>
          <span>Via PACH, 30 dagar</span>
          <strong>{sek(kpi.month)}</strong>
          <small>{kpi.monthUnits.toLocaleString("sv-SE")} st</small>
        </div>
      </div>

      {error ? <p className="brandbar-err">{error}</p> : null}

      <div className="sp-ov">
        <section className="card sp-todo">
          <h2>Att göra</h2>
          {orders === null ? <p className="drawer-note">Hämtar…</p> : null}
          {orders && !todos.length ? <p className="drawer-note">Allt är bekräftat och på väg.</p> : null}
          <ul>
            {todos.map((t, i) => (
              <li key={`${t.order.number}-${i}`} className={t.urgent ? "is-urgent" : ""}>
                <button type="button" onClick={() => setOpen(t.order.number)}>
                  <b>{t.order.customer}</b>
                  <span>{t.text}</span>
                  <small>{t.order.number}</small>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="card sp-ship-list">
          <h2>Närmaste utskick</h2>
          <ul>
            {shipping.map((o) => {
              const d = daysUntil(o.shipBy, now || undefined);
              return (
                <li key={o.number}>
                  <span className={`ov-days${d <= 3 ? " is-soon" : ""}`}>
                    <b>{Math.max(0, d)}</b>
                    <small>dagar</small>
                  </span>
                  <button type="button" onClick={() => setOpen(o.number)}>
                    <b>{o.customer}</b>
                    <span>
                      {fmtDate(o.shipBy)} · {o.units} st · <StageBadge order={o} /> <OrderFlags order={o} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card sp-demand-mini">
          <div className="sp-card-head">
            <h2>På väg in</h2>
            <Link href="/leverantor/efterfragan" className="cz-link">
              Efterfrågan →
            </Link>
          </div>
          <p className="drawer-note">Produkter i PACH-offerter som kunderna inte har godkänt än – en prognos innan ordern kommer.</p>
          <ul>
            {(demand?.products ?? []).filter((p) => p.expected).slice(0, 5).map((p) => (
              <li key={p.productId}>
                {/* eslint-disable-next-line @next/next/no-img-element -- catalogue image */}
                <img src={p.image} alt="" />
                <span>
                  <b>{p.name}</b>
                  <small>{p.brand}</small>
                </span>
                <span className="r">
                  <b>~{p.expected} st</b>
                  <small>{p.available >= p.expected ? "Lager räcker" : "Fyll på lagret"}</small>
                </span>
              </li>
            ))}
          </ul>
          {demand && !demand.products.some((p) => p.expected) ? <p className="drawer-note">Inga öppna offerter på era produkter just nu.</p> : null}
        </section>

        <section className="card sp-feed">
          <h2>Senaste händelser</h2>
          <ol>
            {feed.map((f, i) => (
              <li key={`${f.order.number}-${f.at}-${i}`}>
                <button type="button" onClick={() => setOpen(f.order.number)}>
                  <small>
                    {fmtTime(f.at)} · {f.order.customer}
                  </small>
                  <span>{f.text}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {selected ? <OrderDrawer order={selected} onClose={() => setOpen(null)} act={act} /> : null}
    </div>
  );
}
