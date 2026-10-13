"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { families, fromPrice } from "@/lib/catalog";
import type { CostTable } from "@/lib/costing";
import { sek } from "@/lib/pricing";

/** Search the whole catalogue and pick one product; shows supplier and purchase price for the seller. */
export function ProductPicker({ table, onPick, exclude = [] }: { table: CostTable | null; onPick: (productId: string) => void; exclude?: string[] }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return families.filter((f) => !exclude.includes(f.id) && (!needle || `${f.name} ${f.subcategory} ${table?.products[f.id]?.supplierName ?? ""}`.toLowerCase().includes(needle)));
  }, [q, exclude, table]);
  return (
    <div className="kp-picker">
      <input className="sp-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sök produkt eller leverantör…" aria-label="Sök produkt" autoFocus />
      <ul>
        {shown.map((f) => {
          const b = table?.products[f.id];
          return (
            <li key={f.id}>
              <button type="button" onClick={() => onPick(f.id)}>
                <Image src={f.image} alt="" width={120} height={120} />
                <b>{f.name}</b>
                <small>{b?.supplierName ?? f.brand}</small>
                <small>
                  Från {sek(fromPrice(f))}
                  {b ? ` · inköp ${sek(b.unitCost)}` : ""}
                </small>
              </button>
            </li>
          );
        })}
      </ul>
      {!shown.length ? <p className="drawer-note">Inga produkter matchar.</p> : null}
    </div>
  );
}
