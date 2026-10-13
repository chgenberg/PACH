import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { familyById } from "@/lib/catalog";
import { addWorkdays } from "@/lib/delivery";
import { DEFAULT_PRESENTATION } from "@/lib/offerTemplates";
import { leadDaysFor } from "@/lib/schedule";
import { profileById } from "@/lib/supplierProfiles";
import { SUPPLIER } from "@/lib/supplierTypes";
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

/** An event date that leaves `days` working days for an NWG order to be approved. */
function approvalIn(days: number, productIds: string[]) {
  const rules = profileById(SUPPLIER.id)!.rules;
  const lead = Math.max(...productIds.map((id) => leadDaysFor({}, familyById(id)!, rules)));
  // Approve → 1 day to send the purchase order → 1 day to confirm → production → freight.
  return addWorkdays(new Date(), days + 1 + 1 + rules.proof.days + lead + rules.shipDays).toISOString().slice(0, 10);
}

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
    // Sent, not approved – three working days left to approve, so it turns yellow, then orange, then red.
    ref: "PACH-261012-7408",
    createdAt: daysAgo(1),
    company: "Hagaberg Gymnasium",
    phone: "040-612 30 00",
    brand: "Hagaberg",
    eventDate: approvalIn(3, ["DEMO-P004", "DEMO-P020"]),
    status: "skickad",
    lines: [
      { productId: "DEMO-P004", qty: 90 },
      { productId: "DEMO-P020", qty: 90 },
    ],
    share: { token: "7e6d5c4b3a2918077e6d5c4b3a291807", createdAt: daysAgo(1), comments: [], approvals: {} },
    sends: [{ id: "s0haga0001", token: "0f1e2d3c4b5a69780f1e2d3c4b5a6978", at: daysAgo(1), to: { name: "Emma Lund", email: "emma.lund@hagaberg.se" }, presentation: DEFAULT_PRESENTATION }],
    invoice: { approved: false, kost: {} },
    demo: true,
  },
  {
    // One order, three suppliers: NWG in its portal, the other two by e-mail at different steps.
    ref: "PACH-261009-5820",
    createdAt: daysAgo(5),
    company: "Kustbanken",
    phone: "08-555 120 00",
    host: "kustbanken.se",
    brand: "Kustbanken",
    eventDate: new Date(Date.now() + 24 * 86_400_000).toISOString().slice(0, 10),
    status: "godkand",
    lines: [
      { productId: "DEMO-P001", qty: 120 },
      { productId: "DEMO-P024", qty: 500 },
      { productId: "DEMO-P039", qty: 150 },
    ],
    share: {
      token: "c4b3a29180f7e6d5c4b3a29180f7e6d5",
      createdAt: daysAgo(5),
      comments: [],
      approvals: { "DEMO-P001": { name: "Johan Strand", at: daysAgo(3.5) }, "DEMO-P024": { name: "Johan Strand", at: daysAgo(3.5) }, "DEMO-P039": { name: "Johan Strand", at: daysAgo(3.5) } },
    },
    order: {
      stage: "korrektur",
      history: [
        { stage: "bekraftad", at: daysAgo(3.5), note: "Offert godkänd" },
        { stage: "korrektur", at: daysAgo(3.5), note: "3D-korrektur godkänt av Johan Strand" },
      ],
    },
    invoice: { approved: false, kost: {} },
    demo: true,
  },
  {
    // Last spring's caps – the order the customer finds again in the portal.
    ref: "PACH-260428-3150",
    createdAt: daysAgo(168),
    company: "Bryggeriet Väst",
    phone: "031-700 44 20",
    brand: "Bryggeriet Väst",
    status: "fakturerad",
    lines: [
      { productId: "DEMO-P011", qty: 120 },
      { productId: "DEMO-P036", qty: 40 },
    ],
    invoice: { approved: true, invoiceNumber: "F-10388", invoicedAt: daysAgo(146), kost: {} },
    share: { token: "5e1d0c3b9a7f4e2d8c6b5a4f3e2d1c0b", createdAt: daysAgo(167), comments: [{ id: "c0spring01", at: daysAgo(166), name: "Lisa Ek", text: "Perfekt, kör på den mörka kepsen." }], approvals: { "DEMO-P011": { name: "Lisa Ek", at: daysAgo(165) }, "DEMO-P036": { name: "Lisa Ek", at: daysAgo(165) } } },
    sends: [{ id: "s0spring01", token: "9a8b7c6d5e4f30211203f4e5d6c7b8a9", at: daysAgo(167), to: { name: "Lisa Ek", email: "lisa@bryggeriet.se" }, presentation: DEFAULT_PRESENTATION }],
    order: {
      stage: "levererad",
      tracking: "PN 7340 1188 2201",
      history: [
        { stage: "bekraftad", at: daysAgo(165), note: "Offert godkänd" },
        { stage: "korrektur", at: daysAgo(165), note: "3D-korrektur godkänt av Lisa Ek" },
        { stage: "i-tryck", at: daysAgo(160) },
        { stage: "skickad", at: daysAgo(152) },
        { stage: "levererad", at: daysAgo(150) },
      ],
    },
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

/** Demo orders that were already approved when the demo was set up – their purchase orders count as sent. */
export const seededOrder = (ref: string) => SEEDS.some((s) => s.ref === ref && (s.status === "godkand" || s.status === "fakturerad"));

async function ensureSeeded() {
  await mkdir(DIR, { recursive: true });
  const existing = new Set(await readdir(DIR).catch(() => [] as string[]));
  // Seeds added after a demo was set up appear too; quotes are never deleted, so a missing seed is a new one.
  const missing = SEEDS.filter((q) => !existing.has(`${q.ref}.json`));
  await Promise.all(missing.map((q) => writeFile(file(q.ref), JSON.stringify(q, null, 2))));
}

export function view(q: StoredQuote): QuoteView {
  const { lines, total } = priceQuote(q.lines);
  const extras = q.extras ?? [];
  return { ...q, priced: lines, extras, linesTotal: total, total: total + extras.reduce((s, e) => s + e.amount, 0) };
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
