/** The customer register – client-safe types shared by the dashboard and the customer portal. */

/** `fromSend` contacts come from the offers' recipients and cannot be removed from the register. */
export type Contact = { name: string; email: string; role?: string; fromSend?: boolean };

/** "Beställ igen" from the portal: becomes an offer draft for the seller. */
export type ReorderRequest = {
  id: string;
  at: string;
  by: { name: string; email?: string };
  fromRef: string;
  lines: { productId: string; qty: number }[];
  note?: string;
  draftRef: string;
};

export type CustomerSummary = {
  key: string;
  name: string;
  host: string | null;
  contacts: Contact[];
  quotes: number;
  orders: number;
  ordered: number;
  open: number;
  lastAt: string;
  newRequests: number;
  portalPath: string;
};

export const isCustomerKey = (v: unknown): v is string => typeof v === "string" && /^[a-z0-9][a-z0-9.-]{1,119}$/.test(v);

/** Where an offer came from, when it was not composed from scratch. */
export type QuoteOrigin = { kind: "reorder"; fromRef: string; at: string; by: "kund" | "säljare"; name?: string; note?: string; requestId?: string };

export const requestStatus = (draft: { status: string } | null) =>
  !draft ? "Hanteras" : draft.status === "skapad" ? "Säljaren tar fram en offert" : draft.status === "skickad" ? "Offert skickad" : "Beställd";
