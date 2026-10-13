"use client";

import { useState } from "react";

/** "Ny offert från denna": a draft with the same products and designs, returned as its ref. */
export function useReorder() {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const run = async (ref: string): Promise<string | null> => {
    setBusy(ref);
    setError("");
    try {
      const res = await fetch("/api/dashboard/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reorder: ref }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Kunde inte skapa offerten.");
      return j.ref as string;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte skapa offerten.");
      return null;
    } finally {
      setBusy("");
    }
  };
  return { busy, error, run };
}
