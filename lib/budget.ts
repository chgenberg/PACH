import type { Family } from "@/lib/catalog";
import type { LogoDesign } from "@/lib/marking";
import { priceLine } from "@/lib/pricing";

type Item = { family: Family; qty: number; design?: LogoDesign };

/** Quantities rounded the way people order: whole fives above 20, never below 10 unless it was a one-off. */
const roundQty = (q: number, original: number) => {
  if (original < 10) return Math.max(1, Math.min(original, Math.floor(q)));
  const n = q > 20 ? Math.floor(q / 5) * 5 : Math.floor(q);
  return Math.max(10, n);
};

const totalOf = (items: Item[], qty: number[]) => items.reduce((s, it, i) => s + priceLine(it.family, qty[i], it.design).lineTotal, 0);

/** Scale every line down by the same factor so the whole order lands just under the budget. */
export function fitToBudget(items: Item[], budget: number): { qty: number[]; total: number; fits: boolean } {
  const scaled = (k: number) => items.map((it) => roundQty(it.qty * k, it.qty));
  // Only ever scale down: a budget is a ceiling, not a target to fill.
  if (totalOf(items, items.map((it) => it.qty)) <= budget) {
    const qty = items.map((it) => it.qty);
    return { qty, total: totalOf(items, qty), fits: true };
  }
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (totalOf(items, scaled(mid)) <= budget) lo = mid;
    else hi = mid;
  }
  const qty = scaled(lo);
  const total = totalOf(items, qty);
  return { qty, total, fits: total <= budget };
}

/** How many people a per-person package covers within a budget. */
export function peopleForBudget(costFor: (people: number) => number, budget: number, max = 5000): number {
  let lo = 0;
  let hi = max;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (costFor(mid) <= budget) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
