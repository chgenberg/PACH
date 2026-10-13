import { familyById } from "@/lib/catalog";
import { BASE_COLOR, isHex } from "@/lib/colors";
import { economics } from "@/lib/costing";
import { costTable } from "@/lib/costs";
import type { QuoteOrigin } from "@/lib/customerTypes";
import { getKalkyler, sanitizePricing } from "@/lib/kalkyler";
import { sanitizeDesign } from "@/lib/marking";
import { createQuote, getQuote, isRef, saveQuote, view } from "@/lib/quotes";
import { isEditable, sanitizeExtras, sanitizeProofs, type StoredLine, type StoredQuote } from "@/lib/quoteTypes";

/** One row from the offer builder. Images and proofs are taken from the kalkyl or the saved offer, never resent. */
export type OfferLineInput = { kalkylId?: string; productId: string; qty: number; color?: string; design?: unknown; pricing?: unknown };
export type OfferInput = {
  company?: string;
  phone?: string;
  host?: string;
  brand?: string;
  eventDate?: string;
  lines?: OfferLineInput[];
  extras?: unknown;
};

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

async function buildLines(input: OfferLineInput[], existing: StoredLine[]): Promise<StoredLine[] | { error: string }> {
  if (!input.length) return { error: "Lägg till minst en kalkyl." };
  const seen = new Set<string>();
  const [table, kalkyler] = await Promise.all([costTable(), getKalkyler(input.map((l) => l.kalkylId).filter((v): v is string => typeof v === "string"))]);
  const out: StoredLine[] = [];
  for (const l of input.slice(0, 40)) {
    const f = familyById(l.productId);
    if (!f) return { error: "En produkt finns inte längre i sortimentet." };
    if (seen.has(f.id)) return { error: `${f.name} finns redan i offerten – ändra antalet på raden i stället.` };
    seen.add(f.id);
    const qty = Math.round(Math.min(100_000, Math.max(1, Number(l.qty) || 0)));
    const design = sanitizeDesign(f, l.design);
    const pricing = sanitizePricing(l.pricing);
    const e = economics(f, qty, design, table, pricing);
    const k = kalkyler.find((x) => x.id === l.kalkylId);
    const prev = existing.find((x) => x.productId === f.id);
    out.push({
      productId: f.id,
      qty: e.qty,
      color: isHex(l.color) ? l.color.toUpperCase() : (prev?.color ?? k?.color ?? BASE_COLOR),
      design,
      image: k?.image ?? prev?.image,
      proofs: sanitizeProofs(k?.proofs ?? prev?.proofs),
      ...(k ? { kalkylId: k.id } : prev?.kalkylId ? { kalkylId: prev.kalkylId } : {}),
      pricing: { mode: pricing.mode, markupPct: pricing.markupPct },
      ...(pricing.mode === "list" ? {} : { price: { unit: e.sale.unit, setup: e.sale.setup } }),
      cost: { unit: e.cost.unit, printUnit: e.cost.printUnit, setup: e.cost.setup },
    });
  }
  return out;
}

export async function createOffer(input: OfferInput) {
  const company = text(input.company, 80);
  if (!company) return { error: "Fyll i kundens företagsnamn." };
  const lines = await buildLines(input.lines ?? [], []);
  if ("error" in lines) return lines;
  const eventDate = typeof input.eventDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.eventDate) ? input.eventDate : undefined;
  const q = await createQuote({
    company,
    phone: text(input.phone, 40),
    host: text(input.host, 120) || undefined,
    brand: text(input.brand, 80) || company,
    eventDate,
    lines,
    extras: sanitizeExtras(input.extras),
  });
  return { quote: view(q) };
}

/**
 * A draft offer from an earlier order: same products, colours, designs and proofs, new quantities.
 * Prices are recalculated for the new quantity with the line's price mode; a fixed price is kept as it was.
 */
export async function createReorder(from: StoredQuote, wanted: { productId: string; qty: number }[], origin: QuoteOrigin) {
  const rows: OfferLineInput[] = wanted.flatMap((w) => {
    const prev = from.lines.find((l) => l.productId === w.productId);
    if (!prev) return [];
    const pricing = prev.pricing?.mode === "fixed" && prev.price ? { ...prev.pricing, unit: prev.price.unit, setup: prev.price.setup } : prev.pricing;
    return [{ productId: prev.productId, qty: w.qty, color: prev.color, design: prev.design, pricing, ...(prev.kalkylId ? { kalkylId: prev.kalkylId } : {}) }];
  });
  if (!rows.length) return { error: "Välj minst en produkt." };
  const lines = await buildLines(rows, from.lines);
  if ("error" in lines) return lines;
  const q = await createQuote({
    company: from.company,
    phone: from.phone,
    host: from.host,
    brand: from.brand,
    lines,
    origin,
  });
  return { quote: q };
}

/** Replace the composition of an offer that is not yet approved; approvals for changed lines are withdrawn. */
export async function updateOffer(ref: string, input: OfferInput) {
  const q = isRef(ref) ? await getQuote(ref) : null;
  if (!q) return { error: "Offerten hittades inte." };
  if (!isEditable(q)) return { error: "Offerten är godkänd och kan inte ändras – lägg en ny offert via Beställ igen." };
  const lines = await buildLines(input.lines ?? [], q.lines);
  if ("error" in lines) return lines;
  const before = new Map(q.lines.map((l) => [l.productId, JSON.stringify([l.qty, l.price, l.design, l.color])]));
  const share = q.share
    ? {
        ...q.share,
        approvals: Object.fromEntries(
          Object.entries(q.share.approvals).filter(([pid]) => {
            const now = lines.find((l) => l.productId === pid);
            return now && before.get(pid) === JSON.stringify([now.qty, now.price, now.design, now.color]);
          }),
        ),
      }
    : undefined;
  const company = text(input.company, 80) || q.company;
  const eventDate = input.eventDate === "" ? undefined : typeof input.eventDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.eventDate) ? input.eventDate : q.eventDate;
  const next: StoredQuote = {
    ...q,
    company,
    phone: input.phone === undefined ? q.phone : text(input.phone, 40),
    host: input.host === undefined ? q.host : text(input.host, 120) || undefined,
    eventDate,
    lines,
    extras: input.extras === undefined ? q.extras : sanitizeExtras(input.extras),
    ...(share ? { share } : {}),
  };
  return { quote: view(await saveQuote(next)) };
}
