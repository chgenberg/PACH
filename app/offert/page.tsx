"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useCart } from "@/components/CartProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { familyById } from "@/lib/catalog";
import { BASE_COLOR, colorName } from "@/lib/colors";
import { DeliveryNote } from "@/components/DeliveryNote";
import { fitToBudget } from "@/lib/budget";
import { estimate, fmtDay } from "@/lib/delivery";
import { designSummary } from "@/lib/marking";
import { priceLine, sek } from "@/lib/pricing";

export default function OfferPage() {
  const cart = useCart();
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [quoteRef, setQuoteRef] = useState("");
  const [budget, setBudget] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [collectUrl, setCollectUrl] = useState("");
  const [collectCopied, setCollectCopied] = useState(false);

  const rows = useMemo(
    () =>
      cart.items
        .map((item) => {
          const family = familyById(item.productId);
          if (!family) return null;
          return { line: priceLine(family, item.qty, item.design), image: item.image ?? family.image, item, family };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null),
    [cart.items],
  );

  const total = rows.reduce((sum, r) => sum + r.line.lineTotal, 0);
  const deliveries = rows.map((r) => estimate(r.family, r.item.design).date);
  const lastDelivery = deliveries.reduce((a, b) => (b > a ? b : a), deliveries[0] ?? "");
  const lateCount = cart.eventDate ? deliveries.filter((d) => d > cart.eventDate).length : 0;

  const budgetSek = Number(budget.replace(/\D/g, "")) || 0;
  const fitBudget = () => {
    const fit = fitToBudget(rows.map((r) => ({ family: r.family, qty: r.item.qty, design: r.item.design })), budgetSek);
    rows.forEach((r, i) => cart.setQty(r.item.productId, fit.qty[i]));
  };

  const createQuote = async () => {
    if (!company.trim()) {
      setError("Fyll i företagsnamn.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: cart.host,
          eventDate: cart.eventDate || undefined,
          brand: cart.brand,
          company: company.trim(),
          phone: phone.trim(),
          lines: cart.items.map((i) => ({ productId: i.productId, qty: i.qty, image: i.image, color: i.color, design: i.design })),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Kunde inte skapa offerten.");
      }
      const ref = res.headers.get("X-Quote-Ref") ?? "";
      setQuoteRef(ref);
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `Offert-${ref || "PACH"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      setCreated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte skapa offerten.");
    } finally {
      setBusy(false);
    }
  };

  const shareQuote = async () => {
    if (!quoteRef) return;
    setSharing(true);
    setError("");
    try {
      let url = shareUrl;
      if (!url) {
        const res = await fetch("/api/share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ref: quoteRef }) });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "Kunde inte skapa länken.");
        url = `${window.location.origin}${j.path}`;
        setShareUrl(url);
      }
      await navigator.clipboard?.writeText(url).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte skapa länken.");
    } finally {
      setSharing(false);
    }
  };

  const hasSizes = rows.some((r) => new Set(r.family.variants.map((v) => v.size)).size > 1);
  const collectSizes = async () => {
    if (!quoteRef) return;
    setError("");
    try {
      let url = collectUrl;
      if (!url) {
        const res = await fetch("/api/collect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ref: quoteRef }) });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "Kunde inte skapa länken.");
        url = `${window.location.origin}${j.path}`;
        setCollectUrl(url);
      }
      await navigator.clipboard?.writeText(url).catch(() => {});
      setCollectCopied(true);
      setTimeout(() => setCollectCopied(false), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte skapa länken.");
    }
  };

  const sendQuote = async () => {
    setSending(true);
    setError("");
    try {
      // Mock – inget riktigt utskick förrän Resend är uppkopplat.
      await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: quoteRef }),
      }).catch(() => null);
      setSent(true);
      cart.clear();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="shop">
      <SiteHeader back={{ href: "/", label: "Fortsätt handla" }} />

      <div className="cat offer">
        {sent ? (
          <div className="offer-thanks">
            <div className="offer-thanks-mark" aria-hidden>
              ✓
            </div>
            <h1>Tack, din offert är nu skickad.</h1>
            <Link href="/" className="offer-thanks-link">
              Tillbaka till förstasidan
            </Link>
          </div>
        ) : (
          <>
        <p className="kicker">Summering</p>
        <h1>Din offert</h1>
        <p className="lede">Riktpriser inkl. märkning, exkl. moms. Priset för märkningen beror på metod, antal färger och upplaga – anpassa loggan per produkt.</p>

        {rows.length === 0 ? (
          <div className="offer-empty">
            <p>Du har inte valt några produkter än.</p>
            <Link href="/" className="cartbar-go">
              Till produkterna →
            </Link>
          </div>
        ) : (
          <>
            <div className="offer-date">
              <label>
                <span>När behöver ni produkterna?</span>
                <input type="date" value={cart.eventDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => cart.setEventDate(e.target.value)} />
              </label>
              {cart.eventDate ? (
                lateCount ? (
                  <p className="delivery late">
                    <span className="delivery-dot" aria-hidden /> {lateCount} {lateCount === 1 ? "produkt hinner" : "produkter hinner"} inte till {fmtDay(cart.eventDate)} – se förslagen nedan.
                  </p>
                ) : (
                  <p className="delivery ok">
                    <span className="delivery-dot" aria-hidden /> Allt hinner till {fmtDay(cart.eventDate)}. Sista leverans ca {fmtDay(lastDelivery)}.
                  </p>
                )
              ) : (
                <p className="delivery">
                  <span className="delivery-dot" aria-hidden /> Allt levereras senast ca {fmtDay(lastDelivery)} om ni beställer i dag.
                </p>
              )}
            </div>
            <div className="offer-budget">
              <span>Har ni en budget?</span>
              <input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="t.ex. 50 000 kr" inputMode="numeric" aria-label="Budget i kronor" />
              <button type="button" disabled={!budgetSek} onClick={fitBudget}>
                Anpassa antalen
              </button>
              {budgetSek ? (
                <p className={total <= budgetSek ? "delivery ok" : "delivery late"}>
                  <span className="delivery-dot" aria-hidden />{" "}
                  {total <= budgetSek ? `${sek(budgetSek - total)} kvar av budgeten.` : `${sek(total - budgetSek)} över budget – tryck "Anpassa antalen" så skalar vi om alla rader lika mycket.`}
                </p>
              ) : null}
            </div>
            <ul className="offer-list">
              {rows.map(({ line, image, item, family }) => (
                <li key={line.productId} className="offer-row">
                  <div className="offer-thumb">
                    <Image src={image} alt={line.name} width={160} height={160} unoptimized={/^(data:|\/api\/)/.test(image)} />
                  </div>
                  <div className="offer-main">
                    <strong>{line.name}</strong>
                    <span>
                      {line.spec} · {colorName(item.color ?? BASE_COLOR)}
                    </span>
                    {item.design ? <span>{designSummary(family, item.design)}</span> : null}
                    <small>{sek(line.unitInclPrint)}/st inkl. tryck · tryckstart {sek(line.setup)}</small>
                    <DeliveryNote family={family} design={item.design} needBy={cart.eventDate} />
                  </div>
                  <div className="offer-qty">
                    <div className="stepper" role="group" aria-label={`Antal ${line.name}`}>
                      <button type="button" onClick={() => cart.setQty(item.productId, line.qty - 10)} aria-label="Färre">
                        −
                      </button>
                      <input type="number" min={1} value={line.qty} onChange={(e) => cart.setQty(item.productId, Number(e.target.value) || 1)} />
                      <button type="button" onClick={() => cart.setQty(item.productId, line.qty + 10)} aria-label="Fler">
                        +
                      </button>
                    </div>
                    <button type="button" className="offer-remove" onClick={() => cart.remove(item.productId)}>
                      Ta bort
                    </button>
                  </div>
                  <div className="offer-sum">{sek(line.lineTotal)}</div>
                </li>
              ))}
            </ul>

            <div className="offer-total">
              <span>Totalt (exkl. moms)</span>
              <strong>{sek(total)}</strong>
            </div>

            <form
              className="offer-form"
              onSubmit={(e) => {
                e.preventDefault();
                void createQuote();
              }}
            >
              <h2>Skapa offert</h2>
              <div className="offer-fields">
                <label>
                  Företagsnamn
                  <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Ert företag AB" />
                </label>
                <label>
                  Telefonnummer
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="070-123 45 67" inputMode="tel" />
                </label>
              </div>
              {error ? <p className="brandbar-err">{error}</p> : null}
              <button type="submit" className="offer-submit" disabled={busy}>
                {busy ? "Skapar offert…" : created ? "Skapa offert igen (PDF)" : "Skapa offert (PDF)"}
              </button>
              {created ? (
                <>
                  <p className="offer-created">Offerten är skapad och nedladdad. Skicka den till kunden när du är redo.</p>
                  <div className="offer-actions">
                    <button type="button" className="offer-send" onClick={() => void sendQuote()} disabled={sending}>
                      {sending ? "Skickar…" : "Skicka offert"}
                    </button>
                    <button type="button" className="offer-share" onClick={() => void shareQuote()} disabled={sharing}>
                      {sharing ? "Skapar länk…" : shareUrl ? (copied ? "Länk kopierad ✓" : "Kopiera länken igen") : "Dela med teamet"}
                    </button>
                  </div>
                  {hasSizes ? (
                    <button type="button" className="offer-share offer-collect" onClick={() => void collectSizes()}>
                      {collectUrl ? (collectCopied ? "Storlekslänk kopierad ✓" : "Kopiera storlekslänken") : "Samla in storlekar från teamet"}
                    </button>
                  ) : null}
                  {collectUrl ? (
                    <p className="offer-share-link">
                      Skicka till alla som ska ha plagg – de väljer storlek och namn själva:{" "}
                      <a href={collectUrl} target="_blank" rel="noreferrer">
                        {collectUrl.replace(/^https?:\/\//, "")}
                      </a>
                    </p>
                  ) : null}
                  {shareUrl ? (
                    <p className="offer-share-link">
                      Kollegorna kan kommentera och godkänna rad för rad:{" "}
                      <a href={shareUrl} target="_blank" rel="noreferrer">
                        {shareUrl.replace(/^https?:\/\//, "")}
                      </a>
                    </p>
                  ) : null}
                </>
              ) : null}
            </form>
          </>
        )}
          </>
        )}
      </div>
    </div>
  );
}
