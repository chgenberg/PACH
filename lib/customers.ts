import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { familyById } from "@/lib/catalog";
import { type Contact, type CustomerSummary, type QuoteOrigin, type ReorderRequest, requestStatus } from "@/lib/customerTypes";
import { isBrandbookHost, normalizeHost } from "@/lib/host";
import { createReorder } from "@/lib/offers";
import { readSeller } from "@/lib/offerSettings";
import { getQuote, listQuotes } from "@/lib/quotes";
import { type QuoteView, STAGE_LABEL, type StoredQuote } from "@/lib/quoteTypes";

/**
 * The customer register. Customers are derived from the offers – by website, else by company name – and
 * what the offers cannot hold (portal link, contacts, reorder requests, login links) lives in one JSON file.
 */

type Meta = { portalToken: string; contacts: Contact[]; requests: ReorderRequest[] };
type Login = { token: string; key: string; email: string; expires: string };
type Store = { customers: Record<string, Meta>; logins: Login[] };

const FILE = path.join(process.cwd(), ".data", "customers.json");
const TOKEN = /^[0-9a-f]{32}$/;
export const isPortalToken = (v: unknown): v is string => typeof v === "string" && TOKEN.test(v);

const SEED_CONTACTS: Record<string, Contact[]> = {
  "n-bryggeriet-vast": [{ name: "Lisa Ek", email: "lisa@bryggeriet.se", role: "Inköp" }],
  "kustbanken.se": [{ name: "Johan Strand", email: "johan.strand@kustbanken.se", role: "Marknad" }],
  "nordljus.se": [{ name: "Maria Holm", email: "maria@nordljus.se", role: "HR" }],
};

async function readStore(): Promise<Store> {
  return readFile(FILE, "utf8")
    .then((s) => JSON.parse(s) as Store)
    .catch(() => ({ customers: {}, logins: [] }));
}

async function writeStore(s: Store) {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(s, null, 2));
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/é/g, "e");

/** "Spotify AB" and "Spotify" are the same company. */
const normName = (s: string) =>
  fold(s)
    .replace(/\b(ab|aktiebolag|hb|kb)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const slug = (s: string) => `n-${normName(s).replace(/\s+/g, "-").slice(0, 60) || "kund"}`;

const hostOf = (q: StoredQuote) => (q.host && !isBrandbookHost(q.host) ? normalizeHost(q.host) : null);

type Group = { key: string; name: string; host: string | null; quotes: QuoteView[] };

/** Group every offer under its customer: website first, then a company name that matches a website customer. */
async function groups(): Promise<Map<string, Group>> {
  const quotes = await listQuotes();
  const out = new Map<string, Group>();
  const byName = new Map<string, string>();
  for (const q of quotes) {
    const host = hostOf(q);
    if (!host) continue;
    const g = out.get(host) ?? { key: host, name: q.company, host, quotes: [] };
    g.quotes.push(q);
    out.set(host, g);
    for (const n of [q.company, q.brand ?? ""]) if (normName(n)) byName.set(normName(n), host);
  }
  for (const q of quotes) {
    if (hostOf(q)) continue;
    const key = byName.get(normName(q.company)) ?? slug(q.company);
    const g = out.get(key) ?? { key, name: q.company, host: null, quotes: [] };
    g.quotes.push(q);
    out.set(key, g);
  }
  return out;
}

export async function customerKeyOf(q: StoredQuote): Promise<string> {
  const host = hostOf(q);
  if (host) return host;
  for (const g of (await groups()).values()) if (g.quotes.some((x) => x.ref === q.ref)) return g.key;
  return slug(q.company);
}

/** Portal link and contacts exist for every customer; created on first sight. */
async function ensureMeta(keys: string[]): Promise<Store> {
  const store = await readStore();
  let changed = false;
  for (const key of keys) {
    if (store.customers[key]) continue;
    store.customers[key] = { portalToken: randomBytes(16).toString("hex"), contacts: SEED_CONTACTS[key] ?? [], requests: [] };
    changed = true;
  }
  if (changed) await writeStore(store);
  return store;
}

const isOrder = (q: StoredQuote) => q.status === "godkand" || q.status === "fakturerad";
const isShared = (q: StoredQuote) => Boolean(q.share || q.sends?.length);
const linkOf = (q: StoredQuote) => {
  const t = q.sends?.at(-1)?.token ?? q.share?.token;
  return t ? `/o/${t}` : null;
};

/** Contacts the seller added plus everyone an offer was sent to. */
function contactsOf(meta: Meta, g: Group): Contact[] {
  const out = [...meta.contacts];
  for (const q of g.quotes) for (const s of q.sends ?? []) if (!out.some((c) => c.email === s.to.email)) out.push({ name: s.to.name, email: s.to.email, fromSend: true });
  return out;
}

function summarize(g: Group, meta: Meta): CustomerSummary {
  const orders = g.quotes.filter(isOrder);
  const drafts = new Map(g.quotes.map((q) => [q.ref, q]));
  return {
    key: g.key,
    name: g.quotes[0]?.company ?? g.name,
    host: g.host,
    contacts: contactsOf(meta, g),
    quotes: g.quotes.length,
    orders: orders.length,
    ordered: orders.reduce((s, q) => s + q.total, 0),
    open: g.quotes.filter((q) => q.status === "skapad" || q.status === "skickad").length,
    lastAt: [g.quotes[0]?.createdAt ?? "", ...meta.requests.map((r) => r.at)].reduce((a, b) => (b > a ? b : a), ""),
    newRequests: meta.requests.filter((r) => drafts.get(r.draftRef)?.status === "skapad").length,
    portalPath: `/kund/${meta.portalToken}`,
  };
}

export async function listCustomers(): Promise<CustomerSummary[]> {
  const gs = await groups();
  const store = await ensureMeta([...gs.keys()]);
  return [...gs.values()].map((g) => summarize(g, store.customers[g.key])).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

/** Everything about one customer, for the seller. */
export async function getCustomer(key: string) {
  const g = (await groups()).get(key);
  if (!g) return null;
  const store = await ensureMeta([key]);
  const meta = store.customers[key];
  const byRef = new Map(g.quotes.map((q) => [q.ref, q]));
  return {
    ...summarize(g, meta),
    quotesList: g.quotes,
    requests: [...meta.requests].reverse().map((r) => ({ ...r, status: requestStatus(byRef.get(r.draftRef) ?? null), draftStatus: byRef.get(r.draftRef)?.status ?? null })),
  };
}

export type CustomerDetail = NonNullable<Awaited<ReturnType<typeof getCustomer>>>;

export async function portalPathFor(q: StoredQuote): Promise<string> {
  const key = await customerKeyOf(q);
  const store = await ensureMeta([key]);
  return `/kund/${store.customers[key].portalToken}`;
}

async function byPortal(token: string): Promise<{ group: Group; meta: Meta } | null> {
  if (!isPortalToken(token)) return null;
  const store = await readStore();
  const key = Object.keys(store.customers).find((k) => store.customers[k].portalToken === token);
  if (!key) return null;
  const group = (await groups()).get(key);
  return group ? { group, meta: store.customers[key] } : null;
}

const imageOf = (productId: string, image?: string) => (image && /^\//.test(image) ? image : (familyById(productId)?.image ?? null));
const linesOf = (q: QuoteView) =>
  q.priced.map((p) => ({ productId: p.productId, name: p.name, qty: p.qty, spec: p.spec, image: imageOf(p.productId, q.lines.find((l) => l.productId === p.productId)?.image) }));

/** The customer's mini dashboard: only shared offers and real orders – no drafts, no costs, no other customers. */
export async function portalView(token: string) {
  const hit = await byPortal(token);
  if (!hit) return null;
  const { group: g, meta } = hit;
  const seller = await readSeller();
  const byRef = new Map(g.quotes.map((q) => [q.ref, q]));
  const showsPrices = (q: StoredQuote) => q.sends?.at(-1)?.presentation.show.prices ?? true;
  return {
    name: g.quotes[0]?.company ?? g.name,
    host: g.host,
    seller: seller.name ? seller : null,
    open: g.quotes
      .filter((q) => !isOrder(q) && isShared(q))
      .map((q) => ({
        ref: q.ref,
        createdAt: q.createdAt,
        link: linkOf(q),
        total: showsPrices(q) ? q.total : null,
        approved: Object.keys(q.share?.approvals ?? {}).length,
        count: q.lines.length,
        eventDate: q.eventDate ?? null,
        lines: linesOf(q),
      })),
    orders: g.quotes
      .filter(isOrder)
      .map((q) => {
        const delivered = q.order?.history.find((h) => h.stage === "levererad");
        return {
          ref: q.ref,
          createdAt: q.createdAt,
          link: linkOf(q),
          total: q.total,
          stage: q.order ? STAGE_LABEL[q.order.stage] : "Godkänd",
          delivered: q.order?.stage === "levererad",
          deliveredAt: delivered?.at ?? null,
          lines: linesOf(q),
        };
      }),
    requests: [...meta.requests].reverse().map((r) => {
      const draft = byRef.get(r.draftRef) ?? null;
      return {
        id: r.id,
        at: r.at,
        by: r.by.name,
        fromRef: r.fromRef,
        note: r.note ?? null,
        lines: r.lines.map((l) => ({ ...l, name: familyById(l.productId)?.name ?? l.productId })),
        status: requestStatus(draft),
        link: draft && draft.status !== "skapad" ? linkOf(draft) : null,
      };
    }),
  };
}

export type PortalView = NonNullable<Awaited<ReturnType<typeof portalView>>>;

const clean = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

function wantedLines(raw: unknown, from: StoredQuote) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 40)
    .map((l) => ({ productId: String((l as { productId?: unknown })?.productId ?? ""), qty: Math.round(Number((l as { qty?: unknown })?.qty) || 0) }))
    .filter((l) => l.qty >= 1 && l.qty <= 100_000 && from.lines.some((x) => x.productId === l.productId));
}

/** The customer asks for the same again: a request in the register and a draft offer for the seller. */
export async function requestReorder(token: string, input: { fromRef?: unknown; lines?: unknown; name?: unknown; email?: unknown; note?: unknown }) {
  const hit = await byPortal(token);
  if (!hit) return { error: "Länken är inte giltig" };
  const from = hit.group.quotes.find((q) => q.ref === input.fromRef && isOrder(q));
  if (!from) return { error: "Ordern finns inte hos er" };
  const name = clean(input.name, 60);
  const email = clean(input.email, 120).toLowerCase();
  const note = typeof input.note === "string" ? input.note.replace(/[ \t]+/g, " ").trim().slice(0, 800) : "";
  if (!name) return { error: "Skriv ditt namn" };
  if (email && !isEmail(email)) return { error: "E-postadressen ser inte rätt ut" };
  const lines = wantedLines(input.lines, from);
  if (!lines.length) return { error: "Välj minst en produkt och ett antal" };

  const id = randomBytes(5).toString("hex");
  const at = new Date().toISOString();
  const origin: QuoteOrigin = { kind: "reorder", fromRef: from.ref, at, by: "kund", name, requestId: id, ...(note ? { note } : {}) };
  const res = await createReorder((await getQuote(from.ref))!, lines, origin);
  if ("error" in res) return { error: res.error };

  const store = await readStore();
  const key = hit.group.key;
  const meta = store.customers[key];
  meta.requests.push({ id, at, by: { name, ...(email ? { email } : {}) }, fromRef: from.ref, lines, ...(note ? { note } : {}), draftRef: res.quote!.ref });
  if (email && !contactsOf(meta, hit.group).some((c) => c.email === email)) meta.contacts.push({ name, email });
  await writeStore(store);
  return { ok: true };
}

/** "Ny offert från gammal order" in the dashboard. */
export async function sellerReorder(ref: string) {
  const from = await getQuote(ref);
  if (!from) return { error: "Offerten hittades inte" };
  const res = await createReorder(from, from.lines.map((l) => ({ productId: l.productId, qty: l.qty })), { kind: "reorder", fromRef: from.ref, at: new Date().toISOString(), by: "säljare" });
  if ("error" in res) return { error: res.error };
  return { ref: res.quote!.ref };
}

export async function updateContacts(key: string, action: { add?: unknown; remove?: unknown }) {
  const store = await ensureMeta([key]);
  const meta = store.customers[key];
  if (action.add && typeof action.add === "object") {
    const a = action.add as Record<string, unknown>;
    const c: Contact = { name: clean(a.name, 60), email: clean(a.email, 120).toLowerCase(), ...(clean(a.role, 40) ? { role: clean(a.role, 40) } : {}) };
    if (!c.name) return { error: "Skriv kontaktens namn" };
    if (!isEmail(c.email)) return { error: "Skriv en giltig e-postadress" };
    if (meta.contacts.some((x) => x.email === c.email)) return { error: "Kontakten finns redan" };
    if (meta.contacts.length >= 30) return { error: "Max 30 kontakter" };
    meta.contacts.push(c);
  }
  if (typeof action.remove === "string") meta.contacts = meta.contacts.filter((c) => c.email !== action.remove);
  await writeStore(store);
  return { ok: true };
}

/** Magic link: in the demo the link is shown instead of e-mailed. Unknown addresses get the same answer. */
export async function requestLogin(rawEmail: unknown, keyHint?: string) {
  const email = clean(rawEmail, 120).toLowerCase();
  if (!isEmail(email)) return { error: "Skriv en giltig e-postadress" };
  const gs = await groups();
  const store = await ensureMeta([...gs.keys()]);
  const key = (keyHint && gs.has(keyHint) ? [keyHint] : [...gs.keys()]).find((k) => contactsOf(store.customers[k], gs.get(k)!).some((c) => c.email === email));
  if (!key) return { path: null };
  const now = Date.now();
  const token = randomBytes(16).toString("hex");
  store.logins = [...store.logins.filter((l) => new Date(l.expires).getTime() > now).slice(-200), { token, key, email, expires: new Date(now + 30 * 60_000).toISOString() }];
  await writeStore(store);
  return { path: `/kund/in/${token}` };
}

/** One-time: the login link turns into the customer's portal link. */
export async function consumeLogin(token: string): Promise<string | null> {
  if (!isPortalToken(token)) return null;
  const store = await readStore();
  const hit = store.logins.find((l) => l.token === token && new Date(l.expires).getTime() > Date.now());
  if (!hit || !store.customers[hit.key]) return null;
  store.logins = store.logins.filter((l) => l.token !== token);
  await writeStore(store);
  return store.customers[hit.key].portalToken;
}
