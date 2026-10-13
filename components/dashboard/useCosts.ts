"use client";

import { useEffect, useState } from "react";
import type { CostTable } from "@/lib/costing";

let cached: Promise<CostTable> | null = null;

/** The suppliers' purchase prices, loaded once per page visit. */
export function useCosts() {
  const [table, setTable] = useState<CostTable | null>(null);
  useEffect(() => {
    let live = true;
    cached ??= fetch("/api/dashboard/costs", { cache: "no-store" }).then((r) => r.json() as Promise<CostTable>);
    cached.then((t) => live && setTable(t)).catch(() => (cached = null));
    return () => {
      live = false;
    };
  }, []);
  return table;
}
