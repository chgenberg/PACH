import type { PriceMode } from "@/lib/costing";
import type { QuoteOrigin } from "@/lib/customerTypes";
import type { LogoDesign } from "@/lib/marking";
import type { Presentation } from "@/lib/offerTemplates";
import type { QuoteLine } from "@/lib/pricing";

export const QUOTE_STATUSES = ["skapad", "skickad", "godkand", "fakturerad"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export type Proof = { label: string; image: string };
export type StoredLine = {
  productId: string;
  qty: number;
  image?: string;
  color?: string;
  design?: LogoDesign;
  proofs?: Proof[];
  /** The kalkyl the line was built from, when the seller composed the offer in the dashboard. */
  kalkylId?: string;
  pricing?: { mode: PriceMode; markupPct: number };
  /** Price to the customer when it differs from the list price: per unit incl. print, and setup. */
  price?: { unit: number; setup: number };
  /** Supplier cost at the time the offer was saved. */
  cost?: { unit: number; printUnit: number; setup: number };
};

/** Free lines on an offer – freight, express, design work – with their own cost. */
export type ExtraLine = { id: string; label: string; amount: number; cost: number };

export function sanitizeExtras(raw: unknown): ExtraLine[] {
  if (!Array.isArray(raw)) return [];
  const n = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.round(Math.min(max, Math.max(-max, v))) : 0);
  return raw
    .slice(0, 20)
    .filter((e): e is Record<string, unknown> => Boolean(e) && typeof e === "object")
    .map((e, i) => ({
      id: typeof e.id === "string" && /^[a-z0-9-]{1,40}$/i.test(e.id) ? e.id : `x${Date.now().toString(36)}${i}`,
      label: typeof e.label === "string" ? e.label.replace(/\s+/g, " ").trim().slice(0, 80) : "",
      amount: n(e.amount, 10_000_000),
      cost: Math.max(0, n(e.cost, 10_000_000)),
    }))
    .filter((e) => e.label);
}

/** Keep only small JPEG/PNG data URLs with a short label – the proofs come straight from the browser. */
export function sanitizeProofs(raw: unknown): Proof[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const list = raw
    .slice(0, 5)
    .filter((p): p is Proof => Boolean(p) && typeof p.label === "string" && typeof p.image === "string")
    .filter((p) => /^data:image\/(jpeg|png);base64,/.test(p.image) && p.image.length < 1_500_000)
    .map((p) => ({ label: p.label.replace(/\s+/g, " ").trim().slice(0, 60), image: p.image }));
  return list.length ? list : undefined;
}

export type InvoiceState = {
  /** Z-godkänd: underlaget är kontrollerat och får faktureras. */
  approved: boolean;
  invoiceNumber?: string;
  invoicedAt?: string;
  /** Kost i procent av radbeloppet, per produkt. */
  kost: Record<string, number>;
};

/** A point on one of the line's proof images, in 0–1 coordinates. */
export type ProofPin = { proof: number; x: number; y: number };
export type ShareComment = { id: string; at: string; name: string; text: string; productId?: string; pin?: ProofPin };

export function sanitizePin(raw: unknown): ProofPin | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const { proof, x, y } = raw as Record<string, unknown>;
  if (![proof, x, y].every((n) => typeof n === "number" && Number.isFinite(n))) return undefined;
  const unit = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 1000) / 1000;
  return { proof: Math.min(4, Math.max(0, Math.round(proof as number))), x: unit(x as number), y: unit(y as number) };
}

/** Delbar länk där kundens team kommenterar och godkänner rad för rad. */
export type ShareState = {
  token: string;
  createdAt: string;
  comments: ShareComment[];
  approvals: Record<string, { name: string; at: string }>;
};

/** One employee's answer on the size-collection link. */
export type CollectEntry = { id: string; at: string; name: string; sizes: Record<string, string>; print?: string };
export type CollectState = { token: string; createdAt: string; entries: CollectEntry[]; closed?: boolean };

export const ORDER_STAGES = ["bekraftad", "korrektur", "i-tryck", "kontroll", "skickad", "levererad"] as const;
export type OrderStage = (typeof ORDER_STAGES)[number];
export const STAGE_LABEL: Record<OrderStage, string> = {
  bekraftad: "Order bekräftad",
  korrektur: "Korrektur godkänd",
  "i-tryck": "I tryck",
  kontroll: "Kvalitetskontroll",
  skickad: "Skickad",
  levererad: "Levererad",
};
export type OrderEvent = { stage: OrderStage; at: string; note?: string; photo?: string };
export type OrderState = { stage: OrderStage; history: OrderEvent[]; tracking?: string };

/** One send of the offer: its own link, template and toggles. Approvals and comments are shared by all sends. */
export type OfferSend = {
  id: string;
  token: string;
  at: string;
  to: { name: string; email: string };
  message?: string;
  presentation: Presentation;
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
  extras?: ExtraLine[];
  invoice: InvoiceState;
  share?: ShareState;
  sends?: OfferSend[];
  origin?: QuoteOrigin;
  collect?: CollectState;
  order?: OrderState;
  demo?: boolean;
};

export type QuoteView = StoredQuote & { priced: QuoteLine[]; extras: ExtraLine[]; linesTotal: number; total: number };

/** Offers the seller may still change; approved orders are locked so purchase orders stay true. */
export const isEditable = (q: Pick<StoredQuote, "status">) => q.status === "skapad" || q.status === "skickad";
