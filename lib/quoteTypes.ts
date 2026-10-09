import type { QuoteLine } from "@/lib/pricing";

export const QUOTE_STATUSES = ["skapad", "skickad", "godkand", "fakturerad"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export type StoredLine = { productId: string; qty: number; image?: string; color?: string };

export type InvoiceState = {
  /** Z-godkänd: underlaget är kontrollerat och får faktureras. */
  approved: boolean;
  invoiceNumber?: string;
  invoicedAt?: string;
  /** Kost i procent av radbeloppet, per produkt. */
  kost: Record<string, number>;
};

export type StoredQuote = {
  ref: string;
  createdAt: string;
  company: string;
  phone: string;
  host?: string;
  brand?: string;
  status: QuoteStatus;
  lines: StoredLine[];
  invoice: InvoiceState;
  demo?: boolean;
};

export type QuoteView = StoredQuote & { priced: QuoteLine[]; total: number };
