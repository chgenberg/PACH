"use client";

import Image from "next/image";
import { useState } from "react";
import { useCart } from "@/components/CartProvider";
import { familyById } from "@/lib/catalog";
import type { EventId } from "@/lib/eventAgent";
import { packageQty, PACKAGES } from "@/lib/packages";
import { priceLine, sek } from "@/lib/pricing";

/** Ready-made Bas / Plus / Premium sets that scale with the number of people. */
export function Packages({ event, images }: { event: EventId; images: Record<string, string> }) {
  const cart = useCart();
  const def = PACKAGES[event];
  const [people, setPeople] = useState(def.defaultPeople);
  const [added, setAdded] = useState<string | null>(null);

  const tiers = def.tiers.map((t) => {
    const lines = t.lines.flatMap((l) => {
      const family = familyById(l.id);
      if (!family) return [];
      const qty = packageQty(l, people);
      return [{ family, qty, price: priceLine(family, qty).lineTotal }];
    });
    return { ...t, lines, total: lines.reduce((s, l) => s + l.price, 0) };
  });

  const add = (tier: (typeof tiers)[number]) => {
    for (const l of tier.lines) {
      const existing = cart.itemOf(l.family.id);
      cart.save(l.family.id, { ...existing, qty: l.qty, image: existing?.image ?? images[l.family.id] });
    }
    setAdded(tier.id);
    setTimeout(() => setAdded(null), 2200);
  };

  return (
    <section className="pkgs">
      <div className="pkgs-head">
        <div>
          <h2>Färdiga paket</h2>
          <p className="drawer-note">Allt som behövs, i rätt antal. Justera sedan fritt i varukorgen.</p>
        </div>
        <label className="pkgs-people">
          <span>Antal {def.people}</span>
          <div className="stepper">
            <button type="button" onClick={() => setPeople((p) => Math.max(10, p - 10))} aria-label="Färre">
              −
            </button>
            <input type="number" min={10} value={people} onChange={(e) => setPeople(Math.max(1, Number(e.target.value) || 1))} />
            <button type="button" onClick={() => setPeople((p) => p + 10)} aria-label="Fler">
              +
            </button>
          </div>
        </label>
      </div>
      <div className="pkgs-grid">
        {tiers.map((t) => (
          <article key={t.id} className={`pkg pkg-${t.id}`}>
            <div className="pkg-thumbs">
              {t.lines.slice(0, 4).map((l) => {
                const src = images[l.family.id] ?? l.family.image;
                return <Image key={l.family.id} src={src} alt="" width={120} height={120} unoptimized={src.startsWith("/api/")} />;
              })}
            </div>
            <p className="pkg-tier">{t.name}</p>
            <h3>{t.pitch}</h3>
            <ul>
              {t.lines.map((l) => (
                <li key={l.family.id}>
                  <span>{l.qty} ×</span> {l.family.name}
                </li>
              ))}
            </ul>
            <div className="pkg-foot">
              <div>
                <strong>{sek(t.total)}</strong>
                <small>{sek(Math.round(t.total / Math.max(1, people)))} {def.perPerson} · inkl. tryck</small>
              </div>
              <button type="button" className={added === t.id ? "is-added" : ""} onClick={() => add(t)}>
                {added === t.id ? "Tillagt ✓" : "Lägg till paketet"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
