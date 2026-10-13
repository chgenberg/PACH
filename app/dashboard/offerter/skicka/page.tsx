"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ShareView } from "@/components/ShareView";
import { fmtDate, useQuotes } from "@/components/dashboard/useQuotes";
import { useOfferSettings } from "@/components/dashboard/useOfferSettings";
import { LAYOUT_INFO, type Presentation, presentationOf, SHOW_KEYS, SHOW_LABEL, type ShowKey } from "@/lib/offerTemplates";
import { sek } from "@/lib/pricing";
import type { OfferSend } from "@/lib/quoteTypes";
import type { PublicQuote } from "@/lib/share";

const greeting = (to: string, company: string, seller: string) =>
  `Hej${to ? ` ${to.split(" ")[0]}` : ""}!\n\nHär kommer vårt förslag till ${company}. Öppna länken för att se produkterna med er logga, kommentera och godkänna.\n\nHör av dig om något ska ändras.\n\nVänliga hälsningar\n${seller}`;

export default function SendPage() {
  const [ref, setRef] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the drawer links here with ?ref=
    setRef(new URLSearchParams(window.location.search).get("ref"));
  }, []);
  const { quotes } = useQuotes();
  const settings = useOfferSettings();
  const quote = quotes?.find((q) => q.ref === ref) ?? null;

  const [pres, setPres] = useState<Presentation | null>(null);
  const templates = settings.data?.templates ?? [];
  const current = pres ?? (templates.length ? presentationOf(templates.find((t) => t.id === "t-detaljerad") ?? templates[0]) : null);
  const [toName, setToName] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<"webb" | "pdf">("webb");
  const [preview, setPreview] = useState<PublicQuote | null>(null);
  const [pdfSrc, setPdfSrc] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<{ send: OfferSend; path: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const sellerName = settings.data?.seller.name ?? "";
  const body = message ?? greeting(toName, quote?.company ?? "er", sellerName);

  // Preview follows the toggles, a moment after the last click.
  const key = current ? JSON.stringify(current) : "";
  useEffect(() => {
    if (!ref || !key) return;
    let live = true;
    const t = setTimeout(() => {
      fetch(`/api/dashboard/quotes/${ref}/preview`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ presentation: JSON.parse(key) }) })
        .then((r) => r.json())
        .then((j) => live && j.quote && setPreview(j.quote))
        .catch(() => {});
      setPdfSrc(`/api/dashboard/quotes/${ref}/pdf?p=${encodeURIComponent(key)}`);
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [ref, key]);

  const pick = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (t) setPres(presentationOf(t));
  };
  const toggle = (k: ShowKey) => current && setPres({ ...current, show: { ...current.show, [k]: !current.show[k], ...(k === "prices" && current.show.prices ? { unitPrices: false } : {}) } });

  const send = async () => {
    if (!ref || !current) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/dashboard/quotes/${ref}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presentation: current, to: { name: toName, email: toEmail }, message: body }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Kunde inte skicka.");
      setSent(j);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte skicka.");
    } finally {
      setBusy(false);
    }
  };

  const sends = useMemo(() => [...(quote?.sends ?? [])].reverse(), [quote]);
  const link = sent ? `${typeof window === "undefined" ? "" : window.location.origin}${sent.path}` : "";

  if (quotes && !quote) {
    return (
      <div className="dash-page">
        <p className="table-empty">
          Offerten hittades inte. <Link href="/dashboard/offerter">Till offerterna</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="dash-page wide sd">
      <div className="dash-head">
        <div>
          <p className="drawer-note kp-crumb">
            <Link href={`/dashboard/offerter?open=${ref ?? ""}`}>Offerter</Link> / {ref}
          </p>
          <h1>Skicka offert</h1>
          <p>
            {quote ? `${quote.company} · ${quote.lines.length} ${quote.lines.length === 1 ? "produkt" : "produkter"} · ${sek(quote.total)} exkl. moms` : "Hämtar offerten…"}
          </p>
        </div>
      </div>

      <div className="sd-grid">
        <div className="sd-panel">
          {sent ? (
            <section className="card sd-sent">
              <p className="sd-sent-ok">✓ Skickad till {sent.send.to.name}</p>
              <p className="drawer-note">
                {sent.send.to.email} · mall {sent.send.presentation.name}. Mejlet är simulerat i demon – i drift går det från din adress med länken nedan.
              </p>
              <div className="sd-mail">
                <small>Till: {sent.send.to.email}</small>
                <small>Ämne: Offert {ref} – {quote?.brand ?? quote?.company}</small>
                <p>{sent.send.message}</p>
                <a className="dash-btn" href={sent.path} target="_blank" rel="noreferrer">
                  Öppna offerten
                </a>
              </div>
              <div className="sd-link">
                <input readOnly value={link} aria-label="Länk till offerten" onFocus={(e) => e.target.select()} />
                <button
                  type="button"
                  className="dash-btn ghost"
                  onClick={() => {
                    void navigator.clipboard?.writeText(link).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1600);
                    });
                  }}
                >
                  {copied ? "Kopierad ✓" : "Kopiera"}
                </button>
              </div>
              <div className="sd-actions">
                <button
                  type="button"
                  className="dash-btn ghost"
                  onClick={() => {
                    setSent(null);
                    setToName("");
                    setToEmail("");
                    setMessage(null);
                  }}
                >
                  Skicka till fler
                </button>
                <Link className="dash-btn" href={`/dashboard/offerter?open=${ref}`}>
                  Klar
                </Link>
              </div>
            </section>
          ) : (
            <>
              <section className="card">
                <h2>Mall</h2>
                <div className="sd-templates" role="radiogroup" aria-label="Mall">
                  {templates.map((t) => (
                    <button key={t.id} type="button" role="radio" aria-checked={current?.templateId === t.id} className="sd-template" onClick={() => pick(t.id)}>
                      <span className={`sd-thumb is-${t.layout}`} aria-hidden>
                        <i />
                        <i />
                        <i />
                        <i />
                      </span>
                      <b>{t.name}</b>
                      <small>{t.builtin ? LAYOUT_INFO[t.layout].blurb : `Egen mall · ${LAYOUT_INFO[t.layout].label.toLowerCase()}`}</small>
                    </button>
                  ))}
                </div>
                <p className="drawer-note">
                  <Link href="/dashboard/installningar#mallar">Redigera mallar och din profil</Link>
                </p>
              </section>

              {current ? (
                <section className="card">
                  <h2>Visa i den här offerten</h2>
                  <div className="sd-toggles">
                    {SHOW_KEYS.map((k) => {
                      const off = (k === "unitPrices" && !current.show.prices) || (k === "cover" && current.layout !== "bildfokus");
                      return (
                        <label key={k} className={`toggle sd-toggle${off ? " is-locked" : ""}`}>
                          <input type="checkbox" checked={current.show[k] && !off} disabled={off} onChange={() => toggle(k)} />
                          <span />
                          <div>
                            {SHOW_LABEL[k].label}
                            <small>{k === "cover" && current.layout !== "bildfokus" ? "Bara i bildfokus" : SHOW_LABEL[k].hint}</small>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  <label className="sd-field">
                    Hälsning överst i offerten
                    <textarea rows={3} value={current.intro} onChange={(e) => setPres({ ...current, intro: e.target.value })} />
                  </label>
                </section>
              ) : null}

              <section className="card">
                <h2>Mottagare</h2>
                <div className="fields">
                  <label>
                    Namn
                    <input value={toName} onChange={(e) => setToName(e.target.value)} placeholder="Anna Berg" autoComplete="off" />
                  </label>
                  <label>
                    E-post
                    <input type="email" value={toEmail} onChange={(e) => setToEmail(e.target.value)} placeholder="anna@foretaget.se" autoComplete="off" />
                  </label>
                  <label className="wide">
                    Meddelande
                    <textarea rows={7} value={body} onChange={(e) => setMessage(e.target.value)} />
                  </label>
                </div>
                {error ? <p className="brandbar-err">{error}</p> : null}
                <button type="button" className="dash-btn sd-send" disabled={busy || !current || !quote} onClick={() => void send()}>
                  {busy ? "Skickar…" : `Skicka som ${current?.name.toLowerCase() ?? "offert"}`}
                </button>
                <p className="drawer-note">Varje utskick får en egen länk med sin mall. Godkännanden och kommentarer är gemensamma för alla länkar.</p>
              </section>
            </>
          )}

          {sends.length ? (
            <section className="card">
              <h2>Tidigare utskick</h2>
              <ul className="sd-sends">
                {sends.map((s) => (
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
                    <a href={`/api/dashboard/quotes/${ref}/pdf?send=${s.id}`} target="_blank" rel="noreferrer">
                      PDF
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="sd-preview">
          <div className="seg sd-tabs">
            <button type="button" aria-pressed={tab === "webb"} onClick={() => setTab("webb")}>
              Webbvy
            </button>
            <button type="button" aria-pressed={tab === "pdf"} onClick={() => setTab("pdf")}>
              PDF
            </button>
          </div>
          <div className="sd-frame">
            <div className="sd-bar" aria-hidden>
              <i />
              <i />
              <i />
              <span>{tab === "webb" ? "pach.se/o/…" : `Offert-${ref ?? ""}.pdf`}</span>
            </div>
            {tab === "webb" ? (
              <div className="sd-web">{preview ? <ShareView initial={preview} preview /> : <p className="table-empty">Förbereder förhandsvisningen…</p>}</div>
            ) : pdfSrc ? (
              <iframe key={pdfSrc} className="sd-pdf" src={pdfSrc} title="PDF-förhandsvisning" />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
