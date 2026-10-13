"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { fmtDay } from "@/lib/delivery";
import { initials } from "@/lib/offerTemplates";
import { sek } from "@/lib/pricing";
import { Countdown } from "@/components/Countdown";
import { ProofGallery } from "@/components/ProofGallery";
import { ORDER_STAGES, type ProofPin, STAGE_LABEL } from "@/lib/quoteTypes";
import type { PublicLine, PublicQuote } from "@/lib/share";

const NAME_KEY = "pach.reviewer";

const when = (iso: string) =>
  new Date(iso).toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const unopt = (src: string) => /^(data:|\/api\/)/.test(src);

/** The customer's offer link – and, with `preview`, the same view on the seller's send page. */
export function ShareView({ token, initial, preview = false }: { token?: string; initial: PublicQuote; preview?: boolean }) {
  const [live, setQuote] = useState(initial);
  const quote = preview ? initial : live;
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [about, setAbout] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState<{ productId: string; pin: ProofPin } | null>(null);
  const [pinText, setPinText] = useState("");

  useEffect(() => {
    if (preview || !token) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from localStorage after hydration
    setName(localStorage.getItem(NAME_KEY) ?? "");
    const t = setInterval(() => {
      fetch(`/api/share/${token}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => j?.quote && setQuote(j.quote))
        .catch(() => {});
    }, 15_000);
    return () => clearInterval(t);
  }, [token, preview]);

  const act = async (key: string, body: Record<string, unknown>) => {
    if (preview || !token) {
      setError("Förhandsvisning – kunden godkänner och kommenterar här.");
      return false;
    }
    if (!name.trim()) {
      setError("Skriv ditt namn först, så ser teamet vem som tyckt vad.");
      document.getElementById("share-name")?.focus();
      return false;
    }
    localStorage.setItem(NAME_KEY, name.trim());
    setBusy(key);
    setError("");
    try {
      const res = await fetch(`/api/share/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, name: name.trim() }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Något gick fel.");
      setQuote(j.quote);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Något gick fel.");
      return false;
    } finally {
      setBusy("");
    }
  };

  const { layout, show, intro } = quote.presentation;
  const approved = quote.lines.filter((l) => l.approval).length;
  const inProduction = Boolean(quote.order) || quote.status === "godkand" || quote.status === "fakturerad";
  const allApproved = approved === quote.lines.length || inProduction;
  const late = quote.eventDate ? quote.lines.filter((l) => l.delivery && l.delivery > quote.eventDate!).length : 0;
  const lineName = (id?: string) => quote.lines.find((l) => l.productId === id)?.name;
  const notesFor = (l: PublicLine) => quote.comments.filter((c) => c.productId === l.productId);
  const firstName = quote.seller?.name.split(" ")[0];

  const approveBox = (l: PublicLine) => (
    <div className="share-approve">
      {inProduction && !l.approval ? (
        <span className="share-ok">✓ Godkänd</span>
      ) : l.approval ? (
        <>
          <span className="share-ok">✓ Godkänd</span>
          <small>
            {l.approval.name}, {when(l.approval.at)}
          </small>
          {!inProduction ? (
            <button type="button" className="offer-remove" disabled={Boolean(busy)} onClick={() => void act(`u${l.productId}`, { action: "unapprove", productId: l.productId })}>
              Ångra
            </button>
          ) : null}
        </>
      ) : (
        <button type="button" className="share-approve-btn" disabled={Boolean(busy)} onClick={() => void act(`a${l.productId}`, { action: "approve", productId: l.productId })}>
          {busy === `a${l.productId}` ? "…" : "Godkänn"}
        </button>
      )}
    </div>
  );

  const notesBlock = (l: PublicLine) => {
    const notes = notesFor(l);
    return (
      <>
        {notes.length ? (
          <ul className="share-notes">
            {notes.map((c) => (
              <li key={c.id}>
                <b>{c.name}:</b> {c.text}
              </li>
            ))}
          </ul>
        ) : null}
        <button
          type="button"
          className="share-reply"
          onClick={() => {
            setAbout(l.productId);
            document.querySelector<HTMLTextAreaElement>(".share-thread textarea")?.focus();
          }}
        >
          Kommentera
        </button>
      </>
    );
  };

  const proofsBlock = (l: PublicLine) =>
    l.proofs.length ? (
      <div className="share-proofs">
        <ProofGallery
          proofs={l.proofs}
          name={l.name}
          pins={notesFor(l)
            .flatMap((c) => (c.pin ? [c] : []))
            .map((c, i) => ({ n: i + 1, pin: c.pin!, text: c.text, by: c.name }))}
          pending={pending?.productId === l.productId ? pending.pin : null}
          onPin={
            inProduction || preview
              ? undefined
              : (pin) => {
                  setPending({ productId: l.productId, pin });
                  requestAnimationFrame(() => document.getElementById(`pin-${l.productId}`)?.focus());
                }
          }
        />
        {pending?.productId === l.productId ? (
          <form
            className="pin-form"
            onSubmit={(e) => {
              e.preventDefault();
              void act("pin", { action: "comment", text: pinText, productId: l.productId, pin: pending.pin }).then((ok) => {
                if (ok) {
                  setPending(null);
                  setPinText("");
                }
              });
            }}
          >
            <textarea id={`pin-${l.productId}`} value={pinText} onChange={(e) => setPinText(e.target.value)} placeholder="Vad vill ni ändra här? T.ex. lite mindre logga" rows={2} />
            <div>
              <button type="button" className="offer-remove" onClick={() => setPending(null)}>
                Avbryt
              </button>
              <button type="submit" className="share-approve-btn" disabled={busy === "pin" || !pinText.trim()}>
                {busy === "pin" ? "Skickar…" : "Kommentera punkten"}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    ) : null;

  const priceLine = (l: PublicLine) =>
    [l.price && show.unitPrices ? `${sek(l.price.unit)}/st inkl. tryck · startkostnad ${sek(l.price.setup)}` : "", l.delivery ? `leverans ca ${fmtDay(l.delivery)}` : ""].filter(Boolean).join(" · ");

  const rows = (
    <ul className={`offer-list${layout === "kompakt" ? " share-compact" : ""}`}>
      {quote.lines.map((l) => {
        const meta = priceLine(l);
        return (
          <li key={l.productId} className={`offer-row share-row${l.approval ? " is-approved" : ""}`}>
            <div className="offer-thumb">{l.image ? <Image src={l.image} alt={l.name} width={160} height={160} unoptimized={unopt(l.image)} /> : null}</div>
            <div className="offer-main">
              <strong>{l.name}</strong>
              <span>
                {l.qty} st · {l.spec}
              </span>
              {layout === "detaljerad" && show.printSpec ? (
                l.printRows.length ? (
                  <ul className="share-spec">
                    {l.printRows.map((r) => (
                      <li key={r.label}>
                        <b>{r.label}</b> {r.zone} · {r.method} · {r.colors} · {r.size}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="share-proof">Standardplacering – vi ritar korrektur om ni inte anpassat i 3D.</span>
                )
              ) : null}
              {meta ? <small>{meta.charAt(0).toUpperCase() + meta.slice(1)}</small> : null}
              {notesBlock(l)}
            </div>
            {approveBox(l)}
            <div className="offer-sum">{l.price ? sek(l.price.lineTotal) : ""}</div>
            {proofsBlock(l)}
          </li>
        );
      })}
    </ul>
  );

  const cards = (
    <ul className="share-cards">
      {quote.lines.map((l) => {
        const hero = l.proofs[0]?.image ?? l.image;
        return (
          <li key={l.productId} className={l.approval ? "is-approved" : ""}>
            <div className="share-card-img">{hero ? <Image src={hero} alt={l.name} width={640} height={640} unoptimized={unopt(hero)} /> : null}</div>
            <div className="share-card-body">
              <div>
                <strong>{l.name}</strong>
                <span>
                  {l.qty} st · {l.spec}
                </span>
                {show.printSpec && l.design ? <span>{l.design}</span> : null}
                {l.delivery ? <span>Leverans ca {fmtDay(l.delivery)}</span> : null}
                {l.price ? (
                  <b className="share-card-price">
                    {sek(l.price.lineTotal)}
                    {show.unitPrices ? <small> · {sek(l.price.unit)}/st</small> : null}
                  </b>
                ) : null}
                {notesBlock(l)}
              </div>
              {approveBox(l)}
            </div>
            {l.proofs.length > 1 ? proofsBlock(l) : null}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className={preview ? "share-preview" : "shop"}>
      {preview ? null : <SiteHeader />}
      <div className={`cat offer share share-${layout}`}>
        {layout === "bildfokus" && show.cover ? (
          <div className={`share-cover${quote.cover ? "" : " is-collage"}`}>
            {quote.cover ? (
              // eslint-disable-next-line @next/next/no-img-element -- the customer's branded scene from the image cache
              <img src={quote.cover} alt={`Miljöbild för ${quote.brand ?? quote.company}`} />
            ) : (
              quote.lines.slice(0, 3).map((l) => (l.image ? <Image key={l.productId} src={l.image} alt="" width={480} height={480} unoptimized={unopt(l.image)} /> : null))
            )}
          </div>
        ) : null}

        <div className="share-head">
          <div>
            <p className="kicker">
              Offert {quote.ref} · {inProduction ? "godkänd" : "för granskning"}
            </p>
            <h1>{quote.brand ? `Merch för ${quote.brand}` : `Offert till ${quote.company}`}</h1>
            <p className="lede">{inProduction ? "Tack! Offerten är godkänd. Här följer ni ordern hela vägen till leverans." : intro || "Titta igenom offerten och godkänn rad för rad."}</p>
            {preview ? null : (
              <a className="share-portal" href={quote.portal}>
                Alla era offerter och tidigare ordrar →
              </a>
            )}
          </div>
          {quote.seller ? (
            <aside className="share-contact">
              <span className="share-avatar">
                {/* eslint-disable-next-line @next/next/no-img-element -- uploaded profile photo (data URL) */}
                {quote.seller.photo ? <img src={quote.seller.photo} alt="" /> : initials(quote.seller.name)}
              </span>
              <div>
                <small>Din kontaktperson</small>
                <b>{quote.seller.name}</b>
                {quote.seller.title ? <span>{quote.seller.title}</span> : null}
                {quote.seller.email ? <a href={`mailto:${quote.seller.email}`}>{quote.seller.email}</a> : null}
                {quote.seller.phone ? <a href={`tel:${quote.seller.phone.replace(/[^\d+]/g, "")}`}>{quote.seller.phone}</a> : null}
              </div>
            </aside>
          ) : null}
        </div>

        {quote.order ? (
          <section className="share-track">
            <h2>Leverans</h2>
            <ol className="track track-row">
              {ORDER_STAGES.map((st, i) => {
                const cur = ORDER_STAGES.indexOf(quote.order!.stage);
                const ev = [...quote.order!.history].reverse().find((h) => h.stage === st);
                return (
                  <li key={st} className={i <= cur ? "done" : i === cur + 1 ? "next" : ""}>
                    <span className="track-dot" aria-hidden />
                    <div>
                      <b>{STAGE_LABEL[st]}</b>
                      {ev ? <small>{when(ev.at)}</small> : null}
                    </div>
                  </li>
                );
              })}
            </ol>
            {quote.order.tracking ? <p className="drawer-note">Spårningsnummer: {quote.order.tracking}</p> : null}
            {quote.order.history.some((h) => h.photo || h.note) ? (
              <div className="share-photos">
                {quote.order.history
                  .filter((h) => h.photo || h.note)
                  .map((h, i) => (
                    <figure key={`${h.at}-${i}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- photo from the print shop */}
                      {h.photo ? <img src={h.photo} alt={STAGE_LABEL[h.stage]} /> : null}
                      <figcaption>
                        <b>{STAGE_LABEL[h.stage]}</b> {h.note ?? ""}
                      </figcaption>
                    </figure>
                  ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {quote.eventDate && !inProduction && !preview ? <Countdown eventDate={quote.eventDate} slowestDays={Math.max(0, ...quote.lines.map((l) => l.deliveryDays))} remind={false} /> : null}

        <div className={`share-status${allApproved ? " done" : ""}`}>
          <div className="share-progress" aria-hidden>
            <span style={{ width: `${(approved / Math.max(1, quote.lines.length)) * 100}%` }} />
          </div>
          <p>
            {quote.order
              ? "Offerten är godkänd."
              : allApproved
                ? "Offerten är godkänd. Vi sätter igång produktionen."
                : `${approved} av ${quote.lines.length} rader godkända`}
            {quote.eventDate ? ` · behövs ${fmtDay(quote.eventDate)}${late ? ` (${late} hinner inte)` : ""}` : ""}
          </p>
          <div className="share-status-actions">
            {!inProduction && !allApproved ? (
              <button type="button" className="share-approve-btn" disabled={Boolean(busy)} onClick={() => void act("all", { action: "approveAll" })}>
                {busy === "all" ? "…" : show.proofs ? "Godkänn offert och 3D-korrektur" : "Godkänn offerten"}
              </button>
            ) : null}
            {token && !preview ? (
              <a className="share-copy" href={`/api/share/${token}/pdf`} target="_blank" rel="noreferrer">
                PDF
              </a>
            ) : null}
            <button
              type="button"
              className="share-copy"
              disabled={preview}
              onClick={() => {
                void navigator.clipboard?.writeText(window.location.href).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                });
              }}
            >
              {copied ? "Länk kopierad ✓" : "Kopiera länk"}
            </button>
          </div>
        </div>

        <label className="share-name">
          <span>Ditt namn</span>
          <input id="share-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Förnamn Efternamn" autoComplete="name" disabled={preview} />
        </label>
        {error ? <p className="brandbar-err">{error}</p> : null}

        {layout === "bildfokus" ? cards : rows}

        {quote.extras.length ? (
          <ul className="share-extras">
            {quote.extras.map((e) => (
              <li key={e.id}>
                <span>{e.label}</span>
                <b>{e.amount === null ? "Ingår i offerten" : sek(e.amount)}</b>
              </li>
            ))}
          </ul>
        ) : null}
        {quote.total !== null ? (
          <div className="offer-total">
            <span>Totalt (exkl. moms)</span>
            <strong>{sek(quote.total)}</strong>
          </div>
        ) : (
          <p className="share-noprice">{firstName ? `Priser tar ${firstName} fram när ni har bestämt er för upplägget.` : "Priser tar vi fram när ni har bestämt er för upplägget."}</p>
        )}
        {quote.totalInclVat !== null ? (
          <p className="share-vat">
            Inkl. moms {quote.vatPct} %: {sek(quote.totalInclVat)}
          </p>
        ) : null}
        {quote.terms ? (
          <p className="share-terms">
            <b>Villkor</b> Offerten gäller i {quote.terms.validDays} dagar · betalning {quote.terms.paymentDays} dagar netto · moms {quote.terms.vatPct} % tillkommer · ordern binds när offert och korrektur är godkända.
          </p>
        ) : null}

        <section className="share-thread">
          <h2>Kommentarer</h2>
          {quote.comments.length === 0 ? <p className="drawer-note">Inga kommentarer än.</p> : null}
          <ul>
            {quote.comments.map((c) => (
              <li key={c.id}>
                <div>
                  <b>{c.name}</b>
                  {c.productId ? <em>om {lineName(c.productId)}</em> : null}
                  {c.pin ? <span className="pin-badge">Punkt {quote.comments.filter((o) => o.pin && o.productId === c.productId).indexOf(c) + 1}</span> : null}
                  <time>{when(c.at)}</time>
                </div>
                <p>{c.text}</p>
              </li>
            ))}
          </ul>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void act("comment", { action: "comment", text, productId: about || undefined }).then((ok) => {
                if (ok) {
                  setText("");
                  setAbout("");
                }
              });
            }}
          >
            <select value={about} onChange={(e) => setAbout(e.target.value)} aria-label="Gäller">
              <option value="">Hela offerten</option>
              {quote.lines.map((l) => (
                <option key={l.productId} value={l.productId}>
                  {l.name}
                </option>
              ))}
            </select>
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="T.ex. kan vi ta hoodien i marinblått i stället?" rows={3} disabled={preview} />
            <button type="submit" className="offer-submit" disabled={busy === "comment" || !text.trim()}>
              {busy === "comment" ? "Skickar…" : "Skicka kommentar"}
            </button>
          </form>
        </section>
      </div>
      {preview ? null : <SiteFooter />}
    </div>
  );
}
