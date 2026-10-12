"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { activityOf, SEEN_KEY } from "@/components/dashboard/activity";

const ITEMS = [
  { href: "/dashboard", label: "Översikt", icon: "M4 4h7v7H4z M13 4h7v4h-7z M13 10h7v10h-7z M4 13h7v7H4z" },
  { href: "/dashboard/offerter", label: "Offerter", icon: "M6 3h9l5 5v13H6z M14 3v6h6 M9 13h8 M9 17h6" },
  { href: "/dashboard/design", label: "Designverktyg", icon: "M4 20l4-1 11-11-3-3L5 16z M14 6l3 3" },
  { href: "/dashboard/fakturaunderlag", label: "Fakturaunderlag", icon: "M5 4h14v16l-3-2-2 2-2-2-2 2-2-2-3 2z M9 9h6 M9 13h6" },
  { href: "/dashboard/kampanjer", label: "Butiker & gåvor", icon: "M4 9h16v11H4z M4 9l2-5h12l2 5 M12 9v11 M8 4c0 3 4 5 4 5s4-2 4-5" },
  { href: "/dashboard/saljstudio", label: "Säljstudio", icon: "M4 19h16 M7 16V9 M12 16V5 M17 16v-4" },
  { href: "/dashboard/installningar", label: "Inställningar", icon: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M19 12l2-1-2-4-2 1-2-1V5h-4v2l-2 1-2-1-2 4 2 1v2l-2 1 2 4 2-1 2 1v2h4v-2l2-1 2 1 2-4-2-1z" },
];

/** Customer activity since the overview was last opened – comments, approvals and new quotes. */
function useFresh(path: string) {
  const [fresh, setFresh] = useState(0);
  useEffect(() => {
    let live = true;
    const check = () =>
      fetch("/api/dashboard/quotes", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => {
          if (!live) return;
          const seen = localStorage.getItem(SEEN_KEY);
          setFresh(path === "/dashboard" || !seen ? 0 : activityOf(j.quotes ?? []).filter((a) => a.at > seen).length);
        })
        .catch(() => {});
    void check();
    const t = setInterval(check, 30_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [path]);
  return fresh;
}

export function DashboardNav() {
  const path = usePathname();
  const fresh = useFresh(path);
  // The design tool needs the whole screen, so the menu shrinks to icons there.
  const compact = path.startsWith("/dashboard/design");
  return (
    <aside className={`dash-side${compact ? " is-compact" : ""}`}>
      <Link href="/dashboard" className="dash-brand" aria-label="PACH dashboard">
        <Image src="/PACH_logo.png" alt="PACH" width={2198} height={1069} priority />
        <span className="dash-demo">Demo</span>
      </Link>
      <nav className="dash-nav">
        {ITEMS.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={`dash-link${(it.href === "/dashboard" ? path === it.href : path.startsWith(it.href)) ? " is-on" : ""}`}
            aria-label={compact ? it.label : undefined}
            data-tip={compact ? it.label : undefined}
          >
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d={it.icon} />
            </svg>
            <span className="dash-label">{it.label}</span>
            {it.href === "/dashboard" && fresh ? <span className="dash-count" aria-label={`${fresh} nya händelser`}>{fresh}</span> : null}
          </Link>
        ))}
      </nav>
      <Link href="/" className="dash-out" aria-label={compact ? "Till sajten" : undefined} data-tip={compact ? "Till sajten" : undefined}>
        ← <span className="dash-label">Till sajten</span>
      </Link>
    </aside>
  );
}
