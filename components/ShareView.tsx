"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { fmtDay } from "@/lib/delivery";
import { sek } from "@/lib/pricing";
import { ORDER_STAGES, STAGE_LABEL } from "@/lib/quoteTypes";
import type { PublicQuote } from "@/lib/share";

const NAME_KEY = "pach.reviewer";

const when = (iso: string) =>
  new Date(iso).toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function ShareView({ token, initial }: { token: string; initial: PublicQuote }) {
  const [quote, setQuote] = useState(initial);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [about, setAbout] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from localStorage after hydration
    setName(localStorage.getItem(NAME_KEY) ?? "");
    const t = setInterval(() => {
      fetch(`/api/share/${token}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => j?.quote && setQuote(j.quote))
        .catch(() => {});
    }, 15_000);
    return () => clearInterval(t);
  }, [token]);

  const act = async (key: string, body: Record<string, string | undefined>) => {
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

  const approved = quote.lines.filter((l) => l.approval).length;
  const inProduction = Boolean(quote.order) || quote.status === "godkand" || quote.status === "fakturerad";
  const allApproved = approved === quote.lines.length || inProduction;
  const late = quote.eventDate ? quote.lines.filter((l) => l.delivery && l.delivery > quote.eventDate!).length : 0;
  const lineName = (id?: string) => quote.lines.find((l) => l.productId === id)?.name;

  return (
    <div className="shop">
      <SiteHeader />
      <div className="cat offer share">
        <p className="kicker">Offert {quote.ref} · för granskning</p>
        <h1>{quote.brand ? `Merch för ${quote.brand}` : `Offert till ${quote.company}`}</h1>
        <p className="lede">
          Titta igenom produkterna, kommentera och godkänn rad för rad. När alla rader är godkända går offerten vidare till produktion.
        </p>

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
                  .map((h) => (
                    <figure key={h.at}>
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

        <div className={`share-status${allApproved ? " done" : ""}`}>
          <div className="share-progress" aria-hidden>
            <span style={{ width: `${(approved / Math.max(1, quote.lines.length)) * 100}%` }} />
          </div>
          <p>
            {quote.order ? "Offerten är godkänd och i produktion." : allApproved ? "Offerten är godkänd – vi återkommer med korrektur." : `${approved} av ${quote.lines.length} rader godkända`}
            {quote.eventDate ? ` · behövs ${fmtDay(quote.eventDate)}${late ? ` (${late} hinner inte)` : ""}` : ""}
          </p>
          <button
            type="button"
            className="share-copy"
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

        <label className="share-name">
          <span>Ditt namn</span>
          <input id="share-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Förnamn Efternamn" autoComplete="name" />
        </label>
        {error ? <p className="brandbar-err">{error}</p> : null}

        <ul className="offer-list">
          {quote.lines.map((l) => {
            const notes = quote.comments.filter((c) => c.productId === l.productId);
            return (
              <li key={l.productId} className={`offer-row share-row${l.approval ? " is-approved" : ""}`}>
                <div className="offer-thumb">{l.image ? <Image src={l.image} alt={l.name} width={160} height={160} unoptimized={/^(data:|\/api\/)/.test(l.image)} /> : null}</div>
                <div className="offer-main">
                  <strong>{l.name}</strong>
                  <span>
                    {l.qty} st · {l.spec}
                  </span>
                  {l.design ? <span>{l.design}</span> : null}
                  <small>
                    {sek(l.unitInclPrint)}/st inkl. tryck{l.delivery ? ` · leverans ca ${fmtDay(l.delivery)}` : ""}
                  </small>
                  {notes.length ? (
                    <ul className="share-notes">
                      {notes.map((c) => (
                        <li key={c.id}>
                          <b>{c.name}:</b> {c.text}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <button type="button" className="share-reply" onClick={() => {
                      setAbout(l.productId);
                      document.querySelector<HTMLTextAreaElement>(".share-thread textarea")?.focus();
                    }}
                  >
                    Kommentera
                  </button>
                </div>
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
                <div className="offer-sum">{sek(l.lineTotal)}</div>
              </li>
            );
          })}
        </ul>

        <div className="offer-total">
          <span>Totalt (exkl. moms)</span>
          <strong>{sek(quote.total)}</strong>
        </div>

        <section className="share-thread">
          <h2>Kommentarer</h2>
          {quote.comments.length === 0 ? <p className="drawer-note">Inga kommentarer än.</p> : null}
          <ul>
            {quote.comments.map((c) => (
              <li key={c.id}>
                <div>
                  <b>{c.name}</b>
                  {c.productId ? <em>om {lineName(c.productId)}</em> : null}
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
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="T.ex. kan vi ta hoodien i marinblått i stället?" rows={3} />
            <button type="submit" className="offer-submit" disabled={busy === "comment" || !text.trim()}>
              {busy === "comment" ? "Skickar…" : "Skicka kommentar"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
