"use client";

import { useCallback, useEffect, useState } from "react";
import type { OfferTemplate, SellerProfile } from "@/lib/offerTemplates";
import type { TemplateAction } from "@/lib/offerSettings";

type Settings = { seller: SellerProfile; templates: OfferTemplate[] };

/** Seller profile and offer templates from the server – the PDFs and links read the same copy. */
export function useOfferSettings() {
  const [data, setData] = useState<Settings | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    fetch("/api/dashboard/offer-settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => live && setData(j))
      .catch(() => live && setError("Kunde inte hämta mallarna."));
    return () => {
      live = false;
    };
  }, []);

  const post = useCallback(async (body: { seller: SellerProfile } | { template: TemplateAction }) => {
    const res = await fetch("/api/dashboard/offer-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "Kunde inte spara.");
    setData((d) => (d ? { seller: j.seller ?? d.seller, templates: j.templates ?? d.templates } : d));
    return j as { seller?: SellerProfile; templates?: OfferTemplate[]; id?: string };
  }, []);

  return { data, error, post };
}
