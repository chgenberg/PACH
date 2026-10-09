import { randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { cacheKey, cachedUrl } from "@/lib/brandCache";
import { familyById } from "@/lib/catalog";
import { colorName } from "@/lib/colors";
import { defaultDesign, designSummary, type LogoDesign } from "@/lib/marking";
import { priceLine } from "@/lib/pricing";
import { createQuote, getQuote, type CollectEntry } from "@/lib/quotes";
import { brandRev } from "@/lib/siteAnalysis";

/**
 * Company stores (employees order within a budget) and gift campaigns (each recipient picks a gift and gives an address).
 * Both are built from an existing quote, so products, colours and print are already decided. Demo storage: JSON on disk.
 */

export type CampaignProduct = { productId: string; image?: string; color?: string; design?: LogoDesign; unit: number };
export type StoreOrder = { id: string; at: string; name: string; email: string; items: { productId: string; size: string; qty: number }[]; total: number };
export type Address = { name: string; street: string; zip: string; city: string; phone?: string };
export type Recipient = { id: string; name: string; email?: string; choice?: { productId: string; size: string }; address?: Address; at?: string };
export type Campaign = {
  token: string;
  /** Secret for the employer's own order overview (stores created on the site). */
  adminKey?: string;
  host?: string;
  kind: "store" | "gift";
  createdAt: string;
  ref?: string;
  company: string;
  brand: string;
  title: string;
  budget?: number;
  closesAt?: string;
  products: CampaignProduct[];
  orders: StoreOrder[];
  recipients: Recipient[];
};

const DIR = path.join(process.cwd(), ".data", "campaigns");
const TOKEN = /^[0-9a-f]{20}$/;
const file = (t: string) => path.join(DIR, `${t}.json`);
const id = () => randomBytes(6).toString("hex");
const clean = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Price per item in a staff store: catalogue price incl. print at a typical store volume. */
const STORE_QTY = 50;

export const sizesOf = (productId: string) => [...new Set(familyById(productId)?.variants.map((v) => v.size) ?? [])];

async function save(c: Campaign) {
  await mkdir(DIR, { recursive: true });
  await writeFile(file(c.token), JSON.stringify(c, null, 2));
  return c;
}

export async function getCampaign(token: string): Promise<Campaign | null> {
  if (!TOKEN.test(token)) return null;
  return readFile(file(token), "utf8")
    .then((s) => JSON.parse(s) as Campaign)
    .catch(() => null);
}

export async function listCampaigns(): Promise<Campaign[]> {
  const names = await readdir(DIR).catch(() => [] as string[]);
  const all = await Promise.all(names.filter((n) => n.endsWith(".json")).map((n) => readFile(path.join(DIR, n), "utf8").then((s) => JSON.parse(s) as Campaign).catch(() => null)));
  return all.filter((c): c is Campaign => c !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** "Anna Berg; anna@x.se" or "Anna Berg, anna@x.se" per line. */
function parseRecipients(text: string): Recipient[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(/[;,\t]/).map((p) => p.trim()))
    .filter(([name]) => name)
    .slice(0, 2000)
    .map(([name, email]) => ({ id: id(), name: name.slice(0, 60), email: email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email.slice(0, 120) : undefined }));
}

export async function createCampaign(input: { ref?: string; kind?: string; title?: string; budget?: number; recipients?: string; productIds?: string[] }): Promise<Campaign | { error: string }> {
  const q = input.ref ? await getQuote(input.ref) : null;
  if (!q) return { error: "Välj en offert att utgå från" };
  const kind = input.kind === "gift" ? "gift" : "store";
  const lines = q.lines.filter((l) => familyById(l.productId) && (!input.productIds?.length || input.productIds.includes(l.productId)));
  if (!lines.length) return { error: "Offerten har inga produkter" };
  const recipients = kind === "gift" ? parseRecipients(input.recipients ?? "") : [];
  if (kind === "gift" && !recipients.length) return { error: "Lägg till minst en mottagare" };
  const budget = kind === "store" ? Math.max(0, Math.round(Number(input.budget) || 0)) || undefined : undefined;
  const rev = q.host ? String(await brandRev(q.host)) : "";
  const branded = async (productId: string) => (q.host ? await cachedUrl(cacheKey("product-v3", q.host, rev, productId)) : null);
  const picked = lines.slice(0, kind === "gift" ? 4 : 24);
  const images = await Promise.all(picked.map(async (l) => (l.image && /^(\/|data:image\/)/.test(l.image) ? l.image : ((await branded(l.productId)) ?? undefined))));

  return save({
    token: randomBytes(10).toString("hex"),
    kind,
    createdAt: new Date().toISOString(),
    ref: q.ref,
    company: q.company,
    brand: q.brand || q.company,
    title: clean(input.title, 80) || (kind === "gift" ? `En gåva från ${q.brand || q.company}` : `${q.brand || q.company} Store`),
    budget,
    products: picked.map((l, i) => ({
      productId: l.productId,
      image: images[i],
      color: l.color,
      design: l.design,
      unit: priceLine(familyById(l.productId)!, l.qty, l.design).unitInclPrint,
    })),
    orders: [],
    recipients,
  });
}

/** A staff store put together by the employer on the site: their own assortment, colours and budget. */
export async function createStoreDirect(input: {
  host?: string;
  brand?: string;
  title?: string;
  budget?: number;
  products?: { productId: string; color?: string; image?: string }[];
}): Promise<Campaign | { error: string }> {
  const brand = clean(input.brand, 60);
  if (!brand) return { error: "Ange företagets namn" };
  const picked = (input.products ?? [])
    .filter((p, i, a) => familyById(p.productId) && a.findIndex((x) => x.productId === p.productId) === i)
    .slice(0, 30);
  if (picked.length < 2) return { error: "Välj minst två produkter till sortimentet" };
  const budget = Math.round(Number(input.budget) || 0);
  if (budget < 200 || budget > 50_000) return { error: "Sätt en budget mellan 200 och 50 000 kr" };
  const host = typeof input.host === "string" && /^[\w.-]+$/.test(input.host) ? input.host.slice(0, 120) : undefined;

  return save({
    token: randomBytes(10).toString("hex"),
    adminKey: randomBytes(16).toString("hex"),
    kind: "store",
    createdAt: new Date().toISOString(),
    host,
    company: brand,
    brand,
    title: clean(input.title, 80) || `${brand} Store`,
    budget,
    products: picked.map((p) => {
      const f = familyById(p.productId)!;
      const design = defaultDesign(f);
      return {
        productId: p.productId,
        image: typeof p.image === "string" && /^\/(api\/img\/[0-9a-f]{24}|merch\/[\w.-]+)$/.test(p.image) ? p.image : undefined,
        color: typeof p.color === "string" && /^#[0-9a-f]{6}$/i.test(p.color) ? p.color.toUpperCase() : undefined,
        design,
        unit: priceLine(f, STORE_QTY, design).unitInclPrint,
      };
    }),
    orders: [],
    recipients: [],
  });
}

export async function getStoreByAdminKey(key: string): Promise<Campaign | null> {
  if (!/^[0-9a-f]{32}$/.test(key)) return null;
  return (await listCampaigns()).find((c) => c.adminKey === key) ?? null;
}

/** Totals per product and size – what the employer orders in the end. */
export function storeTotals(c: Campaign) {
  const out = new Map<string, Map<string, number>>();
  for (const o of c.orders)
    for (const i of o.items) {
      const m = out.get(i.productId) ?? new Map<string, number>();
      m.set(i.size, (m.get(i.size) ?? 0) + i.qty);
      out.set(i.productId, m);
    }
  return [...out.entries()].map(([productId, sizes]) => ({
    productId,
    name: familyById(productId)?.name ?? productId,
    total: [...sizes.values()].reduce((a, b) => a + b, 0),
    sizes: Object.fromEntries(sizes),
  }));
}

/** The employer closes the store and sends everything to PACH as one quote, with each person's sizes. */
export async function storeToQuote(c: Campaign, contact: { phone?: string }): Promise<{ ref?: string; error?: string }> {
  if (c.kind !== "store") return { error: "Inte en butik" };
  if (c.ref) return { ref: c.ref };
  if (!c.orders.length) return { error: "Inga beställningar än" };
  const qty = new Map<string, number>();
  for (const o of c.orders) for (const i of o.items) qty.set(i.productId, (qty.get(i.productId) ?? 0) + i.qty);
  const entries: CollectEntry[] = [];
  for (const o of c.orders) {
    const units = Math.max(...o.items.map((i) => i.qty));
    for (let n = 0; n < units; n++) {
      const sizes: Record<string, string> = {};
      for (const i of o.items) if (n < i.qty && i.size !== "One size") sizes[i.productId] = i.size;
      if (Object.keys(sizes).length) entries.push({ id: id(), at: o.at, name: n ? `${o.name} (${n + 1})` : o.name, sizes });
    }
  }
  const q = await createQuote({
    company: c.company,
    phone: clean(contact.phone, 30),
    brand: c.brand,
    host: c.host,
    lines: c.products
      .filter((p) => qty.has(p.productId))
      .map((p) => ({ productId: p.productId, qty: qty.get(p.productId)!, image: p.image, color: p.color, design: p.design })),
    collect: { token: randomBytes(16).toString("hex"), createdAt: new Date().toISOString(), entries, closed: true },
  });
  await save({ ...c, ref: q.ref, closesAt: new Date().toISOString() });
  return { ref: q.ref };
}

/** What employees and recipients see: no other people's orders or addresses. */
export function publicCampaign(c: Campaign) {
  return {
    token: c.token,
    kind: c.kind,
    title: c.title,
    brand: c.brand,
    budget: c.budget ?? null,
    closed: Boolean(c.closesAt && c.closesAt <= new Date().toISOString()),
    products: c.products.map((p) => {
      const f = familyById(p.productId)!;
      return {
        productId: p.productId,
        name: f.name,
        image: p.image ?? f.image,
        color: p.color ? colorName(p.color) : f.variants[0].colorName,
        print: p.design ? designSummary(f, p.design) : "Er logga",
        sizes: sizesOf(p.productId).filter((s) => s !== "ONE_SIZE"),
        unit: c.kind === "store" ? p.unit : null,
      };
    }),
  };
}
export type PublicCampaign = ReturnType<typeof publicCampaign>;

export async function placeStoreOrder(token: string, body: { name?: string; email?: string; items?: { productId: string; size?: string; qty?: number }[] }) {
  const c = await getCampaign(token);
  if (!c || c.kind !== "store") return { error: "Butiken finns inte" };
  if (c.closesAt && c.closesAt <= new Date().toISOString()) return { error: "Butiken är stängd" };
  const name = clean(body.name, 60);
  const email = clean(body.email, 120);
  if (!name) return { error: "Skriv ditt namn" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Skriv en giltig e-postadress" };
  const items = (body.items ?? [])
    .map((i) => {
      const p = c.products.find((x) => x.productId === i.productId);
      if (!p) return null;
      const sizes = sizesOf(p.productId).filter((s) => s !== "ONE_SIZE");
      const size = sizes.length ? (sizes.includes(i.size ?? "") ? i.size! : null) : "One size";
      if (!size) return null;
      return { productId: p.productId, size, qty: Math.max(1, Math.min(20, Math.round(Number(i.qty) || 1))), unit: p.unit };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  if (!items.length) return { error: "Välj minst en produkt och storlek" };
  const total = items.reduce((s, i) => s + i.unit * i.qty, 0);
  const spent = c.orders.filter((o) => o.email.toLowerCase() === email.toLowerCase()).reduce((s, o) => s + o.total, 0);
  if (c.budget && spent + total > c.budget) {
    return { error: spent ? `Du har ${Math.max(0, c.budget - spent)} kr kvar av din budget` : "Beställningen är över din budget" };
  }
  const order: StoreOrder = { id: id(), at: new Date().toISOString(), name, email, items: items.map((i) => ({ productId: i.productId, size: i.size, qty: i.qty })), total };
  await save({ ...c, orders: [...c.orders, order].slice(-5000) });
  return { order: { id: order.id, total } };
}

export async function chooseGift(token: string, rid: string, body: { productId?: string; size?: string; address?: Partial<Address> }) {
  const c = await getCampaign(token);
  if (!c || c.kind !== "gift") return { error: "Gåvan finns inte" };
  const r = c.recipients.find((x) => x.id === rid);
  if (!r) return { error: "Länken är inte giltig" };
  const p = c.products.find((x) => x.productId === body.productId);
  if (!p) return { error: "Välj en gåva" };
  const sizes = sizesOf(p.productId).filter((s) => s !== "ONE_SIZE");
  const size = sizes.length ? (sizes.includes(body.size ?? "") ? body.size! : "") : "One size";
  if (!size) return { error: "Välj storlek" };
  const a = body.address ?? {};
  const address: Address = { name: clean(a.name, 80), street: clean(a.street, 120), zip: clean(a.zip, 10), city: clean(a.city, 60), phone: clean(a.phone, 30) || undefined };
  if (!address.name || !address.street || !/^\d{3}\s?\d{2}$/.test(address.zip) || !address.city) return { error: "Fyll i namn, gatuadress, postnummer och ort" };
  const recipients = c.recipients.map((x) => (x.id === rid ? { ...x, choice: { productId: p.productId, size }, address, at: new Date().toISOString() } : x));
  await save({ ...c, recipients });
  return { ok: true as const };
}

export function recipientName(c: Campaign, rid: string) {
  return c.recipients.find((r) => r.id === rid) ?? null;
}

const csvCell = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Orders (store) or shipping list (gift) for the warehouse. */
export function campaignCsv(c: Campaign): string {
  const name = (pid: string) => familyById(pid)?.name ?? pid;
  const rows: string[][] =
    c.kind === "store"
      ? [["Datum", "Namn", "E-post", "Produkt", "Storlek", "Antal", "Summa order"], ...c.orders.flatMap((o) => o.items.map((i) => [o.at.slice(0, 10), o.name, o.email, name(i.productId), i.size, String(i.qty), String(o.total)]))]
      : [
          ["Mottagare", "E-post", "Status", "Gåva", "Storlek", "Leveransnamn", "Gatuadress", "Postnummer", "Ort", "Telefon"],
          ...c.recipients.map((r) => [r.name, r.email ?? "", r.choice ? "Vald" : "Väntar", r.choice ? name(r.choice.productId) : "", r.choice?.size ?? "", r.address?.name ?? "", r.address?.street ?? "", r.address?.zip ?? "", r.address?.city ?? "", r.address?.phone ?? ""]),
        ];
  return "\uFEFF" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n");
}
