"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { fmtDate, STATUS_LABEL, useQuotes } from "@/components/dashboard/useQuotes";
import { familyById } from "@/lib/catalog";
import { BASE_COLOR, colorName } from "@/lib/colors";
import { sek } from "@/lib/pricing";
import { QUOTE_STATUSES, type QuoteStatus } from "@/lib/quoteTypes";

const FILTERS: ("alla" | QuoteStatus)[] = ["alla", ...QUOTE_STATUSES];

export default function QuotesPage() {
  const { quotes, error, patch } = useQuotes();
  const [filter, setFilter] = useState<"alla" | QuoteStatus>("alla");
  const [open, setOpen] = useState<string | null>(null);

  const shown = useMemo(() => (quotes ?? []).filter((q) => filter === "alla" || q.status === filter), [quotes, filter]);
  const selected = quotes?.find((q) => q.ref === open) ?? null;
  const kpi = useMemo(() => {
    const qs = quotes ?? [];
    return {
      count: qs.length,
      open: qs.filter((q) => q.status === "skapad" || q.status === "skickad").length,
      won: qs.filter((q) => q.status === "godkand" || q.status === "fakturerad").length,
      value: qs.reduce((s, q) => s + q.total, 0),
    };
  }, [quotes]);

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1>Offerter</h1>
          <p>Alla offerter som skapats på sajten. Godkända offerter går vidare till fakturaunderlaget.</p>
        </div>
        <Link href="/" className="dash-btn">
          + Ny offert
        </Link>
      </div>

      <div className="kpis">
        <div><span>Offerter</span><strong>{kpi.count}</strong></div>
        <div><span>Väntar på svar</span><strong>{kpi.open}</strong></div>
        <div><span>Godkända</span><strong>{kpi.won}</strong></div>
        <div><span>Offertvärde exkl. moms</span><strong>{sek(kpi.value)}</strong></div>
      </div>

      <div className="seg">
        {FILTERS.map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === "alla" ? "Alla" : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {error ? <p className="brandbar-err">{error}</p> : null}

      <div className="table">
        <div className="tr th">
          <span>Offert</span>
          <span>Kund</span>
          <span>Produkter</span>
          <span className="r">Belopp</span>
          <span>Status</span>
        </div>
        {quotes === null ? <p className="table-empty">Hämtar offerter…</p> : null}
        {quotes && shown.length === 0 ? <p className="table-empty">Inga offerter här ännu.</p> : null}
        {shown.map((q) => (
          <button key={q.ref} type="button" className="tr" onClick={() => setOpen(q.ref)}>
            <span>
              <b>{q.ref}</b>
              <small>{fmtDate(q.createdAt)}</small>
            </span>
            <span>
              <b>{q.company}</b>
              <small>{q.host || q.phone}</small>
            </span>
            <span className="thumbs">
              {q.lines.slice(0, 4).map((l) => (
                <Image key={l.productId} src={l.image || familyById(l.productId)?.image || ""} alt="" width={64} height={64} unoptimized={Boolean(l.image)} />
              ))}
              <small>{q.lines.length} st</small>
            </span>
            <span className="r">
              <b>{sek(q.total)}</b>
            </span>
            <span>
              <i className={`badge badge-${q.status}`}>{STATUS_LABEL[q.status]}</i>
            </span>
          </button>
        ))}
      </div>

      {selected ? (
        <div className="drawer-wrap" role="dialog" aria-modal="true" aria-label={selected.ref}>
          <button type="button" className="drawer-veil" aria-label="Stäng" onClick={() => setOpen(null)} />
          <aside className="drawer">
            <div className="drawer-head">
              <h2>{selected.company}</h2>
              <button type="button" className="drawer-x" onClick={() => setOpen(null)} aria-label="Stäng">
                ×
              </button>
            </div>
            <div className="drawer-block">
              <p className="drawer-note">
                {selected.ref} · {fmtDate(selected.createdAt)} · <i className={`badge badge-${selected.status}`}>{STATUS_LABEL[selected.status]}</i>
              </p>
              <p className="drawer-note">{[selected.phone, selected.host].filter(Boolean).join(" · ")}</p>
            </div>
            <ul className="mini-lines">
              {selected.priced.map((l) => {
                const stored = selected.lines.find((x) => x.productId === l.productId);
                return (
                  <li key={l.productId}>
                    <Image src={stored?.image || familyById(l.productId)?.image || ""} alt="" width={96} height={96} unoptimized={Boolean(stored?.image)} />
                    <span>
                      <b>{l.name}</b>
                      <small>
                        {l.qty} st · {colorName(stored?.color ?? BASE_COLOR)} · {sek(l.unitInclPrint)}/st
                      </small>
                    </span>
                    <b>{sek(l.lineTotal)}</b>
                  </li>
                );
              })}
            </ul>
            <div className="drawer-block mini-total">
              <span>Totalt exkl. moms</span>
              <strong>{sek(selected.total)}</strong>
            </div>
            <div className="drawer-block">
              <p className="drawer-label">Status</p>
              <div className="seg">
                {QUOTE_STATUSES.filter((s) => s !== "fakturerad").map((s) => (
                  <button key={s} type="button" aria-pressed={selected.status === s} disabled={selected.status === "fakturerad"} onClick={() => void patch(selected.ref, { status: s })}>
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
              {selected.status === "godkand" || selected.status === "fakturerad" ? (
                <p className="drawer-note">
                  Finns i <Link href="/dashboard/fakturaunderlag">fakturaunderlaget</Link>.
                </p>
              ) : null}
            </div>
            <div className="drawer-foot">
              <a className="drawer-save" href={`/api/dashboard/quotes/${selected.ref}/pdf`} target="_blank" rel="noreferrer">
                Visa offert-PDF
              </a>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
