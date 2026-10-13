import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { cacheKey, storeImage } from "@/lib/brandCache";
import { type Family, familyById, families, fromPrice, moqOf } from "@/lib/catalog";
import { defaultMethodTerms, defaultUnitCost, printCost } from "@/lib/costing";
import { BASE_COLOR, colorName } from "@/lib/colors";
import { addWorkdays, estimate, SHIPPING_DAYS, subWorkdays } from "@/lib/delivery";
import { type LogoDesign, METHOD_INFO, METHODS, type Method, placementRows } from "@/lib/marking";
import { poNumber, readPoStore } from "@/lib/poStore";
import { skuRows } from "@/lib/purchaseOrders";
import { getQuote, listQuotes, type OrderStage, seededOrder } from "@/lib/quotes";
import type { StoredLine, StoredQuote } from "@/lib/quoteTypes";
import {
  type CatalogItem,
  type ContentUpload,
  type Demand,
  ISSUE_KINDS,
  ISSUE_LABEL,
  isNwg,
  type MethodTerms,
  NWG_BRANDS,
  type OrderAction,
  type PriceList,
  type ProductTerms,
  SUPPLIER,
  SUPPLIER_STAGE_LABEL,
  SUPPLIER_STAGES,
  type StockItem,
  type SupplierLine,
  type SupplierOrder,
  type SupplierOrderState,
  type SupplierSettings,
  type SupplierStage,
} from "@/lib/supplierTypes";

export * from "@/lib/supplierTypes";

/**
 * Leverantörsportalen (demo): New Wave Group ser PACH:s ordrar på sina produkter, sitt lager,
 * sina priser och efterfrågan. Allt sparas som JSON under .data/supplier och nollställs vid deploy.
 */

const DIR = path.join(process.cwd(), ".data", "supplier");
const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number, hour = 9) => {
  const d = new Date(Date.now() - n * DAY);
  d.setUTCHours(hour, 12, 0, 0);
  return d.toISOString();
};
const inDays = (n: number) => iso(new Date(Date.now() + n * DAY));

async function readJson<T>(name: string, fallback: T): Promise<T> {
  return readFile(path.join(DIR, name), "utf8")
    .then((s) => JSON.parse(s) as T)
    .catch(() => fallback);
}

async function writeJson(name: string, data: unknown) {
  await mkdir(DIR, { recursive: true });
  await writeFile(path.join(DIR, name), JSON.stringify(data, null, 2));
}

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/* ---------- catalogue, prices and stock ---------- */

export const nwgFamilies = () => families.filter((f) => isNwg(f.id));

const defaultTerms = (f: Family): ProductTerms => ({ price: defaultUnitCost(f), moq: moqOf(f), leadDays: 2 });

type StoredPrices = { products?: Record<string, Partial<ProductTerms>>; methods?: Partial<Record<Method, Partial<MethodTerms>>>; pending?: boolean; sentAt?: string };

export async function priceList(): Promise<PriceList> {
  const saved = await readJson<StoredPrices>("prices.json", {});
  const base = defaultMethodTerms();
  return {
    products: Object.fromEntries(nwgFamilies().map((f) => [f.id, { ...defaultTerms(f), ...saved.products?.[f.id] }])),
    methods: Object.fromEntries(METHODS.map((m) => [m, { ...base[m], ...saved.methods?.[m] }])) as Record<Method, MethodTerms>,
    pending: Boolean(saved.pending),
    sentAt: saved.sentAt,
  };
}

const num = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : undefined);

export async function savePrices(input: { products?: Record<string, Partial<ProductTerms>>; methods?: Partial<Record<Method, Partial<MethodTerms>>> }) {
  const saved = await readJson<StoredPrices>("prices.json", {});
  const products = { ...saved.products };
  for (const [id, t] of Object.entries(input.products ?? {})) {
    if (!isNwg(id)) continue;
    products[id] = {
      ...products[id],
      ...(num(t.price, 1, 100_000) !== undefined ? { price: Math.round(num(t.price, 1, 100_000)!) } : {}),
      ...(num(t.moq, 1, 10_000) !== undefined ? { moq: Math.round(num(t.moq, 1, 10_000)!) } : {}),
      ...(num(t.leadDays, 0, 60) !== undefined ? { leadDays: Math.round(num(t.leadDays, 0, 60)!) } : {}),
    };
  }
  const methods = { ...saved.methods };
  for (const m of METHODS) {
    const t = input.methods?.[m];
    if (!t) continue;
    methods[m] = {
      ...methods[m],
      ...(num(t.setupPerColor, 0, 10_000) !== undefined ? { setupPerColor: Math.round(num(t.setupPerColor, 0, 10_000)!) } : {}),
      ...(num(t.unitPerColor, 0, 1000) !== undefined ? { unitPerColor: Math.round(num(t.unitPerColor, 0, 1000)! * 10) / 10 } : {}),
    };
  }
  await writeJson("prices.json", { products, methods, pending: true, sentAt: new Date().toISOString() });
  return priceList();
}

/** PACH accepts the supplier's latest price list. */
export async function acceptPrices() {
  const saved = await readJson<StoredPrices>("prices.json", {});
  await writeJson("prices.json", { ...saved, pending: false });
}

/** Demo stock that tells a story: one order runs short, a few items are sold out or low. */
const DEMO_STOCK: Record<string, number> = { "DEMO-P008-NV-L": 20, "DEMO-P012-NV-ONE_SIZE": 0, "DEMO-P017-BK-ONE_SIZE": 0, "DEMO-P002-NV-S": 14, "DEMO-P020-NV-ONE_SIZE": 35 };

/** A stable demo number per SKU. */
function baseStock(sku: string) {
  if (sku in DEMO_STOCK) return DEMO_STOCK[sku];
  return 900 + (hash(sku) % 2600);
}

const restockOf = (sku: string) => inDays(7 * (1 + (hash(sku) % 3)));

export async function stockLevels(): Promise<Record<string, number>> {
  const saved = await readJson<Record<string, number>>("stock.json", {});
  const out: Record<string, number> = {};
  for (const f of nwgFamilies()) for (const v of f.variants) out[v.sku] = saved[v.sku] ?? baseStock(v.sku);
  return out;
}

export async function saveStock(rows: { sku: string; stock: number }[]) {
  const saved = await readJson<Record<string, number>>("stock.json", {});
  const known = new Set(nwgFamilies().flatMap((f) => f.variants.map((v) => v.sku)));
  let changed = 0;
  for (const r of rows) {
    if (!known.has(r.sku) || !Number.isFinite(r.stock)) continue;
    saved[r.sku] = Math.max(0, Math.min(1_000_000, Math.round(r.stock)));
    changed += 1;
  }
  await writeJson("stock.json", saved);
  return changed;
}

/* ---------- demo orders from other PACH customers ---------- */

const D = (method: Method, colors: number, zone: string, sizeCm: number, extra?: Partial<LogoDesign>): LogoDesign => ({ method, colors, shape: "original", zone, sizeCm, ...extra });

type Seed = {
  ref: string;
  company: string;
  city: string;
  createdAt: string;
  needBy?: string;
  lines: StoredLine[];
  state: () => SupplierOrderState;
};

const ev = (at: string, text: string, stage?: SupplierStage) => ({ at, text, stage });
const received = (at: string) => ev(at, "Order mottagen från PACH");

const SEEDS: Seed[] = [
  {
    ref: "PACH-261011-6120",
    company: "Hallonbergen IF",
    city: "Sundbyberg",
    createdAt: daysAgo(0, 7),
    needBy: inDays(16),
    lines: [
      { productId: "DEMO-P008", qty: 180, color: "#14243B", design: D("transfer", 2, "brost", 14, { names: { list: ["NAMN"], zone: "rygg", sizeCm: 24 } }) },
      { productId: "DEMO-P013", qty: 180, color: "#14243B", design: D("digitaltryck", 4, "front", 8) },
    ],
    state: () => ({ stage: "ny", history: [received(daysAgo(0, 7))], issues: {} }),
  },
  {
    ref: "PACH-261010-2871",
    company: "Nordkap Outdoor",
    city: "Umeå",
    createdAt: daysAgo(1, 14),
    needBy: inDays(13),
    lines: [
      { productId: "DEMO-P007", qty: 60, color: "#111111", design: D("brodyr", 2, "vanster", 8) },
      { productId: "DEMO-P009", qty: 60, color: "#111111", design: D("transfer", 1, "vanster", 9) },
      { productId: "DEMO-P016", qty: 60, color: "#111111", design: D("screentryck", 1, "front", 22) },
    ],
    state: () => ({ stage: "ny", history: [received(daysAgo(1, 14))], issues: {} }),
  },
  {
    ref: "PACH-261007-5302",
    company: "Lindvik Sparbank",
    city: "Örebro",
    createdAt: daysAgo(5, 10),
    needBy: inDays(9),
    lines: [
      { productId: "DEMO-P021", qty: 300, color: "#111111", design: D("gravyr", 1, "front", 5) },
      { productId: "DEMO-P022", qty: 300, color: "#111111", design: D("screentryck", 1, "front", 7) },
    ],
    state: () => ({
      stage: "bekraftad",
      history: [
        received(daysAgo(5, 10)),
        ev(daysAgo(4, 8), "Bekräftad av Johanna, NWG Lager Ulricehamn", "bekraftad"),
        ev(daysAgo(0, 8), "Flaggade Keramikmugg 300 ml: går inte att trycka så – 7 cm screentryck går inte runt handtaget, föreslår 6 cm"),
      ],
      issues: { "DEMO-P022": { kind: "tryck", note: "7 cm screentryck går inte runt handtaget – föreslår 6 cm, samma placering.", at: daysAgo(0, 8) } },
    }),
  },
  {
    ref: "PACH-261003-8814",
    company: "Göta Logistik AB",
    city: "Göteborg",
    createdAt: daysAgo(9, 11),
    needBy: inDays(5),
    lines: [
      { productId: "DEMO-P006", qty: 120, color: "#14243B", design: D("brodyr", 2, "vanster", 9, { extra: [D("transfer", 1, "rygg", 26)] }) },
      { productId: "DEMO-P011", qty: 120, color: "#14243B", design: D("brodyr", 2, "front", 6) },
    ],
    state: () => ({
      stage: "i-tryck",
      history: [
        received(daysAgo(9, 11)),
        ev(daysAgo(8, 9), "Bekräftad av Johanna, NWG Lager Ulricehamn", "bekraftad"),
        ev(daysAgo(3, 13), "Brodyren startad – maskin 4", "i-tryck"),
        ev(daysAgo(0, 9), `Föreslog nytt utskick ${inDays(4)} – en brodyrmaskin är på service i dag`),
      ],
      proposedDate: inDays(4),
      issues: {},
    }),
  },
  {
    ref: "PACH-260930-4467",
    company: "Studio Kvarn",
    city: "Malmö",
    createdAt: daysAgo(13, 15),
    lines: [
      { productId: "DEMO-P004", qty: 40, color: "#111111", design: D("brodyr", 1, "brost", 10) },
      { productId: "DEMO-P014", qty: 100, color: "#111111", design: D("screentryck", 1, "front", 24) },
    ],
    state: () => ({
      stage: "skickad",
      carrier: "PostNord",
      tracking: "00370733512349012345",
      history: [
        received(daysAgo(13, 15)),
        ev(daysAgo(12, 9), "Bekräftad", "bekraftad"),
        ev(daysAgo(8, 10), "I tryck", "i-tryck"),
        ev(daysAgo(4, 15), "Packad, 3 kartonger", "packad"),
        ev(daysAgo(3, 16), "Skickad med PostNord", "skickad"),
      ],
      issues: {},
    }),
  },
  {
    ref: "PACH-260922-1093",
    company: "Arkitektkontoret Linje",
    city: "Stockholm",
    createdAt: daysAgo(20, 9),
    lines: [{ productId: "DEMO-P003", qty: 30, color: "#111111", design: D("brodyr", 1, "vanster", 7) }],
    state: () => ({
      stage: "levererad",
      carrier: "DHL",
      tracking: "JVGL0624817733",
      history: [
        received(daysAgo(20, 9)),
        ev(daysAgo(19, 9), "Bekräftad", "bekraftad"),
        ev(daysAgo(14, 9), "I tryck", "i-tryck"),
        ev(daysAgo(10, 9), "Packad", "packad"),
        ev(daysAgo(9, 15), "Skickad med DHL", "skickad"),
        ev(daysAgo(7, 11), "Levererad", "levererad"),
      ],
      issues: {},
    }),
  },
  {
    ref: "PACH-260915-3381",
    company: "Björkö Konferens",
    city: "Uppsala",
    createdAt: daysAgo(27, 13),
    lines: [
      { productId: "DEMO-P035", qty: 50, color: "#111111", design: D("brodyr", 1, "hörn", 8) },
      { productId: "DEMO-P019", qty: 50, color: "#111111", design: D("gravyr", 1, "front", 5) },
    ],
    state: () => ({
      stage: "levererad",
      carrier: "PostNord",
      tracking: "00370733512340098812",
      history: [
        received(daysAgo(27, 13)),
        ev(daysAgo(26, 9), "Bekräftad", "bekraftad"),
        ev(daysAgo(21, 9), "I tryck", "i-tryck"),
        ev(daysAgo(18, 9), "Packad", "packad"),
        ev(daysAgo(17, 14), "Skickad med PostNord", "skickad"),
        ev(daysAgo(15, 10), "Levererad", "levererad"),
      ],
      issues: {},
      invoice: { number: "NWG-F-24117", at: daysAgo(15, 16), amount: 0, due: iso(new Date(Date.now() + 15 * DAY)) },
    }),
  },
];

/* ---------- orders ---------- */

const numberOf = (ref: string) => ref.replace("PACH", SUPPLIER.short);

/** Where a PACH order already is, translated to the supplier's stages. */
function stageFromQuote(q: StoredQuote): SupplierStage {
  const map: Record<OrderStage, SupplierStage> = { bekraftad: "bekraftad", korrektur: "bekraftad", "i-tryck": "i-tryck", kontroll: "packad", skickad: "skickad", levererad: "levererad" };
  if (q.order) return map[q.order.stage];
  return q.status === "fakturerad" ? "levererad" : "ny";
}


/** Textile demo orders get a believable size spread; everything else is one size. */
function demoRows(line: StoredLine, f: Family) {
  const hex = (line.color ?? BASE_COLOR).toUpperCase();
  const variants = f.variants.filter((v) => v.colorHex.toUpperCase() === hex);
  const list = variants.length ? variants : f.variants;
  if (list.length === 1) return [{ sku: list[0].sku, size: list[0].size === "ONE_SIZE" ? "One size" : list[0].size, qty: line.qty }];
  const shares = [0.3, 0.45, 0.25];
  let left = line.qty;
  return list.map((v, i) => {
    const qty = i === list.length - 1 ? left : Math.round(line.qty * (shares[i] ?? 1 / list.length));
    left -= qty;
    return { sku: v.sku, size: v.size, qty };
  });
}

type Draft = Omit<SupplierOrder, "lines" | "units" | "value" | "late" | "short"> & { raw: { line: StoredLine; f: Family; rows: { sku: string; size: string; qty: number }[] }[] };

async function drafts(): Promise<Draft[]> {
  const saved = await readJson<Record<string, SupplierOrderState>>("orders.json", {});
  const out: Draft[] = [];
  for (const s of SEEDS) {
    const raw = s.lines.flatMap((line) => {
      const f = familyById(line.productId);
      return f ? [{ line, f, rows: demoRows(line, f) }] : [];
    });
    const number = numberOf(s.ref);
    out.push({ number, ref: s.ref, customer: s.company, city: s.city, createdAt: s.createdAt, needBy: s.needBy, shipBy: "", brands: [], source: "demo", state: saved[number] ?? s.state(), raw });
  }
  const poStore = await readPoStore();
  for (const q of await listQuotes()) {
    if (q.status !== "godkand" && q.status !== "fakturerad") continue;
    // NWG only sees orders PACH has sent; orders approved in the demo data and orders NWG already worked on count as sent.
    const sentAt = poStore[poNumber(q.ref, SUPPLIER.short)]?.sentAt;
    if (!seededOrder(q.ref) && !sentAt && !saved[numberOf(q.ref)]) continue;
    const raw = q.lines.flatMap((line) => {
      const f = familyById(line.productId);
      if (!f || !isNwg(f.id)) return [];
      return [{ line, f, rows: skuRows(q, line, f).map((r) => ({ sku: r.sku, size: r.size, qty: r.qty })) }];
    });
    if (!raw.length) continue;
    const number = numberOf(q.ref);
    const approvedAt = Object.values(q.share?.approvals ?? {}).map((a) => a.at).sort().at(-1) ?? q.createdAt;
    const receivedAt = sentAt ?? approvedAt;
    out.push({
      number,
      ref: q.ref,
      customer: q.company,
      createdAt: receivedAt,
      needBy: q.eventDate,
      shipBy: "",
      brands: [],
      source: "pach",
      state: saved[number] ?? { stage: seededOrder(q.ref) ? stageFromQuote(q) : "ny", history: [received(receivedAt)], issues: {} },
      raw,
    });
  }
  return out;
}

const RESERVES: SupplierStage[] = ["ny", "bekraftad", "i-tryck"];

export async function listOrders(): Promise<SupplierOrder[]> {
  const [list, stock, prices] = await Promise.all([drafts(), stockLevels(), priceList()]);
  // Stock already promised to other open orders is not available to this one.
  const reserved = new Map<string, Map<string, number>>();
  for (const d of list) {
    if (!RESERVES.includes(d.state.stage)) continue;
    for (const r of d.raw.flatMap((x) => x.rows)) {
      const m = reserved.get(r.sku) ?? new Map<string, number>();
      m.set(d.number, (m.get(d.number) ?? 0) + r.qty);
      reserved.set(r.sku, m);
    }
  }
  const othersOf = (sku: string, number: string) => [...(reserved.get(sku)?.entries() ?? [])].filter(([n]) => n !== number).reduce((s, [, q]) => s + q, 0);
  const today = iso(new Date());

  return list
    .map((d) => {
      const lines: SupplierLine[] = d.raw.map(({ line, f, rows }) => {
        const terms = prices.products[f.id] ?? defaultTerms(f);
        const print = printCost(line.design, line.qty, prices.methods);
        return {
          productId: f.id,
          name: f.name,
          brand: NWG_BRANDS[f.id],
          image: f.image,
          qty: line.qty,
          color: colorName((line.color ?? BASE_COLOR).toUpperCase()),
          rows: rows.map((r) => ({ ...r, available: (stock[r.sku] ?? 0) - othersOf(r.sku, d.number) })),
          marking: line.design ? placementRows(f, line.design).map((p) => [p.method, p.colors, p.zone, p.size].join(" · ")) : ["Standardmärkning enligt korrektur"],
          method: line.design?.method,
          unit: terms.price,
          printUnit: print.perUnit,
          printSetup: print.setup,
          total: (terms.price + print.perUnit) * line.qty + print.setup,
          proofs: line.proofs?.length ?? 0,
        };
      });
      const made = new Date(d.createdAt);
      const slowest = d.raw.reduce((latest, { f, line }) => {
        const est = estimate(f, line.design, made).date;
        return est > latest ? est : latest;
      }, iso(addWorkdays(made, 3)));
      const target = d.state.proposedDate ?? (d.needBy ? iso(subWorkdays(new Date(`${d.needBy}T12:00:00Z`), SHIPPING_DAYS)) : iso(subWorkdays(new Date(`${slowest}T12:00:00Z`), SHIPPING_DAYS)));
      const open = SUPPLIER_STAGES.indexOf(d.state.stage) < SUPPLIER_STAGES.indexOf("skickad");
      const short = RESERVES.includes(d.state.stage) && lines.some((l) => l.rows.some((r) => r.qty > r.available && r.size !== "Ej angiven"));
      const value = lines.reduce((s, l) => s + l.total, 0);
      const state = d.state.invoice && !d.state.invoice.amount ? { ...d.state, invoice: { ...d.state.invoice, amount: value } } : d.state;
      return {
        number: d.number,
        ref: d.ref,
        customer: d.customer,
        city: d.city,
        createdAt: d.createdAt,
        needBy: d.needBy,
        shipBy: target,
        lines,
        units: lines.reduce((s, l) => s + l.qty, 0),
        value,
        brands: [...new Set(lines.map((l) => l.brand))],
        source: d.source,
        state,
        late: open && target < today,
        short,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getOrder(number: string) {
  return (await listOrders()).find((o) => o.number === number) ?? null;
}

/** Proof images for one order line – only sent when the order is opened, they are large. */
export async function orderProofs(order: SupplierOrder): Promise<Record<string, { label: string; image: string }[]>> {
  if (order.source !== "pach") return {};
  const q = await getQuote(order.ref);
  return Object.fromEntries((q?.lines ?? []).filter((l) => isNwg(l.productId) && l.proofs?.length).map((l) => [l.productId, l.proofs!]));
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

export async function applyOrderAction(number: string, body: OrderAction): Promise<{ order?: SupplierOrder; error?: string }> {
  const order = await getOrder(number);
  if (!order) return { error: "Ordern hittades inte." };
  const saved = await readJson<Record<string, SupplierOrderState>>("orders.json", {});
  const state: SupplierOrderState = structuredClone(order.state);
  const at = new Date().toISOString();

  if (body.action === "advance") {
    const next = SUPPLIER_STAGES[SUPPLIER_STAGES.indexOf(state.stage) + 1];
    if (!next) return { error: "Ordern är redan levererad." };
    const tracking = clean(body.tracking, 60);
    if (next === "skickad" && !tracking && !state.tracking) return { error: "Fyll i spårningsnumret innan ordern markeras som skickad." };
    if (next === "bekraftad" && Object.values(state.issues).some((i) => !i.resolved && i.kind === "slut")) return { error: "Lös flaggan om lagerbrist innan ordern bekräftas." };
    state.stage = next;
    if (tracking) state.tracking = tracking;
    if (body.carrier) state.carrier = clean(body.carrier, 30);
    const note = clean(body.note, 200);
    const label = next === "skickad" ? `Skickad med ${state.carrier ?? "PostNord"}` : SUPPLIER_STAGE_LABEL[next];
    state.history.push(ev(at, note ? `${label} – ${note}` : label, next));
  } else if (body.action === "issue") {
    if (!order.lines.some((l) => l.productId === body.productId) || !(ISSUE_KINDS as readonly string[]).includes(body.kind)) return { error: "Okänd rad eller flagga." };
    const note = clean(body.note, 300);
    if (!note) return { error: "Beskriv vad som är fel." };
    const date = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : undefined;
    state.issues[body.productId] = { kind: body.kind, note, replacement: clean(body.replacement, 80) || undefined, date, at };
    const name = order.lines.find((l) => l.productId === body.productId)?.name;
    state.history.push(ev(at, `Flaggade ${name}: ${ISSUE_LABEL[body.kind].toLowerCase()} – ${note}`));
  } else if (body.action === "resolve") {
    const issue = state.issues[body.productId];
    if (!issue) return { error: "Det finns ingen flagga på raden." };
    issue.resolved = true;
    state.history.push(ev(at, `Flaggan på ${order.lines.find((l) => l.productId === body.productId)?.name} är löst`));
  } else if (body.action === "propose") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) return { error: "Välj ett datum." };
    state.proposedDate = body.date;
    const note = clean(body.note, 200);
    state.history.push(ev(at, `Föreslog nytt utskick ${body.date}${note ? ` – ${note}` : ""}`));
  } else if (body.action === "invoice") {
    if (state.invoice) return { error: "Ordern är redan fakturerad." };
    if (SUPPLIER_STAGES.indexOf(state.stage) < SUPPLIER_STAGES.indexOf("skickad")) return { error: "Ordern faktureras när den är skickad." };
    const used = Object.values(saved).map((s) => Number(s.invoice?.number.split("-").at(-1) ?? 0));
    const n = Math.max(24117, ...used) + 1;
    state.invoice = { number: `${SUPPLIER.short}-F-${n}`, at, amount: order.value, due: iso(new Date(Date.now() + 30 * DAY)) };
    state.history.push(ev(at, `Fakturerad ${state.invoice.number}`));
  } else {
    return { error: "Okänd åtgärd." };
  }

  saved[number] = state;
  await writeJson("orders.json", saved);
  if (order.source === "pach") await syncToPach(order.ref, state, body);
  return { order: (await getOrder(number)) ?? undefined };
}

/**
 * The supplier's progress shows up on PACH's order and the customer's tracking, never moving it backwards.
 * With several suppliers the order only moves when every purchase order has got that far.
 */
async function syncToPach(ref: string, state: SupplierOrderState, body: OrderAction) {
  if (body.action !== "advance") return;
  // Loaded on demand: purchasing reads this module's orders, so a static import would be circular.
  const { syncOrderStage } = await import("@/lib/purchasing");
  await syncOrderStage(ref, state.stage === "skickad" ? `${SUPPLIER.name}: skickad med ${state.carrier ?? "PostNord"}` : `Uppdaterat av ${SUPPLIER.name}`);
}

/** What PACH's own order view shows about the supplier's part of an order. */
export async function supplierStatusFor(ref: string) {
  const order = (await listOrders()).find((o) => o.ref === ref);
  if (!order) return null;
  return {
    number: order.number,
    stage: order.state.stage,
    label: SUPPLIER_STAGE_LABEL[order.state.stage],
    shipBy: order.shipBy,
    proposedDate: order.state.proposedDate,
    tracking: order.state.tracking,
    issues: Object.entries(order.state.issues)
      .filter(([, i]) => !i.resolved)
      .map(([productId, i]) => ({ productId, name: order.lines.find((l) => l.productId === productId)?.name ?? productId, ...i, label: ISSUE_LABEL[i.kind] })),
  };
}

/* ---------- catalogue view ---------- */

const modelExists = (id: string) =>
  access(path.join(process.cwd(), "public", "models", `${id}.glb`))
    .then(() => true)
    .catch(() => false);

export async function catalog(): Promise<CatalogItem[]> {
  const [stock, prices, uploads, orders] = await Promise.all([
    stockLevels(),
    priceList(),
    readJson<Record<string, ContentUpload[]>>("content.json", {}),
    listOrders(),
  ]);
  const allocated = new Map<string, number>();
  for (const o of orders) if (RESERVES.includes(o.state.stage)) for (const r of o.lines.flatMap((l) => l.rows)) allocated.set(r.sku, (allocated.get(r.sku) ?? 0) + r.qty);

  return Promise.all(
    nwgFamilies().map(async (f) => {
      const ups = uploads[f.id] ?? [];
      const textile = new Set(f.variants.map((v) => v.size)).size > 1;
      const checks = [
        { key: "image", label: "Produktbild", ok: Boolean(f.image) },
        { key: "model", label: "3D-modell", ok: await modelExists(f.id) },
        { key: "text", label: "Produkttext (minst 140 tecken)", ok: (f.description?.length ?? 0) >= 140 },
        { key: "material", label: "Material", ok: Boolean(f.material) },
        { key: "lifestyle", label: "Miljöbild", ok: ups.length > 0 },
        ...(textile ? [{ key: "sizes", label: "Storleksguide", ok: hash(f.id) % 3 !== 0 }] : []),
        { key: "cert", label: "Certifiering (t.ex. OEKO-TEX)", ok: hash(`${f.id}-cert`) % 4 !== 0 },
      ];
      return {
        productId: f.id,
        name: f.name,
        brand: NWG_BRANDS[f.id],
        category: f.subcategory,
        image: f.image,
        listPrice: Math.round(fromPrice(f)),
        terms: prices.products[f.id],
        defaultTerms: defaultTerms(f),
        stock: f.variants.map(
          (v): StockItem => ({
            sku: v.sku,
            productId: f.id,
            color: v.colorName,
            size: v.size === "ONE_SIZE" ? "One size" : v.size,
            stock: stock[v.sku] ?? 0,
            allocated: allocated.get(v.sku) ?? 0,
            restock: (stock[v.sku] ?? 0) === 0 ? restockOf(v.sku) : undefined,
          }),
        ),
        content: { productId: f.id, checks, uploads: ups },
      };
    }),
  );
}

export async function addContent(productId: string, dataUrl: string, note?: string) {
  if (!isNwg(productId)) return { error: "Okänd produkt." };
  if (!/^data:image\/(png|jpeg|webp);base64,/.test(dataUrl) || dataUrl.length > 12_000_000) return { error: "Ladda upp en PNG, JPEG eller WebP under 8 MB." };
  const at = new Date().toISOString();
  const image = await storeImage(cacheKey("supplier-content", productId, at), Buffer.from(dataUrl.split(",", 2)[1], "base64"));
  const all = await readJson<Record<string, ContentUpload[]>>("content.json", {});
  all[productId] = [{ image, at, note: clean(note, 120) || undefined }, ...(all[productId] ?? [])].slice(0, 8);
  await writeJson("content.json", all);
  return { ok: true };
}

/* ---------- demand ---------- */

const weekStart = (d: Date) => {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return iso(x);
};

/** Open quotes from other PACH customers, so the demo forecast has dates to show. */
const DEMO_UPCOMING = () => [
  { date: inDays(18), units: 220, brands: ["Craft"], status: "Offert hos kund" },
  { date: inDays(26), units: 400, brands: ["Sagaform"], status: "Offert hos kund" },
  { date: inDays(33), units: 150, brands: ["Clique", "Printer"], status: "Offert skapad" },
];

export async function demand(): Promise<Demand> {
  const [quotes, orders, items] = await Promise.all([listQuotes(), listOrders(), catalog()]);
  const now = Date.now();
  const settled = quotes.filter((q) => now - new Date(q.createdAt).getTime() > 3 * DAY);
  const wonQuotes = settled.filter((q) => q.status === "godkand" || q.status === "fakturerad").length;
  const conversion = Math.min(0.8, Math.max(0.25, settled.length ? wonQuotes / settled.length : 0.45));

  const byProduct = new Map<string, { pipeline: number; won: number; designs: number }>();
  const methods = new Map<string, number>();
  const colors = new Map<string, number>();
  const bump = (id: string, k: "pipeline" | "won" | "designs", n: number) => {
    const p = byProduct.get(id) ?? { pipeline: 0, won: 0, designs: 0 };
    p[k] += n;
    byProduct.set(id, p);
  };
  for (const q of quotes) {
    const open = q.status === "skapad" || q.status === "skickad";
    for (const l of q.lines) {
      if (!isNwg(l.productId)) continue;
      bump(l.productId, open ? "pipeline" : "won", l.qty);
      if (l.design) {
        bump(l.productId, "designs", 1);
        for (const p of [l.design, ...(l.design.extra ?? [])]) methods.set(METHOD_INFO[p.method].label, (methods.get(METHOD_INFO[p.method].label) ?? 0) + 1);
      }
      const hex = (l.color ?? BASE_COLOR).toUpperCase();
      colors.set(hex, (colors.get(hex) ?? 0) + 1);
    }
  }
  for (const o of orders.filter((x) => x.source === "demo")) {
    for (const l of o.lines) {
      bump(l.productId, "won", l.qty);
      if (l.method) methods.set(METHOD_INFO[l.method].label, (methods.get(METHOD_INFO[l.method].label) ?? 0) + 1);
    }
  }

  // Twelve weeks of ordered units: real orders on top of a steady demo baseline per brand.
  const weeks = Array.from({ length: 12 }, (_, i) => weekStart(new Date(now - (11 - i) * 7 * DAY)));
  const units = new Map(weeks.map((w, i) => [w, Math.round(380 + 140 * Math.sin(i / 1.9) + (hash(w) % 160) + i * 22)]));
  for (const o of orders) {
    const w = weekStart(new Date(o.createdAt));
    if (units.has(w)) units.set(w, units.get(w)! + o.units);
  }
  const brandUnits = new Map<string, number>();
  for (const o of orders) for (const l of o.lines) brandUnits.set(l.brand, (brandUnits.get(l.brand) ?? 0) + l.qty);
  for (const [id, p] of byProduct) brandUnits.set(NWG_BRANDS[id], (brandUnits.get(NWG_BRANDS[id]) ?? 0) + p.pipeline);

  const available = new Map(items.map((i) => [i.productId, i.stock.reduce((s, x) => s + Math.max(0, x.stock - x.allocated), 0)]));
  const products = items
    .map((i) => {
      const p = byProduct.get(i.productId) ?? { pipeline: 0, won: 0, designs: 0 };
      return { productId: i.productId, name: i.name, brand: i.brand, image: i.image, pipeline: p.pipeline, expected: Math.round(p.pipeline * conversion), won: p.won, designs: p.designs, available: available.get(i.productId) ?? 0 };
    })
    .filter((p) => p.pipeline || p.won || p.designs)
    .sort((a, b) => b.expected + b.won / 4 - (a.expected + a.won / 4));

  const upcoming = quotes
    .filter((q) => (q.status === "skapad" || q.status === "skickad") && q.eventDate && q.eventDate >= iso(new Date()) && q.lines.some((l) => isNwg(l.productId)))
    .map((q) => {
      const nwg = q.lines.filter((l) => isNwg(l.productId));
      return { date: q.eventDate!, units: nwg.reduce((s, l) => s + l.qty, 0), brands: [...new Set(nwg.map((l) => NWG_BRANDS[l.productId]))], status: q.status === "skickad" ? "Offert hos kund" : "Offert skapad" };
    })
    .concat(DEMO_UPCOMING())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);

  return {
    conversion,
    weeks: weeks.map((w) => ({ week: w, units: units.get(w) ?? 0 })),
    brands: [...brandUnits.entries()].map(([brand, n]) => ({ brand, units: n })).sort((a, b) => b.units - a.units),
    methods: [...methods.entries()].map(([method, count]) => ({ method, count })).sort((a, b) => b.count - a.count),
    colors: [...colors.entries()].map(([hex, count]) => ({ hex, color: colorName(hex), count })).sort((a, b) => b.count - a.count).slice(0, 6),
    products,
    upcoming,
  };
}

/* ---------- settings ---------- */

const DEFAULT_SETTINGS: SupplierSettings = {
  company: "New Wave Group (demo)",
  orgnr: "556000-0000",
  contact: "Johanna Lind",
  email: "order.pach@nwg-demo.se",
  phone: "0321-000 00",
  warehouse: "Centrallager, Ulricehamn",
  cutoff: "14:00",
  carrier: "PostNord",
  notify: { orders: true, issues: true, weekly: false },
  edi: false,
  apiKey: "nwg_demo_4f7c2a91e0b84d6c",
};

export const readSettings = () => readJson<SupplierSettings>("settings.json", DEFAULT_SETTINGS).then((s) => ({ ...DEFAULT_SETTINGS, ...s, notify: { ...DEFAULT_SETTINGS.notify, ...s.notify } }));

export async function saveSettings(input: Partial<SupplierSettings> & { rotateKey?: boolean }) {
  const cur = await readSettings();
  const text = (k: keyof SupplierSettings, max = 80) => (typeof input[k] === "string" ? clean(input[k], max) || cur[k] : cur[k]) as string;
  const next: SupplierSettings = {
    company: text("company"),
    orgnr: text("orgnr", 20),
    contact: text("contact"),
    email: text("email"),
    phone: text("phone", 30),
    warehouse: text("warehouse", 120),
    cutoff: typeof input.cutoff === "string" && /^\d{2}:\d{2}$/.test(input.cutoff) ? input.cutoff : cur.cutoff,
    carrier: text("carrier", 30),
    notify: {
      orders: typeof input.notify?.orders === "boolean" ? input.notify.orders : cur.notify.orders,
      issues: typeof input.notify?.issues === "boolean" ? input.notify.issues : cur.notify.issues,
      weekly: typeof input.notify?.weekly === "boolean" ? input.notify.weekly : cur.notify.weekly,
    },
    edi: typeof input.edi === "boolean" ? input.edi : cur.edi,
    apiKey: input.rotateKey ? `nwg_demo_${hash(String(Date.now())).toString(16)}${hash(`${Date.now()}x`).toString(16)}`.slice(0, 25) : cur.apiKey,
  };
  await writeJson("settings.json", next);
  return next;
}
