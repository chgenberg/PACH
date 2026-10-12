"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { SupplierOrder } from "@/lib/supplierTypes";

const ITEMS = [
  { href: "/leverantor", label: "Översikt", icon: "M4 4h7v7H4z M13 4h7v4h-7z M13 10h7v10h-7z M4 13h7v7H4z" },
  { href: "/leverantor/ordrar", label: "Inköpsordrar", icon: "M6 3h9l5 5v13H6z M14 3v6h6 M9 13h8 M9 17h6" },
  { href: "/leverantor/produktion", label: "Produktion & leverans", icon: "M3 7h11v9H3z M14 10h4l3 3v3h-7z M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" },
  { href: "/leverantor/efterfragan", label: "Efterfrågan", icon: "M4 19h16 M4 15l5-5 4 3 7-7 M15 6h5v5" },
  { href: "/leverantor/sortiment", label: "Sortiment & lager", icon: "M4 8l8-4 8 4-8 4z M4 8v8l8 4 8-4V8 M12 12v8" },
  { href: "/leverantor/priser", label: "Priser", icon: "M4 12l8-8h8v8l-8 8z M15 9h.01" },
  { href: "/leverantor/avrakning", label: "Avräkning", icon: "M5 4h14v16l-3-2-2 2-2-2-2 2-2-2-3 2z M9 9h6 M9 13h6" },
  { href: "/leverantor/innehall", label: "Innehåll", icon: "M4 5h16v14H4z M4 15l4-4 4 4 3-3 5 5 M15 9h.01" },
  { href: "/leverantor/installningar", label: "Inställningar", icon: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M19 12l2-1-2-4-2 1-2-1V5h-4v2l-2 1-2-1-2 4 2 1v2l-2 1 2 4 2-1 2 1v2h4v-2l2-1 2 1 2-4-2-1z" },
];

/** New orders waiting for confirmation, refreshed every half minute. */
function useNewCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let live = true;
    const check = () =>
      fetch("/api/supplier/orders", { cache: "no-store" })
        .then((r) => r.json())
        .then((j: { orders?: SupplierOrder[] }) => live && setCount((j.orders ?? []).filter((o) => o.state.stage === "ny").length))
        .catch(() => {});
    void check();
    const t = setInterval(check, 30_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);
  return count;
}

export function SupplierNav() {
  const path = usePathname();
  const fresh = useNewCount();
  return (
    <aside className="dash-side sp-side">
      <Link href="/leverantor" className="dash-brand" aria-label="PACH leverantörsportal">
        <Image src="/PACH_logo.png" alt="PACH" width={2198} height={1069} priority />
        <span className="dash-demo">Demo</span>
      </Link>
      <div className="sp-who">
        <span className="sp-mark" aria-hidden>
          NWG
        </span>
        <span>
          <b>New Wave Group</b>
          <small>Leverantörsportal</small>
        </span>
      </div>
      <nav className="dash-nav">
        {ITEMS.map((it) => (
          <Link key={it.href} href={it.href} className={`dash-link${(it.href === "/leverantor" ? path === it.href : path.startsWith(it.href)) ? " is-on" : ""}`}>
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d={it.icon} />
            </svg>
            <span className="dash-label">{it.label}</span>
            {it.href === "/leverantor/ordrar" && fresh ? <span className="dash-count" aria-label={`${fresh} nya ordrar`}>{fresh}</span> : null}
          </Link>
        ))}
      </nav>
      <div className="sp-foot">
        <Link href="/dashboard" className="dash-out">
          ⇄ <span className="dash-label">PACH-dashboarden</span>
        </Link>
        <Link href="/" className="dash-out">
          ← <span className="dash-label">Till sajten</span>
        </Link>
      </div>
    </aside>
  );
}
