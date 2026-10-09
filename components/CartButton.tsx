"use client";

import Link from "next/link";
import { useCart } from "@/components/CartProvider";

export function CartButton() {
  const { count } = useCart();
  return (
    <Link href="/offert" className="cart-btn" aria-label={count ? `Varukorg, ${count} ${count === 1 ? "produkt" : "produkter"}` : "Varukorg"}>
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M5 7h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z" />
        <path d="M9 10V6a3 3 0 0 1 6 0v4" />
      </svg>
      {/* Keyed on the count so the badge bounces each time it changes. */}
      {count ? (
        <span key={count} className="cart-count">
          {count}
        </span>
      ) : null}
    </Link>
  );
}
