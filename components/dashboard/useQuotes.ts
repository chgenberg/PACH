"use client";

import { useCallback, useEffect, useState } from "react";
import type { OrderStage, QuoteStatus, QuoteView } from "@/lib/quoteTypes";

export type QuotePatch = {
  status?: QuoteStatus;
  approved?: boolean;
  kost?: { productId: string; pct: number };
  invoice?: boolean;
  order?: { stage: OrderStage; note?: string; photo?: string; tracking?: string };
};

export const STATUS_LABEL: Record<QuoteStatus, string> = { skapad: "Skapad", skickad: "Skickad", godkand: "Godkänd", fakturerad: "Fakturerad" };

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });

export function useQuotes(opts: { poll?: number } = {}) {
  const [quotes, setQuotes] = useState<QuoteView[] | null>(null);
  const [error, setError] = useState("");
  const { poll } = opts;

  useEffect(() => {
    let live = true;
    const load = () =>
      fetch("/api/dashboard/quotes", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => live && setQuotes(j.quotes ?? []))
        .catch(() => live && setError("Kunde inte hämta offerterna."));
    void load();
    const t = poll ? setInterval(load, poll) : undefined;
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [poll]);

  const patch = useCallback(async (ref: string, body: QuotePatch) => {
    const res = await fetch(`/api/dashboard/quotes/${ref}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Kunde inte spara.");
      return false;
    }
    setError("");
    setQuotes((qs) => (qs ? qs.map((q) => (q.ref === ref ? (json.quote as QuoteView) : q)) : qs));
    return true;
  }, []);

  return { quotes, error, patch };
}
