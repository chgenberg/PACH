"use client";

import Image from "next/image";
import { useState } from "react";
import type { PublicCampaign } from "@/lib/campaigns";
import { sek } from "@/lib/pricing";

type Pick = { size: string; qty: number };

export function CompanyStore({ store }: { store: PublicCampaign }) {
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<number | null>(null);

  const total = store.products.reduce((s, p) => s + (picks[p.productId] ? (p.unit ?? 0) * picks[p.productId].qty : 0), 0);
  const left = store.budget ? store.budget - total : null;
  const chosen = Object.entries(picks).filter(([, p]) => p.qty > 0);

  const toggle = (pid: string, sizes: string[]) =>
    setPicks((x) => {
      if (x[pid]) {
        const rest = { ...x };
        delete rest[pid];
        return rest;
      }
      return { ...x, [pid]: { size: sizes.length === 1 ? sizes[0] : "", qty: 1 } };
    });

  const order = async () => {
    if (chosen.some(([pid, p]) => store.products.find((x) => x.productId === pid)!.sizes.length && !p.size)) return setError("Välj storlek på allt du lagt till.");
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/campaign/${store.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, items: chosen.map(([productId, p]) => ({ productId, size: p.size, qty: p.qty })) }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Kunde inte beställa.");
      setDone(j.order.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte beställa.");
    } finally {
      setBusy(false);
    }
  };

  if (done !== null) {
    return (
      <div className="collect">
        <div className="offer-thanks">
          <div className="offer-thanks-mark" aria-hidden>
            ✓
          </div>
          <h1>Tack, {name.split(" ")[0]}!</h1>
          <p className="lede">Din beställning på {sek(done)} är mottagen. Bekräftelse skickas till {email}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="collect store">
      <header className="store-hero">
        <p className="kicker">Företagsbutik</p>
        <h1>{store.title}</h1>
        <p className="lede">Välj det du vill ha – med {store.brand}s logga, klart för leverans till kontoret.</p>
        {store.budget ? (
          <div className="store-budget">
            <span>Din budget</span>
            <div className="studio-bar">
              <span style={{ width: `${Math.min(100, (total / store.budget) * 100)}%`, background: left! < 0 ? "#c0392b" : "#111" }} />
            </div>
            <b className={left! < 0 ? "late" : ""}>{left! >= 0 ? `${sek(left!)} kvar av ${sek(store.budget)}` : `${sek(-left!)} över budget`}</b>
          </div>
        ) : null}
      </header>

      <div className="store-grid">
        {store.products.map((p) => {
          const pick = picks[p.productId];
          return (
            <article key={p.productId} className={`store-item${pick ? " is-on" : ""}`}>
              <Image src={p.image} alt={p.name} width={400} height={400} unoptimized={/^(data:|\/api\/)/.test(p.image)} />
              <div className="store-info">
                <b>{p.name}</b>
                <small>
                  {p.color} · {p.unit ? sek(p.unit) : ""}
                </small>
              </div>
              {pick && p.sizes.length ? (
                <div className="collect-sizes">
                  {p.sizes.map((s) => (
                    <button key={s} type="button" role="radio" aria-checked={pick.size === s} onClick={() => setPicks((x) => ({ ...x, [p.productId]: { ...pick, size: s } }))}>
                      {s}
                    </button>
                  ))}
                </div>
              ) : null}
              <button type="button" className={pick ? "store-btn on" : "store-btn"} onClick={() => toggle(p.productId, p.sizes)}>
                {pick ? "Vald ✓" : "Välj"}
              </button>
            </article>
          );
        })}
      </div>

      {chosen.length ? (
        <form
          className="store-checkout"
          onSubmit={(e) => {
            e.preventDefault();
            void order();
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ditt namn" autoComplete="name" required />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Jobbmejl" type="email" autoComplete="email" required />
          <button type="submit" className="offer-submit" disabled={busy || (left !== null && left < 0)}>
            {busy ? "Beställer…" : `Beställ ${chosen.length} ${chosen.length === 1 ? "sak" : "saker"} · ${sek(total)}`}
          </button>
          {error ? <p className="brandbar-err">{error}</p> : null}
        </form>
      ) : null}
    </div>
  );
}
