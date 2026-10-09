"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useCart } from "@/components/CartProvider";

export const DEMO_GREETING = "pach.demo";

/** Set the prospect's brand and open the prepared event page; everything is already generated and cached. */
export function DemoStart({ host, brand, color, event, contact }: { host: string; brand: string; color?: string; event: string; contact?: string }) {
  const cart = useCart();
  const router = useRouter();
  const { ready, clear, setBrand } = cart;

  useEffect(() => {
    if (!ready) return;
    clear();
    setBrand(host, brand, color);
    sessionStorage.setItem(DEMO_GREETING, JSON.stringify({ contact: contact ?? "", brand }));
    router.replace(`/handelse/${event}`);
  }, [ready, clear, setBrand, host, brand, color, event, contact, router]);

  return (
    <div className="demo-start">
      <span className="loader-spin" aria-hidden />
      <p>{contact ? `Hej ${contact}! ` : ""}Vi har förberett det här för {brand}…</p>
    </div>
  );
}
