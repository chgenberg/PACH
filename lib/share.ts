import { randomBytes } from "node:crypto";
import { familyById } from "@/lib/catalog";
import { estimate } from "@/lib/delivery";
import { designSummary } from "@/lib/marking";
import { getQuote, listQuotes, saveQuote, view, type ShareState, type StoredQuote } from "@/lib/quotes";

const TOKEN = /^[0-9a-f]{32}$/;
export const isToken = (v: unknown): v is string => typeof v === "string" && TOKEN.test(v);

export async function ensureShare(ref: string): Promise<ShareState | null> {
  const q = await getQuote(ref);
  if (!q) return null;
  if (q.share) return q.share;
  const share: ShareState = { token: randomBytes(16).toString("hex"), createdAt: new Date().toISOString(), comments: [], approvals: {} };
  await saveQuote({ ...q, share });
  return share;
}

async function byToken(token: string): Promise<StoredQuote | null> {
  if (!isToken(token)) return null;
  const all = await listQuotes();
  const hit = all.find((q) => q.share?.token === token);
  return hit ? await getQuote(hit.ref) : null;
}

/** What the customer's team sees: no phone number, no internal invoice state. */
export function publicView(q: StoredQuote) {
  const v = view(q);
  const share = q.share!;
  return {
    ref: q.ref,
    company: q.company,
    brand: q.brand ?? null,
    createdAt: q.createdAt,
    eventDate: q.eventDate ?? null,
    status: q.status,
    total: v.total,
    lines: v.priced.map((p, i) => {
      const src = q.lines[i];
      const family = familyById(p.productId);
      return {
        ...p,
        image: src?.image && /^(\/|data:image\/)/.test(src.image) ? src.image : (family?.image ?? null),
        design: family && src?.design ? designSummary(family, src.design) : null,
        delivery: family ? estimate(family, src?.design).date : null,
        approval: share.approvals[p.productId] ?? null,
      };
    }),
    comments: share.comments,
    order: q.order ? { stage: q.order.stage, tracking: q.order.tracking ?? null, history: q.order.history } : null,
  };
}

export type PublicQuote = ReturnType<typeof publicView>;

export async function getShared(token: string) {
  const q = await byToken(token);
  return q?.share ? publicView(q) : null;
}

const clean = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");

export type ShareAction = { action: "approve" | "unapprove" | "comment"; name?: string; productId?: string; text?: string };

export async function applyShareAction(token: string, a: ShareAction): Promise<{ quote?: PublicQuote; error?: string }> {
  const q = await byToken(token);
  if (!q?.share) return { error: "Länken är inte giltig" };
  const name = clean(a.name, 60);
  if (!name) return { error: "Skriv ditt namn" };
  const productId = a.productId && q.lines.some((l) => l.productId === a.productId) ? a.productId : undefined;
  const share: ShareState = { ...q.share, comments: [...q.share.comments], approvals: { ...q.share.approvals } };
  const now = new Date().toISOString();

  if (a.action === "comment") {
    const text = clean(a.text, 1000);
    if (!text) return { error: "Skriv en kommentar" };
    if (share.comments.length >= 300) return { error: "Tråden är full" };
    share.comments.push({ id: randomBytes(6).toString("hex"), at: now, name, text, productId });
  } else {
    if (!productId) return { error: "Produkten finns inte i offerten" };
    if (a.action === "approve") share.approvals[productId] = { name, at: now };
    else delete share.approvals[productId];
  }

  const allApproved = q.lines.every((l) => share.approvals[l.productId]);
  let status = q.status;
  if (allApproved && (status === "skapad" || status === "skickad")) status = "godkand";
  if (!allApproved && status === "godkand" && !q.invoice.approved) status = "skickad";
  const saved = await saveQuote({ ...q, share, status });
  return { quote: publicView(saved) };
}
