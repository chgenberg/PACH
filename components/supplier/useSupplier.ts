"use client";

import { useCallback, useEffect, useState } from "react";
import type { CatalogItem, Demand, OrderAction, PriceList, SupplierOrder } from "@/lib/supplierTypes";

export const fmtDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
export const fmtTime = (iso: string) => new Date(iso).toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const daysUntil = (isoDate: string, now = Date.now()) => Math.ceil((new Date(`${isoDate}T12:00:00`).getTime() - now) / 86_400_000);

async function json<T>(res: Response): Promise<T> {
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j as { error?: string }).error ?? "Något gick fel.");
  return j as T;
}

export function useOrders(opts: { poll?: number } = {}) {
  const [orders, setOrders] = useState<SupplierOrder[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(
    () =>
      fetch("/api/supplier/orders", { cache: "no-store" })
        .then((r) => json<{ orders: SupplierOrder[] }>(r))
        .then((j) => setOrders(j.orders))
        .catch((e) => setError(e instanceof Error ? e.message : "Kunde inte hämta ordrarna.")),
    [],
  );
  useEffect(() => {
    void load();
    if (!opts.poll) return;
    const t = setInterval(load, opts.poll);
    return () => clearInterval(t);
  }, [load, opts.poll]);

  /** Runs an action and swaps the order in place; returns an error message or "". */
  const act = useCallback(async (number: string, body: OrderAction) => {
    try {
      const j = await json<{ order: SupplierOrder }>(await fetch(`/api/supplier/orders/${number}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
      setOrders((list) => (list ?? []).map((o) => (o.number === number ? j.order : o)));
      return "";
    } catch (e) {
      return e instanceof Error ? e.message : "Kunde inte spara.";
    }
  }, []);

  return { orders, error, act, reload: load };
}

export function useCatalog() {
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [prices, setPrices] = useState<PriceList | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/supplier/catalog", { cache: "no-store" })
      .then((r) => json<{ items: CatalogItem[]; prices: PriceList }>(r))
      .then((j) => {
        setItems(j.items);
        setPrices(j.prices);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Kunde inte hämta sortimentet."));
  }, []);

  const patch = useCallback(async (body: { stock?: { sku: string; stock: number }[]; prices?: unknown }) => {
    const j = await json<{ items: CatalogItem[]; prices: PriceList; changed: number }>(
      await fetch("/api/supplier/catalog", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    );
    setItems(j.items);
    setPrices(j.prices);
    return j.changed;
  }, []);

  const upload = useCallback(async (productId: string, image: string, note?: string) => {
    const j = await json<{ items: CatalogItem[] }>(await fetch("/api/supplier/catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, image, note }) }));
    setItems(j.items);
  }, []);

  return { items, prices, error, patch, upload };
}

export function useDemand() {
  const [demand, setDemand] = useState<Demand | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/supplier/demand", { cache: "no-store" })
      .then((r) => json<{ demand: Demand }>(r))
      .then((j) => setDemand(j.demand))
      .catch((e) => setError(e instanceof Error ? e.message : "Kunde inte hämta efterfrågan."));
  }, []);
  return { demand, error };
}

export function downloadCsv(name: string, rows: (string | number)[][]) {
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const blob = new Blob([`\uFEFF${rows.map((r) => r.map(cell).join(";")).join("\n")}`], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
