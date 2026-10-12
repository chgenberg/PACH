"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CartButton } from "@/components/CartButton";
import { HeaderSearch } from "@/components/HeaderSearch";
import { ASSORTMENT } from "@/lib/assortment";
import { familyById } from "@/lib/catalog";
import { useFavorites } from "@/lib/favorites";

const NAV = [
  { href: "/inspiration", label: "Inspiration" },
  { href: "/support", label: "Support" },
];

export function SiteHeader() {
  const path = usePathname();
  const fav = useFavorites();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === path;
  const setOpen = (v: boolean | ((was: boolean) => boolean)) => setOpenAt((typeof v === "function" ? v(open) : v) ? path : null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenAt(null);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header className={`shop-bar${stuck ? " is-stuck" : ""}${open ? " is-mega" : ""}`}>
        <div className="head-top">
          <Link href="/" className="shop-logo" aria-label="PACH">
            <Image src="/PACH_logo.png" alt="PACH profile" width={2198} height={1069} priority />
          </Link>

          <HeaderSearch />

          <nav className="head-links" aria-label="Huvudmeny">
            <button
              type="button"
              className={`head-link head-all${open ? " is-on" : ""}`}
              aria-expanded={open}
              aria-controls="all-panel"
              onClick={() => setOpen((v) => !v)}
            >
              Alla produkter
              <svg className="head-chevron" viewBox="0 0 24 24" aria-hidden>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={`head-link${path === n.href ? " is-on" : ""}`}>
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="head-tools">
            <Link href="/favoriter" className="head-icon fav-head" aria-label={fav.count ? `Favoriter, ${fav.count}` : "Favoriter"}>
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M12 20s-7-4.6-9.5-8.4C.6 8.6 2.2 5 6 5c2 0 3.3 1.2 4 2.2C10.7 6.2 12 5 14 5c3.8 0 5.4 3.6 3.5 6.6C19 15.4 12 20 12 20z" />
              </svg>
              {fav.count ? <span>{fav.count}</span> : null}
            </Link>
            <Link href="/dashboard" className="demo-link">
              Dashboard <span>Demo</span>
            </Link>
            <CartButton />
            <button
              type="button"
              className={`head-menu${open ? " is-on" : ""}`}
              aria-label={open ? "Stäng meny" : "Meny"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              <i />
              <i />
            </button>
          </div>
        </div>

        {open ? (
          <div className="all-veil" onClick={() => setOpen(false)}>
            <div id="all-panel" className="all-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="all-top">
                <div>
                  <p className="kicker">Sortiment</p>
                  <h2 id="all-title">Alla produkter</h2>
                </div>
                <Link href="/kategorier" className="all-az" onClick={() => setOpen(false)}>
                  A–Ö
                </Link>
              </div>
              <nav className="all-mobile-nav">
                {NAV.map((n) => (
                  <Link key={n.href} href={n.href} onClick={() => setOpen(false)}>
                    {n.label}
                  </Link>
                ))}
                <Link href="/favoriter" onClick={() => setOpen(false)}>
                  Favoriter
                </Link>
              </nav>
              <div className="all-grid">
                {ASSORTMENT.map((tile) => {
                  const src = familyById(tile.hero)?.image;
                  return (
                    <Link key={tile.slug} href={`/kategori/${tile.slug}`} className="all-tile" onClick={() => setOpen(false)}>
                      {src ? <Image src={src} alt="" width={280} height={280} sizes="180px" loading="eager" /> : null}
                      <span>{tile.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </header>
    </>
  );
}