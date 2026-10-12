"use client";

import { fmtDate, useDemand } from "@/components/supplier/useSupplier";

const weekNo = (isoDate: string) => {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - jan4.getTime()) / 86_400_000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
};

export default function DemandPage() {
  const { demand, error } = useDemand();
  const max = Math.max(1, ...(demand?.weeks ?? []).map((w) => w.units));
  const brandMax = Math.max(1, ...(demand?.brands ?? []).map((b) => b.units));
  const methodSum = (demand?.methods ?? []).reduce((s, m) => s + m.count, 0) || 1;
  const pipeline = (demand?.products ?? []).reduce((s, p) => s + p.pipeline, 0);
  const expected = (demand?.products ?? []).reduce((s, p) => s + p.expected, 0);
  const designs = (demand?.products ?? []).reduce((s, p) => s + p.designs, 0);

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1>Efterfrågan</h1>
          <p>Vad PACH:s kunder designar i 3D och lägger i offerter – innan det blir order. Kunderna visas inte, bara produkter, mängder och datum.</p>
        </div>
      </div>

      {error ? <p className="brandbar-err">{error}</p> : null}

      <div className="kpis">
        <div>
          <span>I öppna offerter</span>
          <strong>{pipeline.toLocaleString("sv-SE")} st</strong>
        </div>
        <div>
          <span>Sannolik order</span>
          <strong>~{expected.toLocaleString("sv-SE")} st</strong>
          <small>de närmaste 2–3 veckorna</small>
        </div>
        <div>
          <span>Andel offerter som blir order</span>
          <strong>{demand ? Math.round(demand.conversion * 100) : 0} %</strong>
        </div>
        <div>
          <span>Designade i 3D</span>
          <strong>{designs}</strong>
          <small>produktrader</small>
        </div>
      </div>

      <div className="sp-demand">
        <section className="card sp-chart">
          <div className="sp-card-head">
            <h2>Beställda styck per vecka</h2>
            <span className="drawer-note">12 veckor</span>
          </div>
          <div className="sp-bars" role="img" aria-label="Beställda styck per vecka">
            {(demand?.weeks ?? []).map((w, i, all) => (
              <div key={w.week} className={i === all.length - 1 ? "is-now" : ""} title={`v. ${weekNo(w.week)}: ${w.units} st`}>
                <span style={{ height: `${Math.max(4, (w.units / max) * 100)}%` }} />
                <small>v{weekNo(w.week)}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Per varumärke</h2>
          <ul className="sp-hbars">
            {(demand?.brands ?? []).map((b) => (
              <li key={b.brand}>
                <span>{b.brand}</span>
                <i style={{ width: `${(b.units / brandMax) * 100}%` }} />
                <b>{b.units.toLocaleString("sv-SE")}</b>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2>Tryckmetoder</h2>
          <ul className="sp-hbars is-pct">
            {(demand?.methods ?? []).map((m) => (
              <li key={m.method}>
                <span>{m.method}</span>
                <i style={{ width: `${(m.count / methodSum) * 100}%` }} />
                <b>{Math.round((m.count / methodSum) * 100)} %</b>
              </li>
            ))}
          </ul>
          <h2 className="sp-h2-gap">Färger</h2>
          <div className="sp-colors">
            {(demand?.colors ?? []).map((c) => (
              <span key={c.hex}>
                <i style={{ background: c.hex }} />
                {c.color} <small>{c.count}</small>
              </span>
            ))}
          </div>
        </section>

        <section className="card sp-upcoming">
          <h2>Kommande behov</h2>
          <p className="drawer-note">Offerter med datum som kunden ännu inte har godkänt.</p>
          <ul>
            {(demand?.upcoming ?? []).map((u, i) => (
              <li key={`${u.date}-${i}`}>
                <b>{fmtDate(u.date)}</b>
                <span>
                  {u.units} st · {u.brands.join(", ")}
                </span>
                <small>{u.status}</small>
              </li>
            ))}
          </ul>
          {demand && !demand.upcoming.length ? <p className="drawer-note">Inga öppna offerter med datum just nu.</p> : null}
        </section>
      </div>

      <div className="table sp-table sp-forecast">
        <div className="tr th">
          <span>Produkt</span>
          <span className="r">I offerter</span>
          <span className="r">Sannolik order</span>
          <span className="r">Beställt</span>
          <span className="r">Ledigt lager</span>
        </div>
        {demand === null ? <p className="table-empty">Räknar…</p> : null}
        {(demand?.products ?? []).map((p) => (
          <div key={p.productId} className="tr">
            <span className="sp-prod">
              {/* eslint-disable-next-line @next/next/no-img-element -- catalogue image */}
              <img src={p.image} alt="" />
              <span>
                <b>{p.name}</b>
                <small>
                  {p.brand}
                  {p.designs ? ` · ${p.designs} designade i 3D` : ""}
                </small>
              </span>
            </span>
            <span className="r">{p.pipeline || "–"}</span>
            <span className="r">
              <b>{p.expected ? `~${p.expected}` : "–"}</b>
            </span>
            <span className="r">{p.won || "–"}</span>
            <span className="r">
              <b className={p.available < p.expected ? "is-late" : ""}>{p.available.toLocaleString("sv-SE")}</b>
              {p.available < p.expected ? <small>Fyll på</small> : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
