import type { QuoteLine } from "@/lib/pricing";

/** Samma modell som Billboard Bees fakturaunderlag: Kost i % per rad, TB = belopp − kost. */
export const DEFAULT_KOST_PCT = 60;
export const VAT_RATE = 0.25;
export const PAYMENT_DAYS = 30;

export type InvoiceLine = QuoteLine & { kostPct: number; cost: number; tb: number };

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
  invoice: { approved: boolean; invoiceNumber?: string; invoicedAt?: string; kost: Record<string, number> };
};

export function invoiceBasis(q: Invoiceable): InvoiceBasis {
  const lines = q.priced.map((l) => {
    const kostPct = q.invoice.kost[l.productId] ?? DEFAULT_KOST_PCT;
    const cost = Math.round((l.lineTotal * kostPct) / 100);
    return { ...l, kostPct, cost, tb: l.lineTotal - cost };
  });
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
