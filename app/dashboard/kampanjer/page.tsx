"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtDate, useQuotes } from "@/components/dashboard/useQuotes";
import type { Campaign } from "@/lib/campaigns";
import { familyById } from "@/lib/catalog";
import { sek } from "@/lib/pricing";

export default function CampaignsPage() {
  const { quotes } = useQuotes();
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [kind, setKind] = useState<"store" | "gift">("store");
  const [ref, setRef] = useState("");
  const [title, setTitle] = useState("");
  const [budget, setBudget] = useState("1500");
  const [recipients, setRecipients] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState("");

  const load = () =>
    fetch("/api/dashboard/campaigns", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setCampaigns(j.campaigns ?? []))
      .catch(() => setCampaigns([]));
  useEffect(() => {
    void load();
  }, []);

  const usable = useMemo(() => (quotes ?? []).filter((q) => !q.demo || q.status !== "skapad"), [quotes]);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(text);
    setTimeout(() => setCopied(""), 1800);
  };

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref, kind, title, budget: Number(budget.replace(/\D/g, "")), recipients }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setOpen(j.campaign.token);
      setTitle("");
      setRecipients("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte skapa.");
    } finally {
      setBusy(false);
    }
  };

  const selected = campaigns?.find((c) => c.token === open) ?? null;

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1>Butiker &amp; gåvor</h1>
          <p>Gör en offert till en egen företagsbutik där de anställda beställer inom en budget – eller till ett gåvoutskick där varje mottagare väljer gåva, storlek och adress själv.</p>
        </div>
      </div>

      <form
        className="campaign-form"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <div className="seg">
          <button type="button" aria-pressed={kind === "store"} onClick={() => setKind("store")}>
            Företagsbutik
          </button>
          <button type="button" aria-pressed={kind === "gift"} onClick={() => setKind("gift")}>
            Gåvoutskick
          </button>
        </div>
        <label>
          Utgå från offert
          <select value={ref} onChange={(e) => setRef(e.target.value)} required>
            <option value="">Välj offert…</option>
            {usable.map((q) => (
              <option key={q.ref} value={q.ref}>
                {q.company} · {q.ref} · {q.lines.length} produkter
              </option>
            ))}
          </select>
        </label>
        <label>
          Rubrik (valfritt)
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "gift" ? "Tack för ett fantastiskt år" : "Spotify Store"} />
        </label>
        {kind === "store" ? (
          <label>
            Budget per anställd (kr)
            <input value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="numeric" />
          </label>
        ) : (
          <label className="campaign-wide">
            Mottagare – en per rad: namn; e-post
            <textarea value={recipients} onChange={(e) => setRecipients(e.target.value)} rows={5} placeholder={"Anna Berg; anna@foretag.se\nErik Ek; erik@foretag.se"} />
          </label>
        )}
        <button type="submit" className="dash-btn" disabled={busy || !ref}>
          {busy ? "Skapar…" : kind === "gift" ? "Skapa gåvoutskick" : "Skapa butik"}
        </button>
        {error ? <p className="brandbar-err campaign-wide">{error}</p> : null}
      </form>

      <div className="table">
        <div className="tr th">
          <span>Kampanj</span>
          <span>Typ</span>
          <span>Produkter</span>
          <span className="r">Status</span>
          <span />
        </div>
        {campaigns === null ? <p className="table-empty">Hämtar…</p> : null}
        {campaigns && !campaigns.length ? <p className="table-empty">Inga butiker eller gåvoutskick än.</p> : null}
        {campaigns?.map((c) => (
          <button key={c.token} type="button" className="tr" onClick={() => setOpen(c.token)}>
            <span>
              <b>{c.title}</b>
              <small>
                {c.company} · {fmtDate(c.createdAt)}
              </small>
            </span>
            <span>{c.kind === "gift" ? "Gåvoutskick" : "Företagsbutik"}</span>
            <span>{c.products.length} st</span>
            <span className="r">
              <b>{c.kind === "gift" ? `${c.recipients.filter((r) => r.choice).length} av ${c.recipients.length} valt` : `${c.orders.length} ordrar`}</b>
              {c.kind === "store" ? <small>{sek(c.orders.reduce((s, o) => s + o.total, 0))}</small> : null}
            </span>
            <span>›</span>
          </button>
        ))}
      </div>

      {selected ? (
        <div className="drawer-wrap" role="dialog" aria-modal="true" aria-label={selected.title}>
          <button type="button" className="drawer-veil" aria-label="Stäng" onClick={() => setOpen(null)} />
          <aside className="drawer">
            <div className="drawer-head">
              <h2>{selected.title}</h2>
              <button type="button" className="drawer-x" onClick={() => setOpen(null)} aria-label="Stäng">
                ×
              </button>
            </div>
            {selected.kind === "store" ? (
              <>
                <div className="drawer-block">
                  <p className="drawer-label">Butikslänk till de anställda</p>
                  <button type="button" className="dash-btn size-link" onClick={() => copy(`${origin}/butik/${selected.token}`)}>
                    {copied === `${origin}/butik/${selected.token}` ? "Kopierad ✓" : "Kopiera butikslänken"}
                  </button>
                  <p className="drawer-note">
                    <a href={`/butik/${selected.token}`} target="_blank" rel="noreferrer">
                      Öppna butiken
                    </a>
                    {selected.budget ? ` · budget ${sek(selected.budget)} per person` : ""}
                  </p>
                </div>
                <div className="drawer-block">
                  <p className="drawer-label">Ordrar · {selected.orders.length}</p>
                  {selected.orders.length ? (
                    <ul className="mini-comments">
                      {selected.orders.map((o) => (
                        <li key={o.id}>
                          <b>{o.name}</b> – {o.items.map((i) => `${familyById(i.productId)?.name} ${i.size}${i.qty > 1 ? ` ×${i.qty}` : ""}`).join(", ")} · {sek(o.total)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="drawer-note">Inga ordrar än.</p>
                  )}
                </div>
              </>
            ) : (
              <div className="drawer-block">
                <p className="drawer-label">
                  Mottagare · {selected.recipients.filter((r) => r.choice).length} av {selected.recipients.length} har valt
                </p>
                <button
                  type="button"
                  className="dash-btn size-link"
                  onClick={() => copy(selected.recipients.map((r) => `${r.name}${r.email ? ` <${r.email}>` : ""}: ${origin}/gava/${selected.token}/${r.id}`).join("\n"))}
                >
                  Kopiera alla personliga länkar
                </button>
                <ul className="gift-list">
                  {selected.recipients.map((r) => (
                    <li key={r.id}>
                      <span>
                        <b>{r.name}</b>
                        <small>{r.choice ? `${familyById(r.choice.productId)?.name} ${r.choice.size} · ${r.address?.city ?? ""}` : (r.email ?? "Väntar på val")}</small>
                      </span>
                      <i className={`badge ${r.choice ? "badge-godkand" : "badge-skickad"}`}>{r.choice ? "Vald" : "Väntar"}</i>
                      <button type="button" className="cz-link" onClick={() => copy(`${origin}/gava/${selected.token}/${r.id}`)}>
                        {copied === `${origin}/gava/${selected.token}/${r.id}` ? "✓" : "Länk"}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="drawer-foot">
              <a className="drawer-save" href={`/api/dashboard/campaigns/${selected.token}/csv`}>
                {selected.kind === "gift" ? "Ladda ner adresslista (CSV)" : "Ladda ner ordrar (CSV)"}
              </a>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
