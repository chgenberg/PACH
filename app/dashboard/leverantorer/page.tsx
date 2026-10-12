"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fmtDate } from "@/components/dashboard/useQuotes";
import { fmtDay } from "@/lib/delivery";
import { sek } from "@/lib/pricing";
import type { SupplierAction, SupplierView } from "@/lib/supplierProfiles";

function ActionItem({ supplierId, action, run, busy }: { supplierId: string; action: SupplierAction; run: (supplierId: string, kind: string, payload?: Record<string, string>) => void; busy: boolean }) {
  const cta = action.cta;
  return (
    <li className={`su-action is-${action.tone}`}>
      <div>
        <b>{action.title}</b>
        <span>{action.detail}</span>
      </div>
      <div className="su-action-btns">
        {action.secondary ? (
          <a className="cz-link" href={action.secondary.href}>
            {action.secondary.label}
          </a>
        ) : null}
        {cta && "href" in cta ? (
          <Link className="dash-btn ghost sp-small" href={cta.href}>
            {cta.label}
          </Link>
        ) : cta ? (
          <button type="button" className={`dash-btn sp-small${action.tone === "urgent" ? "" : " ghost"}`} disabled={busy} onClick={() => run(supplierId, cta.kind, cta.payload)}>
            {cta.label}
          </button>
        ) : null}
      </div>
    </li>
  );
}

function SupplierCard({ s, run, busy }: { s: SupplierView; run: (supplierId: string, kind: string, payload?: Record<string, string>) => void; busy: string }) {
  const [showOrders, setShowOrders] = useState(false);
  const p = s.profile;
  const t = p.terms;
  const urgent = s.actions.filter((a) => a.tone === "urgent").length;
  const todo = s.actions.filter((a) => a.tone !== "info").length;
  const terms: [string, string][] = [
    ["Betalning", t.payment],
    ["Frakt", t.freight],
    ["Minsta order", sek(t.minOrder)],
    ["Leveranstid", t.leadTime],
    ["Tryck", t.print],
    ["Reklamation", t.returns],
    ["Bonus", t.bonus],
    ["Avtal gäller till", fmtDay(s.contractUntil)],
    ["Prislista från", fmtDay(s.priceListDate)],
  ];

  return (
    <article className="card su-card" id={p.id}>
      <header className="su-head">
        <span className="sp-mark" style={{ background: p.mark }} aria-hidden>
          {p.short}
        </span>
        <div className="su-title">
          <h2>
            {p.name}
            <i className={`su-int is-${p.integration}`}>{p.integration === "portal" ? "Leverantörsportal" : "Order via e-post"}</i>
          </h2>
          <p>{p.categories}</p>
        </div>
        <dl className="su-stats">
          <div>
            <dt>Produkter</dt>
            <dd>{s.products.length}</dd>
          </div>
          <div>
            <dt>Öppna ordrar</dt>
            <dd>{s.openOrders}</dd>
          </div>
          <div>
            <dt>Inköp 90 d</dt>
            <dd>{sek(s.spend90)}</dd>
          </div>
          <div>
            <dt>Levererat i tid</dt>
            <dd className={p.onTime < 0.9 ? "is-warn" : ""}>{Math.round(p.onTime * 100)} %</dd>
          </div>
        </dl>
      </header>

      <div className="su-body">
        <section>
          <h3>
            Åtgärder {todo ? <span className={urgent ? "is-urgent" : ""}>{todo}</span> : null}
          </h3>
          {s.actions.length ? (
            <ul className="su-actions">
              {s.actions.map((a) => (
                <ActionItem key={a.id} supplierId={p.id} action={a} run={run} busy={busy === p.id} />
              ))}
            </ul>
          ) : (
            <p className="su-clear">✓ Inget som väntar på er just nu.</p>
          )}
        </section>

        <section className="su-terms">
          <h3>Villkor</h3>
          <dl>
            {terms.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="su-contact">
            <b>{p.contact.name}</b> · {p.contact.role}
            <span>
              <a href={`mailto:${p.contact.email}`}>{p.contact.email}</a> · {p.contact.phone}
            </span>
          </div>
          {p.note ? <p className="drawer-note">{p.note}</p> : null}
        </section>
      </div>

      <footer className="su-foot">
        <span className="sp-thumbs">
          {s.products.slice(0, 10).map((x) => (
            // eslint-disable-next-line @next/next/no-img-element -- catalogue image
            <img key={x.id} src={x.image} alt={x.name} title={x.name} />
          ))}
          {s.products.length > 10 ? <small>+{s.products.length - 10}</small> : null}
        </span>
        <span className="su-foot-links">
          {s.orders.length ? (
            <button type="button" className="cz-link" onClick={() => setShowOrders((v) => !v)} aria-expanded={showOrders}>
              {showOrders ? "Dölj ordrar" : `Visa ordrar (${s.orders.length})`}
            </button>
          ) : null}
          {p.integration === "portal" ? (
            <Link className="dash-btn ghost sp-small" href="/leverantor">
              Öppna leverantörsportalen
            </Link>
          ) : null}
        </span>
      </footer>

      {showOrders ? (
        <table className="sp-sizes su-orders">
          <thead>
            <tr>
              <th>Kund</th>
              <th>Order</th>
              <th>Datum</th>
              <th className="r">Antal</th>
              <th className="r">Inköp</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {s.orders.map((o) => (
              <tr key={o.key}>
                <td>{o.href ? <a href={o.href}>{o.customer}</a> : o.customer}</td>
                <td>{o.ref}</td>
                <td>{fmtDate(o.date)}</td>
                <td className="r">{o.units}</td>
                <td className="r">{sek(o.value)}</td>
                <td>{o.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </article>
  );
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierView[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [onlyTodo, setOnlyTodo] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard/suppliers", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setSuppliers(j.suppliers ?? []))
      .catch(() => setError("Kunde inte hämta leverantörerna."));
  }, []);

  const run = async (supplierId: string, kind: string, payload?: Record<string, string>) => {
    setBusy(supplierId);
    setError("");
    const res = await fetch("/api/dashboard/suppliers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ supplierId, kind, payload }) });
    const j = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) return setError(j.error ?? "Kunde inte spara.");
    setSuppliers(j.suppliers);
  };

  const list = useMemo(() => suppliers ?? [], [suppliers]);
  const kpi = useMemo(() => {
    const actions = list.flatMap((s) => s.actions.filter((a) => a.tone !== "info"));
    const spend = list.reduce((s, x) => s + x.spend90, 0);
    const weighted = spend ? list.reduce((s, x) => s + x.profile.onTime * x.spend90, 0) / spend : 0;
    return { actions: actions.length, urgent: actions.filter((a) => a.tone === "urgent").length, spend, onTime: Math.round(weighted * 100) };
  }, [list]);
  const shown = onlyTodo ? list.filter((s) => s.actions.some((a) => a.tone !== "info")) : list;

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1>Leverantörer</h1>
          <p>Villkor per leverantör och det som behöver göras – inköpsordrar, bekräftelser, flaggor, avtal, prislistor och fakturor.</p>
        </div>
      </div>

      <div className="kpis">
        <div>
          <span>Leverantörer</span>
          <strong>{list.length}</strong>
          <small>{list.filter((s) => s.profile.integration === "portal").length} i portalen</small>
        </div>
        <div>
          <span>Åtgärder som krävs</span>
          <strong className={kpi.urgent ? "su-urgent-n" : ""}>{kpi.actions}</strong>
          <small>{kpi.urgent} brådskande</small>
        </div>
        <div>
          <span>Inköp senaste 90 dagarna</span>
          <strong>{sek(kpi.spend)}</strong>
        </div>
        <div>
          <span>Levererat i tid</span>
          <strong>{kpi.onTime} %</strong>
          <small>viktat på inköp</small>
        </div>
      </div>

      <div className="sp-toolbar">
        <div className="seg">
          <button type="button" aria-pressed={!onlyTodo} onClick={() => setOnlyTodo(false)}>
            Alla
          </button>
          <button type="button" aria-pressed={onlyTodo} onClick={() => setOnlyTodo(true)}>
            Kräver åtgärd
          </button>
        </div>
        <nav className="su-jump" aria-label="Hoppa till leverantör">
          {list.map((s) => (
            <a key={s.profile.id} href={`#${s.profile.id}`}>
              {s.profile.name}
              {s.actions.some((a) => a.tone === "urgent") ? <i aria-label="brådskande" /> : null}
            </a>
          ))}
        </nav>
      </div>

      {error ? <p className="brandbar-err">{error}</p> : null}
      {suppliers === null ? <p className="drawer-note">Hämtar…</p> : null}

      <div className="su-list">
        {shown.map((s) => (
          <SupplierCard key={s.profile.id} s={s} run={(id, kind, payload) => void run(id, kind, payload)} busy={busy} />
        ))}
      </div>
    </div>
  );
}
