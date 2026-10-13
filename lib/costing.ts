import { type Family, fromPrice } from "@/lib/catalog";
import { colorsOf, type LogoDesign, METHOD_INFO, METHODS, type Method, NAME_SETUP, NAME_UNIT } from "@/lib/marking";
import { PRINT_PER_UNIT, PRINT_SETUP, priceLine } from "@/lib/pricing";
import type { MethodTerms } from "@/lib/supplierTypes";

/**
 * Inköp och marginal. Leverantörens pris och tryckpriser kommer från prislistan (New Wave Group sätter sina
 * i leverantörsportalen); utan prislista räknar vi med 60 % av riktpriset och 70 % av tryckpriset.
 */
export const PURCHASE_SHARE = 0.6;
export const PRINT_SHARE = 0.7;

export const defaultUnitCost = (f: Family) => Math.round(fromPrice(f) * PURCHASE_SHARE);

export const defaultMethodTerms = () =>
  Object.fromEntries(
    METHODS.map((m) => [m, { setupPerColor: Math.round(METHOD_INFO[m].setupPerColor * PRINT_SHARE), unitPerColor: Math.round(METHOD_INFO[m].unitPerColor * PRINT_SHARE * 10) / 10 }]),
  ) as Record<Method, MethodTerms>;

/** What the supplier charges for printing a design: same staffling and size rules as the customer price. */
export function printCost(d: LogoDesign | undefined, qty: number, methods: Record<Method, MethodTerms>) {
  if (!d) return { perUnit: Math.round(PRINT_PER_UNIT * PRINT_SHARE), setup: Math.round(PRINT_SETUP * PRINT_SHARE) };
  const tier = qty >= 250 ? 0.7 : qty >= 100 ? 0.8 : qty >= 50 ? 0.9 : 1;
  const parts = [d, ...(d.extra ?? [])].map((p) => {
    const m = methods[p.method];
    const channels = p.method === "digitaltryck" ? 1 : colorsOf(p);
    const size = p.method === "brodyr" && p.sizeCm > 8 ? 1.4 : 1;
    return { perUnit: m.unitPerColor * channels * tier * size, setup: m.setupPerColor * channels };
  });
  const names = d.names?.list.length ? { perUnit: NAME_UNIT * PRINT_SHARE, setup: NAME_SETUP * PRINT_SHARE } : { perUnit: 0, setup: 0 };
  return {
    perUnit: Math.round(parts.reduce((s, p) => s + p.perUnit, 0) + names.perUnit),
    setup: Math.round(parts.reduce((s, p) => s + p.setup, 0) + names.setup),
  };
}

/** Purchase terms for one product, resolved to its supplier. */
export type CostBasis = { productId: string; supplierId: string; supplierName: string; unitCost: number; moq: number; minOrder: number };
export type CostTable = { products: Record<string, CostBasis>; methods: Record<string, Record<Method, MethodTerms>> };

export type PriceMode = "list" | "markup" | "fixed";
/** How the seller prices a line: PACH's list price, a markup on cost, or a price of their own. */
export type Pricing = { mode: PriceMode; markupPct: number; unit?: number; setup?: number };
export const DEFAULT_PRICING: Pricing = { mode: "list", markupPct: 60 };
export const PRICE_MODE_LABEL: Record<PriceMode, string> = { list: "Riktpris", markup: "Påslag", fixed: "Eget pris" };

export type Economics = {
  qty: number;
  /** Supplier cost: product per unit, print per unit, one-off print setup. */
  cost: { unit: number; printUnit: number; setup: number; total: number };
  /** Price to the customer: per unit including print, and the one-off setup. */
  sale: { unit: number; setup: number; total: number };
  list: { unit: number; setup: number };
  tb: number;
  marginPct: number;
};

export function economics(f: Family, qty: number, design: LogoDesign | undefined, table: CostTable | null, pricing: Pricing): Economics {
  const q = Math.max(1, Math.round(qty));
  const basis = table?.products[f.id];
  const methods = (basis && table?.methods[basis.supplierId]) || defaultMethodTerms();
  const unitCost = basis?.unitCost ?? defaultUnitCost(f);
  const print = printCost(design, q, methods);
  const costTotal = (unitCost + print.perUnit) * q + print.setup;
  const list = priceLine(f, q, design);
  let unit = list.unitInclPrint;
  let setup = list.setup;
  if (pricing.mode === "markup") {
    const k = 1 + Math.max(-90, pricing.markupPct) / 100;
    unit = Math.round((unitCost + print.perUnit) * k);
    setup = Math.round(print.setup * k);
  } else if (pricing.mode === "fixed") {
    unit = Math.max(0, Math.round(pricing.unit ?? list.unitInclPrint));
    setup = Math.max(0, Math.round(pricing.setup ?? list.setup));
  }
  const saleTotal = unit * q + setup;
  const tb = saleTotal - costTotal;
  return {
    qty: q,
    cost: { unit: unitCost, printUnit: print.perUnit, setup: print.setup, total: costTotal },
    sale: { unit, setup, total: saleTotal },
    list: { unit: list.unitInclPrint, setup: list.setup },
    tb,
    marginPct: saleTotal ? Math.round((tb / saleTotal) * 100) : 0,
  };
}

export const marginOf = (sale: number, cost: number) => (sale ? Math.round(((sale - cost) / sale) * 100) : 0);
