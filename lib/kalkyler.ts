import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { familyById } from "@/lib/catalog";
import { BASE_COLOR, isHex } from "@/lib/colors";
import { DEFAULT_PRICING, type PriceMode, type Pricing } from "@/lib/costing";
import type { Kalkyl, KalkylSummary } from "@/lib/kalkylTypes";
import { defaultDesign, sanitizeDesign } from "@/lib/marking";
import { listQuotes } from "@/lib/quotes";
import { sanitizeProofs } from "@/lib/quoteTypes";

export * from "@/lib/kalkylTypes";

/** Kalkyler i demon: en JSON-fil bredvid offerterna, nollställs vid deploy. */
const FILE = path.join(process.cwd(), ".data", "kalkyler.json");
const DAY = 86_400_000;
const ago = (d: number) => new Date(Date.now() - d * DAY).toISOString();
export const newKalkylId = () => `k-${randomBytes(5).toString("hex")}`;

function seed(id: string, productId: string, qty: number, days: number, extra: Partial<Kalkyl> = {}): Kalkyl {
  const f = familyById(productId)!;
  return { id, createdAt: ago(days), updatedAt: ago(days), productId, qty, color: BASE_COLOR, design: defaultDesign(f), pricing: DEFAULT_PRICING, ...extra };
}

/** Three suppliers for the same customer – caps, notebooks and powerbanks – to compose into one offer. */
const SEEDS = (): Kalkyl[] => [
  seed("k-seed00001", "DEMO-P011", 150, 2, { customer: { company: "Bryggeriet Väst" }, title: "Kepsar till personalen", design: { method: "brodyr", colors: 2, shape: "original", zone: "front", sizeCm: 6 } }),
  seed("k-seed00002", "DEMO-P029", 50, 2, { customer: { company: "Bryggeriet Väst" }, title: "Paraplyer till kundevent", pricing: { mode: "markup", markupPct: 70 } }),
  seed("k-seed00003", "DEMO-P031", 60, 1, { customer: { company: "Bryggeriet Väst" }, title: "Powerbanks till säljarna", design: { method: "gravyr", colors: 1, shape: "original", zone: "front", sizeCm: 4 } }),
  seed("k-seed00004", "DEMO-P026", 300, 4, { customer: { company: "Kustbanken" }, title: "Anteckningsböcker till konferensen", pricing: { mode: "fixed", markupPct: 60, unit: 128, setup: 450 } }),
];

async function readAll(): Promise<Kalkyl[]> {
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as Kalkyl[];
  } catch {
    const seeds = SEEDS();
    await writeAll(seeds);
    return seeds;
  }
}

async function writeAll(list: Kalkyl[]) {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(list, null, 2));
}

export async function listKalkyler(): Promise<KalkylSummary[]> {
  const [all, quotes] = await Promise.all([readAll(), listQuotes()]);
  return all
    .map(({ proofs, ...k }) => ({
      ...k,
      proofCount: proofs?.length ?? 0,
      usedIn: quotes.filter((q) => q.lines.some((l) => l.kalkylId === k.id)).map((q) => ({ ref: q.ref, company: q.company, status: q.status })),
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export const getKalkyl = async (id: string) => (await readAll()).find((k) => k.id === id) ?? null;
export const getKalkyler = async (ids: string[]) => (await readAll()).filter((k) => ids.includes(k.id));

const MODES: PriceMode[] = ["list", "markup", "fixed"];
const num = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : undefined);
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) || undefined : undefined);

export function sanitizePricing(raw: unknown): Pricing {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const mode = MODES.includes(r.mode as PriceMode) ? (r.mode as PriceMode) : "list";
  return {
    mode,
    markupPct: Math.round(num(r.markupPct, -90, 1000) ?? DEFAULT_PRICING.markupPct),
    ...(mode === "fixed" ? { unit: Math.round(num(r.unit, 0, 1_000_000) ?? 0), setup: Math.round(num(r.setup, 0, 1_000_000) ?? 0) } : {}),
  };
}

/** Everything the editor may send; product, quantity and pricing are always validated against the catalogue. */
export function sanitizeKalkyl(raw: Record<string, unknown>, base?: Kalkyl): Kalkyl | { error: string } {
  const productId = typeof raw.productId === "string" ? raw.productId : base?.productId;
  const f = productId ? familyById(productId) : null;
  if (!f) return { error: "Välj en produkt." };
  const qty = Math.round(num(raw.qty, 1, 100_000) ?? base?.qty ?? 0);
  if (!qty) return { error: "Ange antal." };
  const company = text((raw.customer as Record<string, unknown> | undefined)?.company, 80);
  const host = text((raw.customer as Record<string, unknown> | undefined)?.host, 120);
  const now = new Date().toISOString();
  const image = typeof raw.image === "string" && /^(\/|data:image\/(png|jpeg|webp);base64,)/.test(raw.image) && raw.image.length < 3_000_000 ? raw.image : raw.image === null ? undefined : base?.image;
  return {
    id: base?.id ?? newKalkylId(),
    createdAt: base?.createdAt ?? now,
    updatedAt: now,
    title: text(raw.title, 80),
    customer: company ? { company, ...(host ? { host } : {}) } : undefined,
    productId: f.id,
    qty,
    color: isHex(raw.color) ? raw.color.toUpperCase() : (base?.color ?? BASE_COLOR),
    design: raw.design === undefined ? base?.design : sanitizeDesign(f, raw.design),
    image,
    proofs: raw.proofs === undefined ? base?.proofs : sanitizeProofs(raw.proofs),
    pricing: sanitizePricing(raw.pricing ?? base?.pricing),
    note: text(raw.note, 400),
    archived: typeof raw.archived === "boolean" ? raw.archived : base?.archived,
  };
}

export async function saveKalkyl(k: Kalkyl) {
  const all = await readAll();
  const i = all.findIndex((x) => x.id === k.id);
  if (i >= 0) all[i] = k;
  else all.unshift(k);
  await writeAll(all);
  return k;
}

export async function deleteKalkyl(id: string) {
  const all = await readAll();
  await writeAll(all.filter((k) => k.id !== id));
}
