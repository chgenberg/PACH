"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ProofGallery } from "@/components/ProofGallery";
import { CollectPanel } from "@/components/dashboard/CollectPanel";
import { MarginBadge } from "@/components/dashboard/MarginBadge";
import { OrderPanel } from "@/components/dashboard/OrderPanel";
import { useReorder } from "@/components/dashboard/useReorder";
import { LevelBadge, ScheduleBlock, useSchedules } from "@/components/dashboard/useSchedules";
import { fmtDate, STATUS_LABEL, useQuotes } from "@/components/dashboard/useQuotes";
import { familyById } from "@/lib/catalog";
import { BASE_COLOR, colorName } from "@/lib/colors";
import { designSummary } from "@/lib/marking";
import { invoiceBasis } from "@/lib/invoice";
import { sek } from "@/lib/pricing";
import { isEditable, QUOTE_STATUSES, type QuoteStatus } from "@/lib/quoteTypes";

const FILTERS: ("alla" | QuoteStatus)[] = ["alla", ...QUOTE_STATUSES];

export default function QuotesPage() {
  const { quotes, error, patch, reload } = useQuotes();
  const router = useRouter();
  const reorder = useReorder();
  const schedules = useSchedules(quotes);
  const [filter, setFilter] = useState<"alla" | QuoteStatus>("alla");
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("open");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the link from the overview names the quote to open
    if (ref) setOpen(ref);
  }, []);

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
          <p>Offerter från sajten och från offertbyggaren. Godkända offerter går vidare till fakturaunderlaget.</p>
        </div>
        <div className="kp-head-actions">
          <Link href="/dashboard/kalkyler/ny" className="dash-btn ghost">
            + Ny kalkyl
          </Link>
          <Link href="/dashboard/offerter/bygg" className="dash-btn">
            + Ny offert
          </Link>
        </div>
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
              <small>
                {fmtDate(q.createdAt)}
                {q.origin ? <em className="kd-origin">{q.origin.by === "kund" ? "Önskemål" : "Ombeställning"}</em> : null}
              </small>
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
            <span className="sch-cell">
              <i className={`badge badge-${q.status}`}>{STATUS_LABEL[q.status]}</i>
              {schedules?.[q.ref] && schedules[q.ref].level !== "ok" ? <LevelBadge level={schedules[q.ref].level} title={schedules[q.ref].text} /> : null}
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
              {selected.origin ? (
                <p className="kd-origin-note">
                  {selected.origin.by === "kund" ? `Önskemål från ${selected.origin.name ?? "kunden"} i kundportalen` : "Ny offert"} – samma som {selected.origin.fromRef}.
                  {selected.origin.note ? ` ”${selected.origin.note}”` : ""}
                </p>
              ) : null}
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
                        {stored?.design && familyById(l.productId) ? ` · ${designSummary(familyById(l.productId)!, stored.design)}` : ""}
                      </small>
                      {selected.share?.approvals[l.productId] ? <small className="mini-ok">✓ Godkänd av {selected.share.approvals[l.productId].name}</small> : null}
                    </span>
                    <b>{sek(l.lineTotal)}</b>
                    {stored?.proofs?.length ? (
                      <div className="mini-proofs">
                        <ProofGallery
                          proofs={stored.proofs}
                          name={l.name}
                          pins={(selected.share?.comments ?? [])
                            .filter((c) => c.productId === l.productId && c.pin)
                            .map((c, i) => ({ n: i + 1, pin: c.pin!, text: c.text, by: c.name }))}
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {selected.extras.length ? (
              <ul className="mini-lines kp-mini-extras">
                {selected.extras.map((e) => (
                  <li key={e.id}>
                    <span className="kp-extra-dot" aria-hidden>
                      +
                    </span>
                    <span>
                      <b>{e.label}</b>
                      <small>Extra post</small>
                    </span>
                    <b>{sek(e.amount)}</b>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="drawer-block mini-total">
              <span>Totalt exkl. moms</span>
              <strong>{sek(selected.total)}</strong>
            </div>
            {(() => {
              const b = invoiceBasis(selected);
              return (
                <div className="drawer-block kp-mini-margin">
                  <span>Du tjänar</span>
                  <MarginBadge tb={b.tb} pct={b.tbPct} />
                  <small>Kostnad {sek(b.cost)}{selected.lines.some((l) => !l.cost) ? " · delvis uppskattad (60 %)" : ""}</small>
                </div>
              );
            })()}
            {schedules?.[selected.ref] ? <ScheduleBlock schedule={schedules[selected.ref]} /> : null}
            <div className="drawer-block sd-drawer-actions">
              <Link className="dash-btn" href={`/dashboard/offerter/skicka?ref=${selected.ref}`}>
                {selected.sends?.length ? "Skicka igen eller till fler" : "Skicka offert"}
              </Link>
              {isEditable(selected) ? (
                <Link className="dash-btn ghost kp-edit" href={`/dashboard/offerter/bygg?ref=${selected.ref}`}>
                  Redigera offert – ta bort rader, ändra antal, extra poster
                </Link>
              ) : null}
            </div>
            {selected.sends?.length ? (
              <div className="drawer-block">
                <p className="drawer-label">Utskick · {selected.sends.length} st</p>
                <ul className="sd-sends">
                  {[...selected.sends].reverse().map((s) => (
                    <li key={s.id}>
                      <span>
                        <b>{s.to.name}</b>
                        <small>
                          {s.presentation.name} · {fmtDate(s.at)}
                        </small>
                      </span>
                      <a href={`/o/${s.token}`} target="_blank" rel="noreferrer">
                        Länk
                      </a>
                      <a href={`/api/dashboard/quotes/${selected.ref}/pdf?send=${s.id}`} target="_blank" rel="noreferrer">
                        PDF
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {selected.share ? (
              <div className="drawer-block">
                <p className="drawer-label">
                  Teamgranskning · {Object.keys(selected.share.approvals).length} av {selected.lines.length} godkända
                </p>
                {selected.share.comments.length ? (
                  <ul className="mini-comments">
                    {selected.share.comments.map((c) => (
                      <li key={c.id}>
                        <b>{c.name}</b>
                        {c.productId ? ` om ${familyById(c.productId)?.name ?? c.productId}` : ""}: {c.text}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="drawer-note">Inga kommentarer än.</p>
                )}
                <p className="drawer-note">
                  <a href={`/o/${selected.share.token}`} target="_blank" rel="noreferrer">
                    Öppna granskningslänken
                  </a>
                </p>
              </div>
            ) : null}
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
            <CollectPanel key={`c${selected.ref}`} quote={selected} />
            <OrderPanel key={selected.ref} quote={selected} patch={patch} onChanged={reload} />
            <div className="drawer-foot">
              <button
                type="button"
                className="drawer-remove"
                disabled={reorder.busy === selected.ref}
                onClick={() => void reorder.run(selected.ref).then((ref) => ref && router.push(`/dashboard/offerter/bygg?ref=${ref}`))}
                title="Samma produkter, design och korrektur i ett nytt offertutkast"
              >
                {reorder.busy === selected.ref ? "Skapar…" : "Ny offert från denna"}
              </button>
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
