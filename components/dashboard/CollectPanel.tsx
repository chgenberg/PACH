"use client";

import { useState } from "react";
import { familyById } from "@/lib/catalog";
import type { QuoteView } from "@/lib/quoteTypes";

const sizesOf = (productId: string) => [...new Set(familyById(productId)?.variants.map((v) => v.size) ?? [])].filter((s) => s !== "ONE_SIZE");

export function CollectPanel({ quote }: { quote: QuoteView }) {
  const [path, setPath] = useState(quote.collect ? `/s/${quote.collect.token}` : "");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const lines = quote.lines.filter((l) => sizesOf(l.productId).length > 1);
  if (!lines.length) return null;
  const entries = quote.collect?.entries ?? [];

  const create = async () => {
    setError("");
    try {
      let p = path;
      if (!p) {
        const res = await fetch("/api/collect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ref: quote.ref }) });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error);
        p = j.path as string;
        setPath(p);
      }
      await navigator.clipboard?.writeText(`${window.location.origin}${p}`).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte skapa länken.");
    }
  };

  return (
    <div className="drawer-block">
      <p className="drawer-label">Storleksinsamling · {entries.length} svar</p>
      {lines.map((l) => {
        const counts = sizesOf(l.productId).map((s) => [s, entries.filter((e) => e.sizes[l.productId] === s).length] as const);
        const total = counts.reduce((a, [, n]) => a + n, 0);
        return (
          <div key={l.productId} className="size-bars">
            <span>
              {familyById(l.productId)?.name} <small>{total} av {l.qty}</small>
            </span>
            <div>
              {counts.map(([s, n]) => (
                <i key={s} style={{ flexGrow: Math.max(n, 0.4) }} title={`${s}: ${n}`}>
                  {s} {n}
                </i>
              ))}
            </div>
          </div>
        );
      })}
      {entries.some((e) => e.print) ? <p className="drawer-note">{entries.filter((e) => e.print).length} namn för tryck – följer med inköpsordern som namn.csv.</p> : null}
      {error ? <p className="brandbar-err">{error}</p> : null}
      <button type="button" className="dash-btn size-link" onClick={() => void create()}>
        {copied ? "Länk kopierad ✓" : path ? "Kopiera storlekslänken" : "Skapa storlekslänk till de anställda"}
      </button>
      {path ? (
        <p className="drawer-note">
          <a href={path} target="_blank" rel="noreferrer">
            Öppna formuläret
          </a>
        </p>
      ) : null}
    </div>
  );
}
