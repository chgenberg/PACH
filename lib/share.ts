import { randomBytes } from "node:crypto";
import { cacheKey, cachedUrl } from "@/lib/brandCache";
import { familyById } from "@/lib/catalog";
import { portalPathFor } from "@/lib/customers";
import { estimate } from "@/lib/delivery";
import { normalizeHost } from "@/lib/host";
import { designSummary, placementRows } from "@/lib/marking";
import { readSeller, readTemplates } from "@/lib/offerSettings";
import { DEFAULT_PRESENTATION, type Presentation, sanitizePresentation } from "@/lib/offerTemplates";
import { type OfferSend, sanitizePin } from "@/lib/quoteTypes";
import { getQuote, listQuotes, saveQuote, view, type ShareState, type StoredQuote } from "@/lib/quotes";
import { brandRev } from "@/lib/siteAnalysis";
import { readTerms } from "@/lib/terms";

const TOKEN = /^[0-9a-f]{32}$/;
export const isToken = (v: unknown): v is string => typeof v === "string" && TOKEN.test(v);

const newShare = (): ShareState => ({ token: randomBytes(16).toString("hex"), createdAt: new Date().toISOString(), comments: [], approvals: {} });

export async function ensureShare(ref: string): Promise<ShareState | null> {
  const q = await getQuote(ref);
  if (!q) return null;
  if (q.share) return q.share;
  const share = newShare();
  await saveQuote({ ...q, share });
  return share;
}

/** The quote behind a link – the original review link or one of the seller's sends. */
async function byToken(token: string): Promise<{ quote: StoredQuote; send: OfferSend | null } | null> {
  if (!isToken(token)) return null;
  const all = await listQuotes();
  const hit = all.find((q) => q.share?.token === token || q.sends?.some((s) => s.token === token));
  const quote = hit ? await getQuote(hit.ref) : null;
  if (!quote?.share) return null;
  return { quote, send: quote.sends?.find((s) => s.token === token) ?? null };
}

const SCENES = ["hero", "kickoff", "event", "konferens", "massa", "sommar", "julklapp"];

/** The customer's own branded scene if one has been made on the site; null means a product collage. */
export async function coverFor(host: string | undefined): Promise<string | null> {
  if (!host) return null;
  const h = normalizeHost(host);
  const rev = String(await brandRev(h).catch(() => 0));
  for (const s of SCENES) {
    const hit = await cachedUrl(cacheKey("scene-v3", h, rev, s)).catch(() => null);
    if (hit) return hit;
  }
  return null;
}

/** What the customer's team sees, shaped by the template: hidden prices and details never leave the server. */
export async function publicView(q: StoredQuote, presentation: Presentation = DEFAULT_PRESENTATION) {
  const v = view(q);
  const { show } = presentation;
  const [seller, terms, cover, portal] = await Promise.all([show.contact ? readSeller() : null, readTerms(), show.cover ? coverFor(q.host) : null, portalPathFor(q)]);
  const approvals = q.share?.approvals ?? {};
  return {
    ref: q.ref,
    company: q.company,
    brand: q.brand ?? null,
    createdAt: q.createdAt,
    eventDate: q.eventDate ?? null,
    status: q.status,
    presentation: { layout: presentation.layout, name: presentation.name, intro: presentation.intro, show },
    seller: seller?.name ? seller : null,
    cover,
    portal,
    total: show.prices ? v.total : null,
    totalInclVat: show.prices && show.vat ? Math.round(v.total * (1 + terms.vatPct / 100)) : null,
    terms: show.terms ? terms : null,
    vatPct: terms.vatPct,
    // Only what the customer pays – the seller's cost never leaves the dashboard.
    extras: v.extras.map((e) => ({ id: e.id, label: e.label, amount: show.prices ? e.amount : null })),
    lines: v.priced.map((p, i) => {
      const src = q.lines[i];
      const family = familyById(p.productId);
      const eta = family ? estimate(family, src?.design) : null;
      return {
        productId: p.productId,
        name: p.name,
        spec: p.spec,
        qty: p.qty,
        price: show.prices ? { unit: p.unitInclPrint, setup: p.setup, lineTotal: p.lineTotal } : null,
        image: src?.image && /^(\/|data:image\/)/.test(src.image) ? src.image : (family?.image ?? null),
        design: family && src?.design ? designSummary(family, src.design) : null,
        printRows: show.printSpec && family && src?.design ? placementRows(family, src.design) : [],
        delivery: show.delivery && eta ? eta.date : null,
        deliveryDays: eta?.days ?? 0,
        approval: approvals[p.productId] ?? null,
        proofs: show.proofs ? (src?.proofs ?? []) : [],
      };
    }),
    comments: q.share?.comments ?? [],
    order: q.order ? { stage: q.order.stage, tracking: q.order.tracking ?? null, history: q.order.history } : null,
  };
}

export type PublicQuote = Awaited<ReturnType<typeof publicView>>;
export type PublicLine = PublicQuote["lines"][number];

export async function getShared(token: string) {
  const hit = await byToken(token);
  return hit ? publicView(hit.quote, hit.send?.presentation) : null;
}

/** The link's presentation and the quote, for the customer's PDF. */
export async function sharedQuote(token: string) {
  return byToken(token);
}

const clean = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");

export type SendInput = { presentation?: unknown; to?: { name?: unknown; email?: unknown }; message?: unknown };

/** Simulated e-mail: stores the send with its own link and marks the offer as sent. */
export async function sendOffer(ref: string, input: SendInput): Promise<{ send?: OfferSend; error?: string }> {
  const q = await getQuote(ref);
  if (!q) return { error: "Offerten hittades inte" };
  const name = clean(input.to?.name, 60);
  const email = clean(input.to?.email, 120).toLowerCase();
  if (!name) return { error: "Skriv mottagarens namn" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Skriv en giltig e-postadress" };
  if ((q.sends?.length ?? 0) >= 50) return { error: "Max 50 utskick per offert" };
  const presentation = sanitizePresentation(input.presentation, await readTemplates());
  const message = typeof input.message === "string" ? input.message.replace(/[ \t]+/g, " ").trim().slice(0, 1500) : "";
  const send: OfferSend = {
    id: randomBytes(5).toString("hex"),
    token: randomBytes(16).toString("hex"),
    at: new Date().toISOString(),
    to: { name, email },
    ...(message ? { message } : {}),
    presentation,
  };
  await saveQuote({ ...q, share: q.share ?? newShare(), sends: [...(q.sends ?? []), send], status: q.status === "skapad" ? "skickad" : q.status });
  return { send };
}

export type ShareAction = { action: "approve" | "unapprove" | "comment" | "approveAll"; name?: string; productId?: string; text?: string; pin?: unknown };

export async function applyShareAction(token: string, a: ShareAction): Promise<{ quote?: PublicQuote; error?: string }> {
  const hit = await byToken(token);
  if (!hit) return { error: "Länken är inte giltig" };
  const q = hit.quote;
  const name = clean(a.name, 60);
  if (!name) return { error: "Skriv ditt namn" };
  const productId = a.productId && q.lines.some((l) => l.productId === a.productId) ? a.productId : undefined;
  const share: ShareState = { ...q.share!, comments: [...q.share!.comments], approvals: { ...q.share!.approvals } };
  const now = new Date().toISOString();

  if (a.action === "comment") {
    const text = clean(a.text, 1000);
    if (!text) return { error: "Skriv en kommentar" };
    if (share.comments.length >= 300) return { error: "Tråden är full" };
    const pin = productId ? sanitizePin(a.pin) : undefined;
    share.comments.push({ id: randomBytes(6).toString("hex"), at: now, name, text, productId, ...(pin ? { pin } : {}) });
  } else if (a.action === "approveAll") {
    for (const l of q.lines) share.approvals[l.productId] = { name, at: now };
  } else {
    if (!productId) return { error: "Produkten finns inte i offerten" };
    if (a.action === "approve") share.approvals[productId] = { name, at: now };
    else delete share.approvals[productId];
  }

  const allApproved = q.lines.every((l) => share.approvals[l.productId]);
  let status = q.status;
  if (allApproved && (status === "skapad" || status === "skickad")) status = "godkand";
  if (!allApproved && status === "godkand" && !q.invoice.approved) status = "skickad";
  let order = q.order;
  if (allApproved && !order) {
    order = {
      stage: "korrektur",
      history: [
        { stage: "bekraftad", at: now, note: "Offert godkänd" },
        { stage: "korrektur", at: now, note: `3D-korrektur godkänt av ${name}` },
      ],
    };
  }
  const saved = await saveQuote({ ...q, share, status, order });
  return { quote: await publicView(saved, hit.send?.presentation) };
}
