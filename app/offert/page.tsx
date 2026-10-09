"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useCart } from "@/components/CartProvider";
import { familyById } from "@/lib/catalog";
import { BASE_COLOR, colorName } from "@/lib/colors";
import { PRINT_PER_UNIT, PRINT_SETUP, priceLine, sek } from "@/lib/pricing";

export default function OfferPage() {
  const cart = useCart();
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const rows = useMemo(
    () =>
      cart.items
        .map((item) => {
          const family = familyById(item.productId);
          if (!family) return null;
          return { line: priceLine(family, item.qty), image: item.image ?? family.image, item };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null),
    [cart.items],
  );

  const total = rows.reduce((sum, r) => sum + r.line.lineTotal, 0);

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
          brand: cart.brand,
          company: company.trim(),
          phone: phone.trim(),
          lines: cart.items.map((i) => ({ productId: i.productId, qty: i.qty, image: i.image, color: i.color })),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Kunde inte skapa offerten.");
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `Offert-${(company.trim() || "PACH").replace(/[^\w-]+/g, "_")}.pdf`;
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

  const sendQuote = async () => {
    setSending(true);
    setError("");
    try {
      // Mock – inget riktigt utskick förrän Resend är uppkopplat.
      await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: company.trim(), phone: phone.trim(), host: cart.host }),
      }).catch(() => null);
      setSent(true);
      cart.clear();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="shop">
      <header className="shop-bar">
        <Link href="/" className="shop-logo" aria-label="PACH">
          <Image src="/PACH_logo.png" alt="PACH profile" width={2198} height={1069} priority />
        </Link>
        <Link href="/" className="shop-back">
          Fortsätt handla
        </Link>
      </header>

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
        <p className="lede">Riktpriser inkl. tryck, exkl. moms. Tryckstart {sek(PRINT_SETUP)} per produkt, tryck {sek(PRINT_PER_UNIT)}/st.</p>

        {rows.length === 0 ? (
          <div className="offer-empty">
            <p>Du har inte valt några produkter än.</p>
            <Link href="/" className="cartbar-go">
              Till produkterna →
            </Link>
          </div>
        ) : (
          <>
            <ul className="offer-list">
              {rows.map(({ line, image, item }) => (
                <li key={line.productId} className="offer-row">
                  <div className="offer-thumb">
                    <Image src={image} alt={line.name} width={160} height={160} unoptimized={image.startsWith("data:")} />
                  </div>
                  <div className="offer-main">
                    <strong>{line.name}</strong>
                    <span>
                      {line.spec} · {colorName(item.color ?? BASE_COLOR)}
                    </span>
                    <small>{sek(line.unitInclPrint)}/st inkl. tryck · tryckstart {sek(line.setup)}</small>
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
                  <button type="button" className="offer-send" onClick={() => void sendQuote()} disabled={sending}>
                    {sending ? "Skickar…" : "Skicka offert"}
                  </button>
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
