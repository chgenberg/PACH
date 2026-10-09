import type { Family } from "@/lib/catalog";
import { type LogoDesign, METHOD_INFO, type Method, methodsFor } from "@/lib/marking";

/**
 * Leveranstid: korrektur + produktion per märkmetod + frakt, i arbetsdagar.
 * Platshållarvärden tills leverantörernas riktiga ledtider kopplas in.
 */
export const PROOF_DAYS = 1;
export const SHIPPING_DAYS = 2;
export const PRODUCTION_DAYS: Record<Method, number> = { screentryck: 9, transfer: 5, brodyr: 11, gravyr: 7, digitaltryck: 6 };
/** Personalised names add a day of handling. */
const NAMES_DAYS = 1;

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function addWorkdays(from: Date, days: number) {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}

export function workdays(d: LogoDesign | undefined, method: Method, names = false) {
  const extra = d?.extra?.length ? 1 : 0;
  return PROOF_DAYS + PRODUCTION_DAYS[method] + SHIPPING_DAYS + extra + (names ? NAMES_DAYS : 0);
}

export type Delivery = { date: string; days: number; method: Method };

/** Earliest delivery for a product with (or without) a saved design, ordered today. */
export function estimate(f: Family, d: LogoDesign | undefined, today = new Date()): Delivery {
  const method = d?.method ?? methodsFor(f)[0];
  const days = workdays(d, method, Boolean(d?.names?.list.length));
  return { date: iso(addWorkdays(today, days)), days, method };
}

/** When the date is too late: the fastest method for this product that makes it, if any. */
export function fasterOption(f: Family, d: LogoDesign | undefined, needBy: string, today = new Date()): Delivery | null {
  const names = Boolean(d?.names?.list.length);
  const options = methodsFor(f)
    .map((m) => ({ method: m, days: workdays(d, m, names) }))
    .sort((a, b) => a.days - b.days)
    .map((o) => ({ ...o, date: iso(addWorkdays(today, o.days)) }))
    .filter((o) => o.date <= needBy && o.method !== (d?.method ?? methodsFor(f)[0]));
  return options[0] ?? null;
}

export const fmtDay = (isoDate: string) => new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" });
export const methodLabel = (m: Method) => METHOD_INFO[m].label;
