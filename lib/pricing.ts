import { familyById, fromPrice, type Family } from "@/lib/catalog";
import { type LogoDesign, markingPrice, sanitizeDesign } from "@/lib/marking";

/**
 * Enkel prismodell "inkl. tryck".
 * - Produktpriset är riktpris exkl. moms (recommended_price_ex_vat) – aldrig inköpspris.
 * - Trycket läggs på som ett pris per styck plus en engångs tryckstart (kliché) per produkt.
 * Allt är riktpriser och kan justeras senare när riktiga tryckpriser kopplas in.
 */
export const PRINT_PER_UNIT = 12; // kr/st, enfärgstryck inkl. påslag
export const PRINT_SETUP = 450; // kr engångs tryckstart per produkt

export type QuoteLine = {
  productId: string;
  name: string;
  spec: string;
  qty: number;
  unitProduct: number; // riktpris produkt exkl. moms
  printPerUnit: number; // tryck per styck
  unitInclPrint: number; // à-pris inkl. tryck
  setup: number; // engångs tryckstart
  lineTotal: number; // (à-pris inkl tryck * antal) + tryckstart
  cost?: number; // leverantörens kostnad för raden, när den är känd
};

type LineInput = {
  productId: string;
  qty: number;
  design?: unknown;
  /** Säljarens eget pris (à-pris inkl. tryck + tryckstart) i stället för riktpriset. */
  price?: { unit: number; setup: number };
  cost?: { unit: number; printUnit: number; setup: number };
};

export function priceLine(family: Family, qty: number, design?: LogoDesign): QuoteLine {
  const q = Math.max(1, Math.round(qty));
  const unitProduct = Math.round(fromPrice(family));
  const marking = design ? markingPrice(design, q) : { perUnit: PRINT_PER_UNIT, setup: PRINT_SETUP };
  const printPerUnit = marking.perUnit;
  const unitInclPrint = unitProduct + printPerUnit;
  const setup = marking.setup;
  return {
    productId: family.id,
    name: family.name,
    spec: [family.subcategory, family.material].filter(Boolean).join(" · "),
    qty: q,
    unitProduct,
    printPerUnit,
    unitInclPrint,
    setup,
    lineTotal: unitInclPrint * q + setup,
  };
}

/** Räkna fram alla rader och totalsumma från katalogen (server-sidan litar aldrig på pris från klienten). */
export function priceQuote(input: LineInput[]) {
  const lines: QuoteLine[] = [];
  for (const item of input) {
    const family = familyById(item.productId);
    if (!family) continue;
    const line = priceLine(family, item.qty, sanitizeDesign(family, item.design));
    if (item.price) {
      line.unitInclPrint = Math.max(0, Math.round(item.price.unit));
      line.setup = Math.max(0, Math.round(item.price.setup));
      line.unitProduct = Math.max(0, line.unitInclPrint - line.printPerUnit);
      line.lineTotal = line.unitInclPrint * line.qty + line.setup;
    }
    if (item.cost) line.cost = Math.round((item.cost.unit + item.cost.printUnit) * line.qty + item.cost.setup);
    lines.push(line);
  }
  const total = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  return { lines, total };
}

export const sek = (n: number) =>
  `${Math.round(n).toLocaleString("sv-SE").replace(/\u00a0/g, " ")} kr`;

const LADDER = [25, 50, 100, 250];

/** Four quantity breaks, never below the product MOQ. */
export function qtySteps(family: Family) {
  const moq = Math.min(...family.variants.map((v) => v.moq));
  const steps = LADDER.map((n) => Math.max(moq, n));
  return [...new Set(steps)].slice(0, 4);
}

export function priceMatrix(family: Family, design?: LogoDesign) {
  return qtySteps(family).map((qty) => priceLine(family, qty, design));
}
