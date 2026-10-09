import type { LogoDesign } from "@/lib/marking";
import type { QuoteLine } from "@/lib/pricing";

export const QUOTE_STATUSES = ["skapad", "skickad", "godkand", "fakturerad"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export type StoredLine = { productId: string; qty: number; image?: string; color?: string; design?: LogoDesign };

export type InvoiceState = {
  /** Z-godkänd: underlaget är kontrollerat och får faktureras. */
  approved: boolean;
  invoiceNumber?: string;
  invoicedAt?: string;
  /** Kost i procent av radbeloppet, per produkt. */
  kost: Record<string, number>;
};

export type ShareComment = { id: string; at: string; name: string; text: string; productId?: string };

/** Delbar länk där kundens team kommenterar och godkänner rad för rad. */
export type ShareState = {
  token: string;
  createdAt: string;
  comments: ShareComment[];
  approvals: Record<string, { name: string; at: string }>;
};

export type StoredQuote = {
  ref: string;
  createdAt: string;
  company: string;
  phone: string;
  host?: string;
  brand?: string;
  /** När kunden behöver produkterna (ISO-datum). */
  eventDate?: string;
  status: QuoteStatus;
  lines: StoredLine[];
  invoice: InvoiceState;
  share?: ShareState;
  demo?: boolean;
};

export type QuoteView = StoredQuote & { priced: QuoteLine[]; total: number };
