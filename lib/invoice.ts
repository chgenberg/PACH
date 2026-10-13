import type { QuoteLine } from "@/lib/pricing";
import type { ExtraLine } from "@/lib/quoteTypes";

/** Samma modell som Billboard Bees fakturaunderlag: Kost i % per rad, TB = belopp − kost. */
export const DEFAULT_KOST_PCT = 60;
export const VAT_RATE = 0.25;
export const PAYMENT_DAYS = 30;

/** `extra` marks freight, express and other free lines – their cost is set on the offer, not as a percentage. */
export type InvoiceLine = QuoteLine & { kostPct: number; cost: number; tb: number; extra?: boolean };

export type InvoiceBasis = {
  lines: InvoiceLine[];
  net: number;
  vat: number;
  gross: number;
  cost: number;
  tb: number;
  tbPct: number;
  dueDate: string | null;
  status: "Väntar" | "Godkänd" | "Fakturerad";
};

type Invoiceable = {
  priced: QuoteLine[];
  extras?: ExtraLine[];
  invoice: { approved: boolean; invoiceNumber?: string; invoicedAt?: string; kost: Record<string, number> };
};

const pctOf = (cost: number, total: number) => (total ? Math.round((cost / total) * 100) : 0);

export function invoiceBasis(q: Invoiceable): InvoiceBasis {
  const lines: InvoiceLine[] = q.priced.map((l) => {
    // A percentage typed in on the invoice wins; otherwise the supplier cost saved with the offer, else the default.
    const manual = q.invoice.kost[l.productId];
    const cost = manual !== undefined ? Math.round((l.lineTotal * manual) / 100) : l.cost ?? Math.round((l.lineTotal * DEFAULT_KOST_PCT) / 100);
    return { ...l, kostPct: manual ?? pctOf(cost, l.lineTotal), cost, tb: l.lineTotal - cost };
  });
  for (const e of q.extras ?? []) {
    lines.push({
      productId: `extra:${e.id}`,
      name: e.label,
      spec: "Extra post",
      qty: 1,
      unitProduct: e.amount,
      printPerUnit: 0,
      unitInclPrint: e.amount,
      setup: 0,
      lineTotal: e.amount,
      cost: e.cost,
      kostPct: pctOf(e.cost, e.amount),
      tb: e.amount - e.cost,
      extra: true,
    });
  }
  const net = lines.reduce((s, l) => s + l.lineTotal, 0);
  const cost = lines.reduce((s, l) => s + l.cost, 0);
  const vat = Math.round(net * VAT_RATE);
  const due = q.invoice.invoicedAt ? new Date(new Date(q.invoice.invoicedAt).getTime() + PAYMENT_DAYS * 86_400_000).toISOString() : null;
  return {
    lines,
    net,
    vat,
    gross: net + vat,
    cost,
    tb: net - cost,
    tbPct: net ? Math.round(((net - cost) / net) * 100) : 0,
    dueDate: due,
    status: q.invoice.invoiceNumber ? "Fakturerad" : q.invoice.approved ? "Godkänd" : "Väntar",
  };
}
