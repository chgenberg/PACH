import { randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { cacheKey, cachedUrl } from "@/lib/brandCache";
import { familyById } from "@/lib/catalog";
import { colorName } from "@/lib/colors";
import { designSummary, type LogoDesign } from "@/lib/marking";
import { priceLine } from "@/lib/pricing";
import { getQuote } from "@/lib/quotes";
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
  kind: "store" | "gift";
  createdAt: string;
  ref: string;
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

/** What employees and recipients see: no other people's orders or addresses. */
export function publicCampaign(c: Campaign) {
  return {
    token: c.token,
    kind: c.kind,
    title: c.title,
    brand: c.brand,
    budget: c.budget ?? null,
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
  if (c.budget && total > c.budget) return { error: "Beställningen är över din budget" };
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
