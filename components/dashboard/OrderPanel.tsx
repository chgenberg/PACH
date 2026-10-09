"use client";

import { useEffect, useState } from "react";
import type { QuotePatch } from "@/components/dashboard/useQuotes";
import { readLogoFile } from "@/components/readLogoFile";
import type { PurchaseOrder } from "@/lib/purchaseOrders";
import { ORDER_STAGES, type QuoteView, STAGE_LABEL } from "@/lib/quoteTypes";

const when = (iso: string) => new Date(iso).toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function OrderPanel({ quote, patch }: { quote: QuoteView; patch: (ref: string, body: QuotePatch) => Promise<boolean> }) {
  const [orders, setOrders] = useState<PurchaseOrder[] | null>(null);
  const [fileCount, setFileCount] = useState(0);
  const [poError, setPoError] = useState("");
  const [note, setNote] = useState("");
  const [tracking, setTracking] = useState(quote.order?.tracking ?? "");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const approved = quote.status === "godkand" || quote.status === "fakturerad";

  useEffect(() => {
    if (!approved) return;
    let live = true;
    fetch(`/api/dashboard/quotes/${quote.ref}/po?format=json`, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!live) return;
        if (!r.ok) throw new Error(j.error);
        setOrders(j.orders);
        setFileCount(j.files.length);
      })
      .catch((e) => live && setPoError(e instanceof Error ? e.message : "Kunde inte läsa inköpsordrarna."));
    return () => {
      live = false;
    };
  }, [approved, quote.ref, quote.collect?.entries.length]);

  if (!approved) {
    return (
      <div className="drawer-block">
        <p className="drawer-label">Inköpsordrar</p>
        <p className="drawer-note">Skapas när offerten är godkänd – av kunden via granskningslänken eller här.</p>
      </div>
    );
  }

  const current = quote.order ? ORDER_STAGES.indexOf(quote.order.stage) : -1;
  const next = ORDER_STAGES[current + 1];
  const unset = (orders ?? []).flatMap((o) => o.lines.flatMap((l) => l.rows)).filter((r) => r.size === "Ej angiven").reduce((s, r) => s + r.qty, 0);

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
      <div className="drawer-block po">
        <p className="drawer-label">Inköpsordrar</p>
        {poError ? <p className="brandbar-err">{poError}</p> : null}
        {orders === null && !poError ? <p className="drawer-note">Tar fram ordrar och tryckfiler…</p> : null}
        {orders?.map((o) => (
          <div key={o.number} className="po-card">
            <div>
              <b>{o.number}</b>
              <small>
                {o.supplier} · {o.units} st · {o.lines.length} {o.lines.length === 1 ? "rad" : "rader"}
              </small>
            </div>
            <ul>
              {o.lines.map((l) => (
                <li key={l.no}>
                  {l.name} – {l.rows.map((r) => `${r.size} ${r.qty}`).join(", ")}
                  {l.positions.length ? ` · ${l.positions.length} tryckfil${l.positions.length === 1 ? "" : "er"}` : ""}
                  {l.names ? ` · ${l.names.count} namn` : ""}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {orders ? <p className="drawer-note">{orders.length} {orders.length === 1 ? "inköpsorder" : "inköpsordrar"} · {fileCount} filer i ZIP: PDF per leverantör, tryckfiler i 300 dpi, namnlistor och mockups.</p> : null}
        {unset ? <p className="drawer-note po-warn">{unset} plagg saknar storlek – skicka storleksinsamlingen eller bekräfta med kunden.</p> : null}
        {orders ? (
          <a className="drawer-save po-dl" href={`/api/dashboard/quotes/${quote.ref}/po`}>
            Ladda ner ordrar och tryckfiler
          </a>
        ) : null}
      </div>

      <div className="drawer-block">
        <p className="drawer-label">Leverans</p>
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
      </div>
    </>
  );
}
