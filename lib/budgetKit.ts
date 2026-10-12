import { familyById, type Family } from "@/lib/catalog";
import { type EventPackages, packageQty } from "@/lib/packages";
import { priceLine } from "@/lib/pricing";

export type KitLine = { family: Family; qty: number; price: number };

const lineOf = (id: string, qty: number): KitLine | null => {
  const family = familyById(id);
  return family ? { family, qty, price: priceLine(family, qty).lineTotal } : null;
};

/**
 * The richest kit that fits a total budget: the biggest ready-made tier that fits,
 * topped up with products from the other tiers while there is money left.
 */
export function kitForBudget(def: EventPackages, people: number, budget: number): { lines: KitLine[]; total: number } {
  const tierLines = def.tiers.map((t) => t.lines.flatMap((l) => lineOf(l.id, packageQty(l, people)) ?? []));
  const cost = (ls: KitLine[]) => ls.reduce((s, l) => s + l.price, 0);
  const fitting = tierLines.map((ls, i) => ({ ls, i })).filter((t) => cost(t.ls) <= budget);
  const base = fitting.at(-1)?.ls ?? [];
  const chosen = new Map(base.map((l) => [l.family.id, l]));
  let total = cost(base);
  // Cheap extras first, so the budget buys as many useful things as possible.
  const extras = tierLines
    .flat()
    .filter((l, i, all) => !chosen.has(l.family.id) && all.findIndex((x) => x.family.id === l.family.id) === i)
    .sort((a, b) => a.price - b.price);
  for (const l of extras) {
    if (total + l.price > budget) continue;
    chosen.set(l.family.id, l);
    total += l.price;
  }
  return { lines: [...chosen.values()], total };
}

/** Slider range: from the cheapest single line to a bit above the full premium tier. */
export function budgetRange(def: EventPackages, people: number) {
  const all = def.tiers.flatMap((t) => t.lines.flatMap((l) => lineOf(l.id, packageQty(l, people)) ?? []));
  const min = Math.min(...all.map((l) => l.price));
  const premium = def.tiers.at(-1)!.lines.reduce((s, l) => s + (lineOf(l.id, packageQty(l, people))?.price ?? 0), 0);
  const step = premium > 200_000 ? 5000 : premium > 40_000 ? 1000 : 500;
  const round = (n: number, up: boolean) => (up ? Math.ceil(n / step) : Math.floor(n / step)) * step;
  return { min: Math.max(step, round(min, true)), max: round(premium * 1.35, true), step };
}
