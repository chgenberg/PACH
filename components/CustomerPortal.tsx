"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import type { PortalView } from "@/lib/customers";
import { initials } from "@/lib/offerTemplates";
import { sek } from "@/lib/pricing";

const NAME_KEY = "pach.reviewer";
const EMAIL_KEY = "pach.reviewer.email";

const day = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });
const month = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { month: "long", year: "numeric" });

type Tab = "aktuellt" | "ordrar" | "onskemal";
type Row = { productId: string; name: string; image: string | null; last: number; qty: number; on: boolean };

/** The customer's mini dashboard: current offers, earlier orders and "Beställ igen". */
export function CustomerPortal({ token, initial }: { token: string; initial: PortalView }) {
  const [portal, setPortal] = useState(initial);
  const [tab, setTab] = useState<Tab>(initial.open.length ? "aktuellt" : "ordrar");
  const [reorder, setReorder] = useState<{ ref: string; createdAt: string; rows: Row[] } | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [thanks, setThanks] = useState("");
  const [logoOk, setLogoOk] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from localStorage after hydration
    setName(localStorage.getItem(NAME_KEY) ?? "");
    setEmail(localStorage.getItem(EMAIL_KEY) ?? "");
  }, []);

  const open = (o: PortalView["orders"][number]) => {
    setError("");
    setNote("");
    setReorder({ ref: o.ref, createdAt: o.createdAt, rows: o.lines.map((l) => ({ productId: l.productId, name: l.name, image: l.image, last: l.qty, qty: l.qty, on: true })) });
  };
  const setRow = (id: string, v: Partial<Row>) => setReorder((r) => (r ? { ...r, rows: r.rows.map((x) => (x.productId === id ? { ...x, ...v } : x)) } : r));

  const submit = async () => {
    if (!reorder) return;
    setBusy(true);
    setError("");
    try {
      const lines = reorder.rows.filter((r) => r.on && r.qty > 0).map((r) => ({ productId: r.productId, qty: r.qty }));
      const res = await fetch(`/api/kund/${token}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromRef: reorder.ref, lines, name, email, note }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Något gick fel.");
      localStorage.setItem(NAME_KEY, name.trim());
      if (email.trim()) localStorage.setItem(EMAIL_KEY, email.trim());
      setPortal(j.portal);
      const who = portal.seller?.name.split(" ")[0] ?? "Vi";
      const what = reorder.rows
        .filter((r) => r.on && r.qty > 0)
        .map((r) => `${r.qty} ${r.name}`)
        .join(", ");
      setThanks(`Tack! ${who} tar fram en offert på ${what} och hör av sig.`);
      setReorder(null);
      setTab("onskemal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Något gick fel.");
    } finally {
      setBusy(false);
    }
  };

  const thumbs = (lines: PortalView["orders"][number]["lines"]) => (
    <div className="kd-thumbs">
      {lines.slice(0, 4).map((l) => (l.image ? <Image key={l.productId} src={l.image} alt="" width={96} height={96} unoptimized={l.image.startsWith("/api/")} /> : null))}
    </div>
  );

  return (
    <div className="shop">
      <SiteHeader />
      <div className="cat kd">
        <div className="kd-head">
          <div className="kd-who">
            {portal.host && logoOk ? (
              <span className="kd-logo">
                {/* eslint-disable-next-line @next/next/no-img-element -- same-origin logo proxy */}
                <img src={`/api/brand-logo?host=${portal.host}`} alt="" onError={() => setLogoOk(false)} />
              </span>
            ) : (
              <span className="kd-logo is-text">{initials(portal.name)}</span>
            )}
            <div>
              <p className="kicker">Kundportal</p>
              <h1>{portal.name}</h1>
              <p className="lede">Era offerter, ordrar och önskemål på ett ställe. Spara sidan – eller logga in med e-post på pach.se/kund.</p>
            </div>
          </div>
          {portal.seller ? (
            <aside className="share-contact">
              <span className="share-avatar">
                {/* eslint-disable-next-line @next/next/no-img-element -- uploaded profile photo (data URL) */}
                {portal.seller.photo ? <img src={portal.seller.photo} alt="" /> : initials(portal.seller.name)}
              </span>
              <div>
                <small>Er kontaktperson</small>
                <b>{portal.seller.name}</b>
                {portal.seller.title ? <span>{portal.seller.title}</span> : null}
                {portal.seller.email ? <a href={`mailto:${portal.seller.email}`}>{portal.seller.email}</a> : null}
                {portal.seller.phone ? <a href={`tel:${portal.seller.phone.replace(/[^\d+]/g, "")}`}>{portal.seller.phone}</a> : null}
              </div>
            </aside>
          ) : null}
        </div>

        {thanks ? (
          <p className="kd-thanks" role="status">
            {thanks}
          </p>
        ) : null}

        <div className="seg kd-tabs">
          {(
            [
              ["aktuellt", "Aktuellt", portal.open.length],
              ["ordrar", "Tidigare ordrar", portal.orders.length],
              ["onskemal", "Önskemål", portal.requests.length],
            ] as const
          ).map(([k, label, n]) => (
            <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)}>
              {label}
              {n ? <i>{n}</i> : null}
            </button>
          ))}
        </div>

        {tab === "aktuellt" ? (
          portal.open.length ? (
            <ul className="kd-list">
              {portal.open.map((o) => (
                <li key={o.ref}>
                  {thumbs(o.lines)}
                  <div className="kd-main">
                    <b>Offert {o.ref}</b>
                    <span>
                      {day(o.createdAt)} · {o.lines.map((l) => `${l.qty} ${l.name}`).join(", ")}
                    </span>
                    <small>
                      {o.approved} av {o.count} rader godkända{o.eventDate ? ` · behövs ${day(o.eventDate)}` : ""}
                    </small>
                  </div>
                  <div className="kd-side">
                    {o.total !== null ? <b>{sek(o.total)}</b> : null}
                    {o.link ? (
                      <a className="share-approve-btn" href={o.link}>
                        Granska och godkänn
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="kd-empty">Inga offerter väntar på er just nu.</p>
          )
        ) : null}

        {tab === "ordrar" ? (
          portal.orders.length ? (
            <ul className="kd-list">
              {portal.orders.map((o) => (
                <li key={o.ref}>
                  {thumbs(o.lines)}
                  <div className="kd-main">
                    <b className="kd-month">{month(o.createdAt)}</b>
                    <span>{o.lines.map((l) => `${l.qty} st ${l.name}`).join(" · ")}</span>
                    <small>
                      Order {o.ref} · {o.delivered && o.deliveredAt ? `levererad ${day(o.deliveredAt)}` : o.stage.toLowerCase()}
                    </small>
                  </div>
                  <div className="kd-side">
                    <b>{sek(o.total)}</b>
                    <div>
                      {o.link ? (
                        <a className="share-copy" href={o.link}>
                          Visa
                        </a>
                      ) : null}
                      <button type="button" className="share-approve-btn" onClick={() => open(o)}>
                        Beställ igen
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="kd-empty">Här hamnar era ordrar när ni godkänt en offert.</p>
          )
        ) : null}

        {tab === "onskemal" ? (
          portal.requests.length ? (
            <ul className="kd-list kd-requests">
              {portal.requests.map((r) => (
                <li key={r.id}>
                  <div className="kd-main">
                    <b>{r.lines.map((l) => `${l.qty} st ${l.name}`).join(" · ")}</b>
                    <span>
                      {day(r.at)} · {r.by} · samma som order {r.fromRef}
                    </span>
                    {r.note ? <small>”{r.note}”</small> : null}
                  </div>
                  <div className="kd-side">
                    <span className={`kd-status${r.link ? " is-done" : ""}`}>{r.status}</span>
                    {r.link ? (
                      <a className="share-copy" href={r.link}>
                        Öppna offerten
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="kd-empty">Inga önskemål än. Tryck Beställ igen på en tidigare order.</p>
          )
        ) : null}
      </div>

      {reorder ? (
        <div className="drawer-wrap" role="dialog" aria-modal="true" aria-label="Beställ igen">
          <button type="button" className="drawer-veil" aria-label="Stäng" onClick={() => setReorder(null)} />
          <aside className="drawer kd-drawer">
            <div className="drawer-head">
              <h2>Beställ igen</h2>
              <button type="button" className="drawer-x" onClick={() => setReorder(null)} aria-label="Stäng">
                ×
              </button>
            </div>
            <p className="drawer-note">
              Samma produkter, färger och tryck som i {month(reorder.createdAt)}. Välj antal så tar {portal.seller?.name.split(" ")[0] ?? "vi"} fram en ny offert – inget beställs förrän ni godkänt den.
            </p>
            <ul className="kd-rows">
              {reorder.rows.map((r) => (
                <li key={r.productId} className={r.on ? "" : "is-off"}>
                  <label className="kd-check">
                    <input type="checkbox" checked={r.on} onChange={(e) => setRow(r.productId, { on: e.target.checked })} />
                    {r.image ? <Image src={r.image} alt="" width={80} height={80} unoptimized={r.image.startsWith("/api/")} /> : null}
                    <span>
                      <b>{r.name}</b>
                      <small>Förra gången {r.last} st</small>
                    </span>
                  </label>
                  <div className="kd-qty">
                    <input type="number" min={1} max={100000} value={r.qty} disabled={!r.on} aria-label={`Antal ${r.name}`} onChange={(e) => setRow(r.productId, { qty: Math.max(0, Math.round(Number(e.target.value) || 0)) })} />
                    <div>
                      {[r.last, Math.round(r.last * 1.5), r.last * 2].map((n, i) => (
                        <button key={i} type="button" disabled={!r.on} aria-pressed={r.qty === n} onClick={() => setRow(r.productId, { qty: n })}>
                          {i === 0 ? "Samma" : `${n} st`}
                        </button>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="fields kd-fields">
              <label>
                Ditt namn
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Förnamn Efternamn" autoComplete="name" />
              </label>
              <label>
                E-post (för svar)
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="namn@foretaget.se" autoComplete="email" />
              </label>
              <label className="wide">
                Önskemål
                <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="T.ex. behövs till julbordet 12 december, gärna samma färg som sist" />
              </label>
            </div>
            {error ? <p className="brandbar-err">{error}</p> : null}
            <div className="drawer-foot">
              <button type="button" className="drawer-remove" onClick={() => setReorder(null)}>
                Avbryt
              </button>
              <button type="button" className="drawer-save" disabled={busy || !reorder.rows.some((r) => r.on && r.qty > 0)} onClick={() => void submit()}>
                {busy ? "Skickar…" : "Skicka önskemål"}
              </button>
            </div>
          </aside>
        </div>
      ) : null}
      <SiteFooter />
    </div>
  );
}
