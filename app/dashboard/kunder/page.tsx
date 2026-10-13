"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CustomerMark } from "@/components/dashboard/CustomerMark";
import { fmtDate } from "@/components/dashboard/useQuotes";
import type { CustomerSummary } from "@/lib/customerTypes";
import { sek } from "@/lib/pricing";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerSummary[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    let live = true;
    fetch("/api/dashboard/customers", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => live && setCustomers(j.customers ?? []))
      .catch(() => live && setError("Kunde inte hämta kunderna."));
    return () => {
      live = false;
    };
  }, []);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (customers ?? []).filter((c) => !s || c.name.toLowerCase().includes(s) || (c.host ?? "").includes(s) || c.contacts.some((x) => x.name.toLowerCase().includes(s) || x.email.includes(s)));
  }, [customers, q]);
  const kpi = useMemo(() => {
    const cs = customers ?? [];
    return { count: cs.length, buying: cs.filter((c) => c.orders).length, ordered: cs.reduce((s, c) => s + c.ordered, 0), requests: cs.reduce((s, c) => s + c.newRequests, 0) };
  }, [customers]);

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1>Kunder</h1>
          <p>Kunderna skapas automatiskt från offerterna – via webbadressen, annars företagsnamnet. Varje kund har en egen portal med offerter, ordrar och Beställ igen.</p>
        </div>
      </div>

      <div className="kpis">
        <div><span>Kunder</span><strong>{kpi.count}</strong></div>
        <div><span>Har beställt</span><strong>{kpi.buying}</strong></div>
        <div><span>Ordervärde exkl. moms</span><strong>{sek(kpi.ordered)}</strong></div>
        <div className={kpi.requests ? "kd-kpi-hot" : ""}><span>Nya önskemål</span><strong>{kpi.requests}</strong></div>
      </div>

      <input className="kd-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sök kund, webbadress eller kontakt" aria-label="Sök kund" />
      {error ? <p className="brandbar-err">{error}</p> : null}

      <div className="table kd-table">
        <div className="tr th">
          <span>Kund</span>
          <span>Kontakter</span>
          <span>Offerter · ordrar</span>
          <span className="r">Ordervärde</span>
          <span>Senast</span>
        </div>
        {customers === null ? <p className="table-empty">Hämtar kunder…</p> : null}
        {customers && shown.length === 0 ? <p className="table-empty">Inga kunder matchar.</p> : null}
        {shown.map((c) => (
          <Link key={c.key} href={`/dashboard/kunder/${c.key}`} className="tr">
            <span className="kd-cell-name">
              <CustomerMark name={c.name} host={c.host} />
              <span>
                <b>{c.name}</b>
                <small>{c.host ?? "Utan webbadress"}</small>
              </span>
            </span>
            <span>
              <b>{c.contacts[0]?.name ?? "—"}</b>
              <small>{c.contacts.length > 1 ? `+ ${c.contacts.length - 1} till` : (c.contacts[0]?.email ?? "")}</small>
            </span>
            <span>
              <b>
                {c.quotes} · {c.orders}
              </b>
              <small>{c.open ? `${c.open} öppna` : "Inga öppna"}</small>
            </span>
            <span className="r">
              <b>{sek(c.ordered)}</b>
            </span>
            <span>
              {c.newRequests ? <i className="badge badge-skapad kd-badge-hot">{c.newRequests} nytt önskemål</i> : <small>{c.lastAt ? fmtDate(c.lastAt) : ""}</small>}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
