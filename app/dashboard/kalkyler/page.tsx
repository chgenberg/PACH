"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MarginBadge } from "@/components/dashboard/MarginBadge";
import { useCosts } from "@/components/dashboard/useCosts";
import { fmtDate } from "@/components/dashboard/useQuotes";
import { familyById } from "@/lib/catalog";
import { economics, PRICE_MODE_LABEL } from "@/lib/costing";
import { KALKYL_STATUS_LABEL, type KalkylStatus, type KalkylSummary, kalkylStatus } from "@/lib/kalkylTypes";
import { sek } from "@/lib/pricing";

const FILTERS: ("alla" | KalkylStatus)[] = ["alla", "utkast", "i-offert", "arkiverad"];

export default function KalkylerPage() {
  const router = useRouter();
  const table = useCosts();
  const [list, setList] = useState<KalkylSummary[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"alla" | KalkylStatus>("alla");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/dashboard/kalkyler", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setList(j.kalkyler ?? []))
      .catch(() => setError("Kunde inte hämta kalkylerna."));
  }, []);

  const rows = useMemo(
    () =>
      (list ?? []).flatMap((k) => {
        const f = familyById(k.productId);
        if (!f) return [];
        return [{ k, f, eco: economics(f, k.qty, k.design, table, k.pricing), status: kalkylStatus(k), supplier: table?.products[f.id]?.supplierName ?? f.brand }];
      }),
    [list, table],
  );
  const shown = rows.filter(
    (r) =>
      (filter === "alla" ? r.status !== "arkiverad" : r.status === filter) &&
      `${r.k.title ?? ""} ${r.f.name} ${r.k.customer?.company ?? ""} ${r.supplier}`.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const active = rows.filter((r) => r.status !== "arkiverad");
  const kpi = {
    count: active.length,
    inOffer: active.filter((r) => r.status === "i-offert").length,
    value: active.reduce((s, r) => s + r.eco.sale.total, 0),
    tb: active.reduce((s, r) => s + r.eco.tb, 0),
  };
  const pickedRows = rows.filter((r) => picked.includes(r.k.id));
  const dupes = pickedRows.length !== new Set(pickedRows.map((r) => r.f.id)).size;
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1>Kalkyler</h1>
          <p>En kalkyl är en produkt hos en leverantör med antal, tryck och pris. Bocka i flera och bygg en offert av dem.</p>
        </div>
        <Link href="/dashboard/kalkyler/ny" className="dash-btn">
          + Ny kalkyl
        </Link>
      </div>

      <div className="kpis">
        <div>
          <span>Kalkyler</span>
          <strong>{kpi.count}</strong>
        </div>
        <div>
          <span>I offerter</span>
          <strong>{kpi.inOffer}</strong>
        </div>
        <div>
          <span>Värde exkl. moms</span>
          <strong>{sek(kpi.value)}</strong>
        </div>
        <div>
          <span>Täckningsbidrag</span>
          <strong>{sek(kpi.tb)}</strong>
          <small>{kpi.value ? Math.round((kpi.tb / kpi.value) * 100) : 0} %</small>
        </div>
      </div>

      <div className="sp-toolbar">
        <div className="seg">
          {FILTERS.map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === "alla" ? "Alla" : KALKYL_STATUS_LABEL[f]}
            </button>
          ))}
        </div>
        <input className="sp-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sök kund, produkt, leverantör…" aria-label="Sök" />
      </div>

      {error ? <p className="brandbar-err">{error}</p> : null}

      <div className="table kp-table">
        <div className="tr th">
          <span />
          <span>Kalkyl</span>
          <span>Kund</span>
          <span className="r">Försäljning</span>
          <span className="r">Marginal</span>
          <span>Status</span>
        </div>
        {list === null ? <p className="table-empty">Hämtar kalkyler…</p> : null}
        {list && !shown.length ? <p className="table-empty">Inga kalkyler här. Skapa en med ”Ny kalkyl”.</p> : null}
        {shown.map(({ k, f, eco, status, supplier }) => (
          <div key={k.id} className={`tr${picked.includes(k.id) ? " is-open" : ""}`}>
            <span>
              <input type="checkbox" className="kp-check" checked={picked.includes(k.id)} onChange={() => toggle(k.id)} aria-label={`Välj ${k.title || f.name}`} disabled={status === "arkiverad"} />
            </span>
            <Link href={`/dashboard/kalkyler/${k.id}`} className="sp-prod kp-row-link">
              <Image src={k.image || f.image} alt="" width={88} height={88} unoptimized={Boolean(k.image)} />
              <span>
                <b>{k.title || f.name}</b>
                <small>
                  {f.name} · {k.qty} st · {supplier} · {PRICE_MODE_LABEL[k.pricing.mode]}
                  {k.pricing.mode === "markup" ? ` ${k.pricing.markupPct} %` : ""}
                </small>
              </span>
            </Link>
            <span>
              <b>{k.customer?.company ?? "–"}</b>
              <small>{fmtDate(k.updatedAt)}</small>
            </span>
            <span className="r">
              <b>{sek(eco.sale.total)}</b>
              <small>{sek(eco.sale.unit)}/st</small>
            </span>
            <span className="r">
              <MarginBadge tb={eco.tb} pct={eco.marginPct} />
            </span>
            <span>
              <i className={`badge kp-st-${status}`}>{KALKYL_STATUS_LABEL[status]}</i>
              {k.usedIn.length ? <small>{k.usedIn.map((u) => u.company).join(", ")}</small> : null}
            </span>
          </div>
        ))}
      </div>

      {picked.length ? (
        <div className="save-bar">
          <span>
            {picked.length} valda · {sek(pickedRows.reduce((s, r) => s + r.eco.sale.total, 0))} · du tjänar {sek(pickedRows.reduce((s, r) => s + r.eco.tb, 0))}
            {dupes ? " · samma produkt finns två gånger" : ""}
          </span>
          <button type="button" className="dash-btn ghost" onClick={() => setPicked([])}>
            Avmarkera
          </button>
          <button type="button" className="dash-btn" disabled={dupes} onClick={() => router.push(`/dashboard/offerter/bygg?kalkyler=${picked.join(",")}`)}>
            Bygg offert av valda
          </button>
        </div>
      ) : null}
    </div>
  );
}
