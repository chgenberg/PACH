import { randomBytes } from "node:crypto";
import { familyById } from "@/lib/catalog";
import { getQuote, listQuotes, saveQuote, type CollectState, type StoredQuote } from "@/lib/quotes";

const TOKEN = /^[0-9a-f]{32}$/;
const MAX_ENTRIES = 2000;

const sizesOf = (productId: string) => [...new Set(familyById(productId)?.variants.map((v) => v.size) ?? [])].filter((s) => s !== "ONE_SIZE");

export async function ensureCollect(ref: string): Promise<CollectState | null> {
  const q = await getQuote(ref);
  if (!q) return null;
  if (q.collect) return q.collect;
  const collect: CollectState = { token: randomBytes(16).toString("hex"), createdAt: new Date().toISOString(), entries: [] };
  await saveQuote({ ...q, collect });
  return collect;
}

async function byToken(token: string): Promise<StoredQuote | null> {
  if (!TOKEN.test(token)) return null;
  const hit = (await listQuotes()).find((q) => q.collect?.token === token);
  return hit ? await getQuote(hit.ref) : null;
}

/** Size totals per product, for the dashboard and the purchase orders. */
export function sizeTotals(q: StoredQuote) {
  return q.lines
    .filter((l) => sizesOf(l.productId).length > 1)
    .map((l) => {
      const counts: Record<string, number> = Object.fromEntries(sizesOf(l.productId).map((s) => [s, 0]));
      for (const e of q.collect?.entries ?? []) if (e.sizes[l.productId] in counts) counts[e.sizes[l.productId]] += 1;
      return { productId: l.productId, name: familyById(l.productId)?.name ?? l.productId, qty: l.qty, counts };
    });
}

/** What an employee sees: products to pick a size for. No other people's names. */
function publicCollect(q: StoredQuote) {
  return {
    company: q.company,
    brand: q.brand ?? null,
    closed: Boolean(q.collect?.closed),
    answers: q.collect?.entries.length ?? 0,
    namePrint: q.lines.some((l) => l.design?.names),
    products: q.lines
      .filter((l) => sizesOf(l.productId).length > 1)
      .map((l) => {
        const f = familyById(l.productId)!;
        return { productId: l.productId, name: f.name, image: l.image && /^(\/|data:image\/)/.test(l.image) ? l.image : f.image, sizes: sizesOf(l.productId) };
      }),
  };
}

export type PublicCollect = ReturnType<typeof publicCollect>;

export async function getCollect(token: string) {
  const q = await byToken(token);
  return q?.collect ? publicCollect(q) : null;
}

const clean = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");

export async function addCollectEntry(token: string, body: { name?: string; sizes?: Record<string, string>; print?: string }): Promise<{ ok?: true; error?: string }> {
  const q = await byToken(token);
  if (!q?.collect) return { error: "Länken är inte giltig" };
  if (q.collect.closed) return { error: "Insamlingen är stängd" };
  const name = clean(body.name, 60);
  if (!name) return { error: "Skriv ditt namn" };
  const view = publicCollect(q);
  const sizes: Record<string, string> = {};
  for (const p of view.products) {
    const s = body.sizes?.[p.productId];
    if (s && p.sizes.includes(s)) sizes[p.productId] = s;
  }
  if (!Object.keys(sizes).length) return { error: "Välj minst en storlek" };
  const print = view.namePrint ? clean(body.print, 30) || undefined : undefined;

  const entries = [...q.collect.entries];
  // Same name again replaces the earlier answer, so people can correct themselves.
  const i = entries.findIndex((e) => e.name.toLowerCase() === name.toLowerCase());
  const entry = { id: i >= 0 ? entries[i].id : randomBytes(6).toString("hex"), at: new Date().toISOString(), name, sizes, print };
  if (i >= 0) entries[i] = entry;
  else if (entries.length >= MAX_ENTRIES) return { error: "Insamlingen är full" };
  else entries.push(entry);
  await saveQuote({ ...q, collect: { ...q.collect, entries } });
  return { ok: true };
}
