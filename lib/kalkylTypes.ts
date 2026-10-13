import type { Pricing } from "@/lib/costing";
import type { LogoDesign } from "@/lib/marking";
import type { Proof } from "@/lib/quoteTypes";

/**
 * En kalkyl är en liten offert för en produkt hos en leverantör: antal, färg, tryck, inköp och säljpris.
 * Den sparas för sig och kan läggas i en eller flera offerter.
 */
export type Kalkyl = {
  id: string;
  createdAt: string;
  updatedAt: string;
  title?: string;
  customer?: { company: string; host?: string };
  productId: string;
  qty: number;
  color: string;
  design?: LogoDesign;
  image?: string;
  proofs?: Proof[];
  pricing: Pricing;
  note?: string;
  archived?: boolean;
};

/** What the list shows: no proof images, plus the offers that use the kalkyl. */
export type KalkylSummary = Omit<Kalkyl, "proofs"> & { proofCount: number; usedIn: { ref: string; company: string; status: string }[] };

export type KalkylStatus = "utkast" | "i-offert" | "arkiverad";
export const KALKYL_STATUS_LABEL: Record<KalkylStatus, string> = { utkast: "Utkast", "i-offert": "I offert", arkiverad: "Arkiverad" };
export const kalkylStatus = (k: Pick<KalkylSummary, "archived" | "usedIn">): KalkylStatus => (k.archived ? "arkiverad" : k.usedIn.length ? "i-offert" : "utkast");

export const isKalkylId = (v: unknown): v is string => typeof v === "string" && /^k-[a-z0-9]{6,20}$/.test(v);
