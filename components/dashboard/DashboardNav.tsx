"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/dashboard/offerter", label: "Offerter", icon: "M6 3h9l5 5v13H6z M14 3v6h6 M9 13h8 M9 17h6" },
  { href: "/dashboard/design", label: "Designverktyg", icon: "M4 20l4-1 11-11-3-3L5 16z M14 6l3 3" },
  { href: "/dashboard/fakturaunderlag", label: "Fakturaunderlag", icon: "M5 4h14v16l-3-2-2 2-2-2-2 2-2-2-3 2z M9 9h6 M9 13h6" },
  { href: "/dashboard/kampanjer", label: "Butiker & gåvor", icon: "M4 9h16v11H4z M4 9l2-5h12l2 5 M12 9v11 M8 4c0 3 4 5 4 5s4-2 4-5" },
  { href: "/dashboard/saljstudio", label: "Säljstudio", icon: "M4 19h16 M7 16V9 M12 16V5 M17 16v-4" },
  { href: "/dashboard/installningar", label: "Inställningar", icon: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M19 12l2-1-2-4-2 1-2-1V5h-4v2l-2 1-2-1-2 4 2 1v2l-2 1 2 4 2-1 2 1v2h4v-2l2-1 2 1 2-4-2-1z" },
];

export function DashboardNav() {
  const path = usePathname();
  return (
    <aside className="dash-side">
      <Link href="/dashboard" className="dash-brand" aria-label="PACH dashboard">
        <Image src="/PACH_logo.png" alt="PACH" width={2198} height={1069} priority />
        <span className="dash-demo">Demo</span>
      </Link>
      <nav className="dash-nav">
        {ITEMS.map((it) => (
          <Link key={it.href} href={it.href} className={`dash-link${path.startsWith(it.href) ? " is-on" : ""}`}>
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d={it.icon} />
            </svg>
            {it.label}
          </Link>
        ))}
      </nav>
      <Link href="/" className="dash-out">
        ← Till sajten
      </Link>
    </aside>
  );
}
