"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/components/CartProvider";
import { fmtDay } from "@/lib/delivery";
import { familyById } from "@/lib/catalog";
import { defaultDesign, METHOD_INFO } from "@/lib/marking";
import { sek } from "@/lib/pricing";
import type { StylistMessage, StylistReply } from "@/lib/stylist";

type Turn = StylistMessage & { proposal?: StylistReply["proposal"] };

const STARTERS = ["Kick-off för 60 personer i februari, budget 40 000 kr", "Mässmonter i mars, 500 besökare", "Julklappar till 35 anställda"];

/** Hidden on internal and shared pages – the stylist is for building a new order. */
const HIDDEN = /^\/(dashboard|o\/|s\/|butik|gava|demo)/;

export function Stylist() {
  const cart = useCart();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState<number | null>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  if (HIDDEN.test(path ?? "")) return null;

  const send = async (msg: string) => {
    const t = msg.trim();
    if (!t || busy) return;
    const next: Turn[] = [...turns, { role: "user", text: t }];
    setTurns(next);
    setText("");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/stylist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map(({ role, text }) => ({ role, text })), host: cart.host || undefined }),
      });
      const j = (await res.json()) as StylistReply & { error?: string };
      if (!res.ok) throw new Error(j.error || "Stylisten svarar inte just nu.");
      setTurns([...next, { role: "assistant", text: j.reply, proposal: j.proposal }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stylisten svarar inte just nu.");
    } finally {
      setBusy(false);
    }
  };

  const apply = (i: number, p: NonNullable<StylistReply["proposal"]>) => {
    for (const l of p.lines) {
      const family = familyById(l.productId);
      if (!family) continue;
      const existing = cart.itemOf(l.productId);
      const design = { ...defaultDesign(family), method: l.method, colors: METHOD_INFO[l.method].fixedColors ?? 1 };
      cart.save(l.productId, { ...existing, qty: l.qty, design: existing?.design ?? design });
    }
    if (p.needBy) cart.setEventDate(p.needBy);
    setApplied(i);
  };

  return (
    <>
      {!open ? (
        <button type="button" className="stylist-fab" onClick={() => setOpen(true)} aria-label="Fråga merch-stylisten">
          <span aria-hidden>✦</span> Stylist
        </button>
      ) : (
        <section className="stylist" role="dialog" aria-label="Merch-stylist">
          <header>
            <div>
              <b>Merch-stylisten</b>
              <small>Berätta om tillfället – jag sätter ihop allt</small>
            </div>
            <button type="button" className="drawer-x" onClick={() => setOpen(false)} aria-label="Stäng">
              ×
            </button>
          </header>
          <div className="stylist-list" ref={list}>
            {turns.length === 0 ? (
              <div className="stylist-hello">
                <p>Hej! Vad ska ni ha merch till? Säg gärna hur många ni är, när det behövs och ungefärlig budget.</p>
                <div>
                  {STARTERS.map((s) => (
                    <button key={s} type="button" onClick={() => void send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {turns.map((t, i) => (
              <div key={i} className={`stylist-msg ${t.role}`}>
                <p>{t.text}</p>
                {t.proposal && t.proposal.lines.length ? (
                  <div className="stylist-prop">
                    <ul>
                      {t.proposal.lines.map((l) => (
                        <li key={l.productId}>
                          <Image src={cart.itemOf(l.productId)?.image ?? l.image} alt="" width={56} height={56} unoptimized />
                          <span>
                            <b>
                              {l.qty} × {l.name}
                            </b>
                            <small className={l.late ? "late" : ""}>
                              {l.methodLabel} · {l.late ? `hinner inte (ca ${fmtDay(l.delivery)})` : `ca ${fmtDay(l.delivery)}`}
                            </small>
                          </span>
                          <em>{sek(l.lineTotal)}</em>
                        </li>
                      ))}
                    </ul>
                    <div className="stylist-sum">
                      <span>
                        Totalt inkl. tryck{t.proposal.budget ? ` · budget ${sek(t.proposal.budget)}` : ""}
                        {t.proposal.people ? ` · ${sek(Math.round(t.proposal.total / t.proposal.people))}/person` : ""}
                      </span>
                      <b className={t.proposal.overBudget ? "late" : ""}>{sek(t.proposal.total)}</b>
                    </div>
                    {applied === i ? (
                      <Link href="/offert" className="stylist-go">
                        Tillagt ✓ – till offerten →
                      </Link>
                    ) : (
                      <button type="button" className="stylist-go" onClick={() => apply(i, t.proposal!)}>
                        Lägg allt i varukorgen
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            ))}
            {busy ? (
              <div className="stylist-msg assistant">
                <p className="stylist-typing">
                  <i />
                  <i />
                  <i />
                </p>
              </div>
            ) : null}
            {error ? <p className="brandbar-err">{error}</p> : null}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(text);
            }}
          >
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="T.ex. 80 personer, kick-off i Åre, 50 000 kr" aria-label="Meddelande" />
            <button type="submit" disabled={busy || !text.trim()} aria-label="Skicka">
              ↑
            </button>
          </form>
        </section>
      )}
    </>
  );
}
