"use client";

import { useCallback, useEffect, useState } from "react";
import type { QuotePatch } from "@/components/dashboard/useQuotes";
import { readLogoFile } from "@/components/readLogoFile";
import { sek } from "@/lib/pricing";
import { PO_LABEL, type PoView, rollup } from "@/lib/purchasingTypes";
import { ORDER_STAGES, type QuoteView, STAGE_LABEL } from "@/lib/quoteTypes";

const when = (iso: string) => new Date(iso).toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const day = (isoDate: string) => new Date(`${isoDate}T12:00:00`).toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" });

/** One purchase order per supplier: checks against the terms, send, the supplier's answers and the log. */
function PurchaseOrders({ quote, onChanged }: { quote: QuoteView; onChanged: () => void }) {
  const [pos, setPos] = useState<PoView[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [mail, setMail] = useState<string | null>(null);
  const [log, setLog] = useState<string | null>(null);
  const [tracking, setTracking] = useState<Record<string, string>>({});

  const load = useCallback(
    () =>
      fetch(`/api/dashboard/quotes/${quote.ref}/purchase`, { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => {
          if (j.orders) setPos(j.orders);
          else setError(j.error || "Kunde inte läsa inköpsordrarna.");
        })
        .catch(() => setError("Kunde inte läsa inköpsordrarna.")),
    [quote.ref],
  );

  // New Wave Group updates the order in its portal – poll so their steps show up here directly.
  useEffect(() => {
    void load();
    const t = setInterval(() => {
      if (!document.hidden) void load();
    }, 8000);
    return () => clearInterval(t);
  }, [load]);

  const act = async (key: string, body: Record<string, unknown>) => {
    setBusy(key);
    setError("");
    try {
      const res = await fetch(`/api/dashboard/quotes/${quote.ref}/purchase`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Något gick fel.");
      setPos(j.orders);
      setMail(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Något gick fel.");
    } finally {
      setBusy("");
    }
  };

  const resolve = async (supplierNumber: string, productId: string) => {
    await fetch(`/api/supplier/orders/${supplierNumber}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "resolve", productId }) });
    void load();
  };

  const drafts = (pos ?? []).filter((p) => p.status === "draft");

  return (
    <div className="drawer-block po">
      <p className="drawer-label">Inköpsordrar</p>
      {pos === null && !error ? <p className="drawer-note">Tar fram inköpsordrarna…</p> : null}
      {pos ? <p className="po-rollup">{rollup(pos)}</p> : null}
      {drafts.length > 1 ? (
        <button type="button" className="drawer-save po-all" disabled={Boolean(busy)} onClick={() => void act("all", { action: "sendAll" })}>
          {busy === "all" ? "Skickar…" : `Skicka alla ${drafts.length} utkast`}
        </button>
      ) : null}
      {error ? <p className="brandbar-err">{error}</p> : null}

      {pos?.map((p) => (
        <div key={p.number} className={`po-card po-s-${p.status}`} id={`po-${p.number}`}>
          <div className="po-top">
            <span className="po-sup">
              <i style={{ background: p.mark }} aria-hidden />
              <b>{p.supplier}</b>
              <em>{p.channel === "portal" ? "Portal" : "E-post"}</em>
            </span>
            <span className="po-pill">{PO_LABEL[p.status]}</span>
          </div>
          <small className="po-meta">
            {p.number} · {p.units} st · inköp {sek(p.value)} · {p.status === "delivered" ? "levererad" : `beräknat utskick ${day(p.shipBy)}`}
            {p.proposedDate ? " (nytt datum från leverantören)" : ""}
            {p.tracking ? ` · spårning ${p.tracking}` : ""}
          </small>
          <ul className="po-lines">
            {p.lines.map((l) => (
              <li key={l.productId}>
                {l.qty} st {l.name}, {l.color.toLowerCase()} · {l.method}
              </li>
            ))}
          </ul>
          <ul className="po-checks">
            {p.checks.map((c, i) => (
              <li key={i} className={`is-${c.tone}`}>
                {c.text}
              </li>
            ))}
            {p.issues.map((i) => (
              <li key={i.productId} className="is-warn">
                <b>
                  {i.name}: {i.label}.
                </b>{" "}
                {i.note}
                {i.replacement ? ` Ersättare: ${i.replacement}.` : ""}{" "}
                <button type="button" className="cz-link" onClick={() => p.supplierNumber && void resolve(p.supplierNumber, i.productId)}>
                  Markera löst
                </button>
              </li>
            ))}
          </ul>

          {mail === p.number && p.email ? (
            <div className="po-mail">
              <small>Till: {p.email.to}</small>
              <small>Ämne: {p.email.subject}</small>
              <p>{p.email.body}</p>
              <div className="po-files">
                {p.email.attachments.map((a) => (
                  <span key={a}>📎 {a}</span>
                ))}
              </div>
              {p.status === "draft" ? (
                <div className="po-actions">
                  <button type="button" className="drawer-remove" onClick={() => setMail(null)}>
                    Avbryt
                  </button>
                  <button type="button" className="drawer-save" disabled={Boolean(busy)} onClick={() => void act(p.number, { action: "send", number: p.number })}>
                    {busy === p.number ? "Skickar…" : "Skicka mejlet"}
                  </button>
                </div>
              ) : null}
              <small className="po-sim">E-posten är simulerad i demon.</small>
            </div>
          ) : null}

          <div className="po-actions">
            {p.status === "draft" && p.channel === "email" && mail !== p.number ? (
              <button type="button" className="drawer-save" onClick={() => setMail(p.number)}>
                Förhandsgranska och skicka
              </button>
            ) : null}
            {p.status === "draft" && p.channel === "portal" ? (
              <button type="button" className="drawer-save" disabled={Boolean(busy)} onClick={() => void act(p.number, { action: "send", number: p.number })}>
                {busy === p.number ? "Skickar…" : `Skicka till ${p.short}-portalen`}
              </button>
            ) : null}
            {p.next ? (
              <>
                {p.next.status === "shipped" ? (
                  <input
                    className="po-track"
                    value={tracking[p.number] ?? ""}
                    onChange={(e) => setTracking({ ...tracking, [p.number]: e.target.value })}
                    placeholder="Spårningsnummer"
                    aria-label="Spårningsnummer"
                  />
                ) : null}
                <button type="button" className="drawer-save" disabled={Boolean(busy)} onClick={() => void act(p.number, { action: "advance", number: p.number, tracking: tracking[p.number] })}>
                  {busy === p.number ? "Sparar…" : p.next.label}
                </button>
              </>
            ) : null}
            {p.portalHref ? (
              <a className="cz-link" href={p.portalHref}>
                Öppna i leverantörsportalen
              </a>
            ) : null}
            {p.status !== "draft" && p.email && mail !== p.number ? (
              <button type="button" className="cz-link" onClick={() => setMail(p.number)}>
                Visa skickat mejl
              </button>
            ) : null}
            {p.history.length ? (
              <button type="button" className="cz-link" onClick={() => setLog(log === p.number ? null : p.number)}>
                {log === p.number ? "Dölj händelser" : `Händelser (${p.history.length})`}
              </button>
            ) : null}
          </div>
          {p.channel === "portal" && p.status !== "draft" && p.status !== "delivered" ? <small className="po-meta">{p.supplier} uppdaterar ordern i sin portal – stegen syns här direkt.</small> : null}

          {log === p.number ? (
            <ol className="po-log">
              {[...p.history].reverse().map((h, i) => (
                <li key={`${h.at}-${i}`}>
                  <time>{when(h.at)}</time>
                  <span className={`po-by is-${h.by === "pach" ? "pach" : "sup"}`}>{h.by === "pach" ? "PACH" : p.short}</span>
                  {h.text}
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ))}
      {pos?.length ? (
        <a className="drawer-remove po-dl" href={`/api/dashboard/quotes/${quote.ref}/po`}>
          Ladda ner alla ordrar och tryckfiler (ZIP)
        </a>
      ) : null}
    </div>
  );
}

export function OrderPanel({ quote, patch, onChanged }: { quote: QuoteView; patch: (ref: string, body: QuotePatch) => Promise<boolean>; onChanged: () => void }) {
  const [note, setNote] = useState("");
  const [tracking, setTracking] = useState(quote.order?.tracking ?? "");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const approved = quote.status === "godkand" || quote.status === "fakturerad";

  if (!approved) {
    return (
      <div className="drawer-block">
        <p className="drawer-label">Inköpsordrar</p>
        <p className="drawer-note">Skapas när offerten är godkänd – en per leverantör, kontrollerad mot leverantörens villkor.</p>
      </div>
    );
  }

  const current = quote.order ? ORDER_STAGES.indexOf(quote.order.stage) : -1;
  const next = ORDER_STAGES[current + 1];

  const advance = async () => {
    if (!next) return;
    setBusy(true);
    const ok = await patch(quote.ref, { order: { stage: next, note: note || undefined, photo: photo ?? undefined, tracking: tracking || undefined } });
    setBusy(false);
    if (ok) {
      setNote("");
      setPhoto(null);
    }
  };

  return (
    <>
      <PurchaseOrders quote={quote} onChanged={onChanged} />

      <div className="drawer-block">
        <p className="drawer-label">Leverans till kunden</p>
        <ol className="track">
          {ORDER_STAGES.map((s, i) => {
            const ev = [...(quote.order?.history ?? [])].reverse().find((h) => h.stage === s);
            return (
              <li key={s} className={i <= current ? "done" : i === current + 1 ? "next" : ""}>
                <span className="track-dot" aria-hidden />
                <div>
                  <b>{STAGE_LABEL[s]}</b>
                  {ev ? <small>{when(ev.at)}{ev.note ? ` · ${ev.note}` : ""}</small> : null}
                  {/* eslint-disable-next-line @next/next/no-img-element -- uploaded print photo */}
                  {ev?.photo ? <img src={ev.photo} alt={`Foto: ${STAGE_LABEL[s]}`} className="track-photo" /> : null}
                </div>
              </li>
            );
          })}
        </ol>
        {next ? (
          <div className="track-form">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Kommentar till kunden (valfritt)" />
            {next === "skickad" ? <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Spårningsnummer" /> : null}
            <label className="track-upload">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void readLogoFile(f).then(setPhoto).catch(() => setPhoto(null));
                  e.target.value = "";
                }}
              />
              {photo ? "Foto valt ✓" : "+ Foto från tryckeriet"}
            </label>
            <button type="button" className="drawer-save" disabled={busy} onClick={() => void advance()}>
              {busy ? "Sparar…" : `Markera: ${STAGE_LABEL[next]}`}
            </button>
          </div>
        ) : (
          <p className="drawer-note">Levererad{quote.order?.tracking ? ` · spårning ${quote.order.tracking}` : ""}.</p>
        )}
        <p className="drawer-note">Steget flyttas automatiskt när alla inköpsordrar är i produktion, skickade eller levererade.</p>
      </div>
    </>
  );
}
