"use client";

import Image from "next/image";
import { useState } from "react";
import { useCart } from "@/components/CartProvider";
import { peopleForBudget } from "@/lib/budget";
import { budgetRange, kitForBudget } from "@/lib/budgetKit";
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
  const [budget, setBudget] = useState("");
  const budgetSek = Number(budget.replace(/\D/g, "")) || 0;

  const linesFor = (t: (typeof def.tiers)[number], n: number) =>
    t.lines.flatMap((l) => {
      const family = familyById(l.id);
      if (!family) return [];
      const qty = packageQty(l, n);
      return [{ family, qty, price: priceLine(family, qty).lineTotal }];
    });
  const tiers = def.tiers.map((t) => {
    const lines = linesFor(t, people);
    const reach = budgetSek ? peopleForBudget((n) => linesFor(t, n).reduce((s, l) => s + l.price, 0), budgetSek) : 0;
    return { ...t, lines, total: lines.reduce((s, l) => s + l.price, 0), reach };
  });

  const add = (tier: { id: string; lines: { family: { id: string }; qty: number }[] }) => {
    for (const l of tier.lines) {
      const existing = cart.itemOf(l.family.id);
      cart.save(l.family.id, { ...existing, qty: l.qty, image: existing?.image ?? images[l.family.id] });
    }
    setAdded(tier.id);
    setTimeout(() => setAdded(null), 2200);
  };

  const range = budgetRange(def, people);
  const [kitBudgetRaw, setKitBudget] = useState<number | null>(null);
  const kitBudget = Math.min(range.max, Math.max(range.min, kitBudgetRaw ?? Math.round((tiers[1]?.total ?? range.max / 2) / range.step) * range.step));
  const kit = kitForBudget(def, people, kitBudget);
  const fill = ((kitBudget - range.min) / Math.max(1, range.max - range.min)) * 100;

  return (
    <section className="pkgs">
      <div className="pkgs-head">
        <div>
          <h2>Färdiga paket</h2>
          <p className="drawer-note">Allt som behövs, i rätt antal. Justera sedan fritt i varukorgen.</p>
        </div>
        <div className="pkgs-controls">
        <label className="pkgs-people pkgs-budget">
          <span>Budget (valfritt)</span>
          <input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="t.ex. 40 000 kr" inputMode="numeric" />
        </label>
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
            {budgetSek ? (
              <p className={`pkg-reach${t.reach >= people ? " ok" : ""}`}>
                {t.reach >= 10 ? (
                  <>
                    {sek(budgetSek)} räcker till <b>{t.reach} {def.people}</b>
                    {t.reach !== people ? (
                      <button type="button" onClick={() => setPeople(t.reach)}>
                        Använd
                      </button>
                    ) : null}
                  </>
                ) : (
                  "Budgeten räcker inte till det här paketet"
                )}
              </p>
            ) : null}
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

      <div className="kit">
        <div className="kit-head">
          <div>
            <p className="pkg-tier">Bygg ert kit</p>
            <h3>Dra i budgeten – vi sätter ihop det bästa som ryms</h3>
          </div>
          <div className="kit-sum">
            <strong>{sek(kitBudget)}</strong>
            <small>
              {sek(Math.round(kitBudget / Math.max(1, people)))} {def.perPerson}
            </small>
          </div>
        </div>
        <input
          className="kit-range"
          type="range"
          min={range.min}
          max={range.max}
          step={range.step}
          value={kitBudget}
          onChange={(e) => setKitBudget(Number(e.target.value))}
          style={{ ["--fill" as string]: `${fill}%` }}
          aria-label="Budget för kitet"
        />
        <ul className="kit-lines">
          {kit.lines.map((l) => {
            const src = images[l.family.id] ?? l.family.image;
            return (
              <li key={l.family.id}>
                <Image src={src} alt="" width={96} height={96} unoptimized={src.startsWith("/api/")} />
                <span>
                  <b>{l.family.name}</b>
                  <small>
                    {l.qty} st · {sek(l.price)}
                  </small>
                </span>
              </li>
            );
          })}
          {kit.lines.length === 0 ? <li className="kit-empty">Höj budgeten lite – då ryms den första produkten.</li> : null}
        </ul>
        <div className="kit-foot">
          <span>
            Kitet kostar <b>{sek(kit.total)}</b> inkl. tryck · {sek(Math.max(0, kitBudget - kit.total))} kvar
          </span>
          <button type="button" className={added === "kit" ? "is-added" : ""} disabled={!kit.lines.length} onClick={() => add({ id: "kit", lines: kit.lines })}>
            {added === "kit" ? "Tillagt ✓" : "Lägg kitet i offerten"}
          </button>
        </div>
      </div>
    </section>
  );
}
