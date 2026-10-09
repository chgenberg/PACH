import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { priceQuote } from "@/lib/pricing";
import type { QuoteView, StoredQuote } from "@/lib/quoteTypes";

export * from "@/lib/quoteTypes";

/**
 * Offertarkiv för dashboarden. Demo: JSON-filer på disk (nollställs vid deploy) –
 * byts mot Postgres när databasen kopplas in.
 */

const DIR = path.join(process.cwd(), ".data", "quotes");
const REF = /^PACH-\d{6}-\d{4}$/;

export const isRef = (v: unknown): v is string => typeof v === "string" && REF.test(v);

export function newRef(now = new Date()) {
  return `PACH-${now.toISOString().slice(2, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

const SEEDS: StoredQuote[] = [
  {
    ref: "PACH-260921-4182",
    createdAt: daysAgo(18),
    company: "Nordljus Energi AB",
    phone: "070-412 88 10",
    host: "nordljus.se",
    brand: "Nordljus",
    status: "fakturerad",
    lines: [
      { productId: "DEMO-P040", qty: 1 },
      { productId: "DEMO-P001", qty: 120 },
      { productId: "DEMO-P024", qty: 500 },
    ],
    invoice: { approved: true, invoiceNumber: "F-10421", invoicedAt: daysAgo(9), kost: {} },
    demo: true,
  },
  {
    ref: "PACH-260929-7735",
    createdAt: daysAgo(10),
    company: "Kustbanken",
    phone: "08-555 120 00",
    host: "kustbanken.se",
    brand: "Kustbanken",
    status: "godkand",
    lines: [
      { productId: "DEMO-P026", qty: 300 },
      { productId: "DEMO-P028", qty: 300 },
      { productId: "DEMO-P031", qty: 60 },
    ],
    invoice: { approved: true, kost: {} },
    demo: true,
  },
  {
    ref: "PACH-261003-2209",
    createdAt: daysAgo(6),
    company: "Fjällgården Konferens",
    phone: "0647-210 30",
    status: "godkand",
    lines: [
      { productId: "DEMO-P004", qty: 80 },
      { productId: "DEMO-P020", qty: 80 },
      { productId: "DEMO-P011", qty: 80 },
    ],
    invoice: { approved: false, kost: {} },
    demo: true,
  },
  {
    ref: "PACH-261006-5541",
    createdAt: daysAgo(3),
    company: "Studio Halv Tolv",
    phone: "073-990 12 34",
    status: "skickad",
    lines: [
      { productId: "DEMO-P038", qty: 40 },
      { productId: "DEMO-P039", qty: 40 },
    ],
    invoice: { approved: false, kost: {} },
    demo: true,
  },
  {
    ref: "PACH-261008-9013",
    createdAt: daysAgo(1),
    company: "Bryggeriet Väst",
    phone: "031-700 44 20",
    status: "skapad",
    lines: [
      { productId: "DEMO-P011", qty: 150 },
      { productId: "DEMO-P036", qty: 50 },
      { productId: "DEMO-P035", qty: 20 },
    ],
    invoice: { approved: false, kost: {} },
    demo: true,
  },
];

const file = (ref: string) => path.join(DIR, `${ref}.json`);

async function ensureSeeded() {
  await mkdir(DIR, { recursive: true });
  const existing = await readdir(DIR).catch(() => [] as string[]);
  if (existing.some((f) => f.endsWith(".json"))) return;
  await Promise.all(SEEDS.map((q) => writeFile(file(q.ref), JSON.stringify(q, null, 2))));
}

export function view(q: StoredQuote): QuoteView {
  const { lines, total } = priceQuote(q.lines);
  return { ...q, priced: lines, total };
}

export async function listQuotes(): Promise<QuoteView[]> {
  await ensureSeeded();
  const names = (await readdir(DIR)).filter((f) => f.endsWith(".json"));
  const all = await Promise.all(names.map((n) => readFile(path.join(DIR, n), "utf8").then((s) => JSON.parse(s) as StoredQuote).catch(() => null)));
  return all
    .filter((q): q is StoredQuote => q !== null)
    .map(view)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getQuote(ref: string): Promise<StoredQuote | null> {
  if (!isRef(ref)) return null;
  await ensureSeeded();
  return readFile(file(ref), "utf8")
    .then((s) => JSON.parse(s) as StoredQuote)
    .catch(() => null);
}

export async function saveQuote(q: StoredQuote) {
  await ensureSeeded();
  await writeFile(file(q.ref), JSON.stringify(q, null, 2));
  return q;
}

export async function createQuote(input: Omit<StoredQuote, "ref" | "createdAt" | "status" | "invoice">) {
  const now = new Date();
  return saveQuote({ ...input, ref: newRef(now), createdAt: now.toISOString(), status: "skapad", invoice: { approved: false, kost: {} } });
}
