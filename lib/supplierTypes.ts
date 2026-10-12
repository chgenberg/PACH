import type { Method } from "@/lib/marking";

/** The supplier the demo portal is logged in as. */
export const SUPPLIER = { id: "NWG", name: "New Wave Group", short: "NWG" } as const;

/** Which New Wave Group brand supplies each catalogue product in the demo. */
export const NWG_BRANDS: Record<string, string> = {
  "DEMO-P001": "Clique",
  "DEMO-P002": "Clique",
  "DEMO-P003": "Clique",
  "DEMO-P004": "Clique",
  "DEMO-P005": "Clique",
  "DEMO-P006": "Craft",
  "DEMO-P007": "Craft",
  "DEMO-P008": "Craft",
  "DEMO-P009": "Craft",
  "DEMO-P010": "Projob",
  "DEMO-P011": "Printer",
  "DEMO-P012": "Printer",
  "DEMO-P013": "Craft",
  "DEMO-P014": "Printer",
  "DEMO-P015": "Craft",
  "DEMO-P016": "Craft",
  "DEMO-P017": "Printer",
  "DEMO-P018": "Sagaform",
  "DEMO-P019": "Sagaform",
  "DEMO-P020": "Sagaform",
  "DEMO-P021": "Sagaform",
  "DEMO-P022": "Sagaform",
  "DEMO-P023": "Orrefors",
  "DEMO-P029": "Printer",
  "DEMO-P035": "Sagaform",
  "DEMO-P036": "Sagaform",
  "DEMO-P037": "Sagaform",
  "DEMO-P038": "Sagaform",
};

export const isNwg = (productId: string) => productId in NWG_BRANDS;

export const SUPPLIER_STAGES = ["ny", "bekraftad", "i-tryck", "packad", "skickad", "levererad"] as const;
export type SupplierStage = (typeof SUPPLIER_STAGES)[number];
export const SUPPLIER_STAGE_LABEL: Record<SupplierStage, string> = {
  ny: "Ny",
  bekraftad: "Bekräftad",
  "i-tryck": "I tryck",
  packad: "Packad",
  skickad: "Skickad",
  levererad: "Levererad",
};
/** What the supplier presses to move an order on. */
export const NEXT_ACTION: Partial<Record<SupplierStage, string>> = {
  ny: "Bekräfta ordern",
  bekraftad: "Starta tryck",
  "i-tryck": "Markera packad",
  packad: "Markera skickad",
  skickad: "Markera levererad",
};

export const ISSUE_KINDS = ["slut", "tryck", "datum"] as const;
export type IssueKind = (typeof ISSUE_KINDS)[number];
export const ISSUE_LABEL: Record<IssueKind, string> = {
  slut: "Slut i lager",
  tryck: "Går inte att trycka så",
  datum: "Hinner inte till datumet",
};
export type LineIssue = { kind: IssueKind; note: string; replacement?: string; date?: string; at: string; resolved?: boolean };

export type OrderAction =
  | { action: "advance"; note?: string; carrier?: string; tracking?: string }
  | { action: "issue"; productId: string; kind: IssueKind; note: string; replacement?: string; date?: string }
  | { action: "resolve"; productId: string }
  | { action: "propose"; date: string; note?: string }
  | { action: "invoice" };

export type SupplierEvent = { at: string; text: string; stage?: SupplierStage };
export type SupplierInvoice = { number: string; at: string; amount: number; due: string };
export type SupplierOrderState = {
  stage: SupplierStage;
  history: SupplierEvent[];
  /** Flags per product, raised by the supplier and resolved by PACH. */
  issues: Record<string, LineIssue>;
  /** A new delivery date the supplier can manage instead of the requested one. */
  proposedDate?: string;
  carrier?: string;
  tracking?: string;
  invoice?: SupplierInvoice;
};

export type SupplierRow = { sku: string; size: string; qty: number; available: number };
export type SupplierLine = {
  productId: string;
  name: string;
  brand: string;
  image: string;
  qty: number;
  color: string;
  rows: SupplierRow[];
  /** One line per print position, e.g. "Brodyr · 2 färger · Mitt på bröstet · 9 cm". */
  marking: string[];
  method?: Method;
  /** Supplier's price per unit, print per unit and one-off print setup, all to PACH. */
  unit: number;
  printUnit: number;
  printSetup: number;
  total: number;
  proofs: number;
};
export type SupplierOrder = {
  number: string;
  ref: string;
  customer: string;
  city?: string;
  createdAt: string;
  /** When the end customer needs the goods. */
  needBy?: string;
  /** When the goods have to leave the warehouse to make it. */
  shipBy: string;
  lines: SupplierLine[];
  units: number;
  value: number;
  brands: string[];
  source: "pach" | "demo";
  state: SupplierOrderState;
  /** Not shipped and past the ship-by date, or a stock shortfall on an unconfirmed order. */
  late: boolean;
  short: boolean;
};

export type StockItem = { sku: string; productId: string; color: string; size: string; stock: number; allocated: number; restock?: string };
export type ProductTerms = { price: number; moq: number; leadDays: number };
export type MethodTerms = { setupPerColor: number; unitPerColor: number };
export type PriceList = {
  products: Record<string, ProductTerms>;
  methods: Record<Method, MethodTerms>;
  /** Changes the supplier has sent but PACH has not yet accepted. */
  pending: boolean;
  sentAt?: string;
};

export type ContentCheck = { key: string; label: string; ok: boolean };
export type ContentUpload = { image: string; at: string; note?: string };
export type ProductContent = { productId: string; checks: ContentCheck[]; uploads: ContentUpload[] };

export type CatalogItem = {
  productId: string;
  name: string;
  brand: string;
  category: string;
  image: string;
  /** PACH's list price to its customers, for reference. */
  listPrice: number;
  terms: ProductTerms;
  defaultTerms: ProductTerms;
  stock: StockItem[];
  content: ProductContent;
};

export type SupplierSettings = {
  company: string;
  orgnr: string;
  contact: string;
  email: string;
  phone: string;
  warehouse: string;
  cutoff: string;
  carrier: string;
  notify: { orders: boolean; issues: boolean; weekly: boolean };
  edi: boolean;
  apiKey: string;
};

export type DemandPoint = { week: string; units: number };
export type DemandProduct = {
  productId: string;
  name: string;
  brand: string;
  image: string;
  pipeline: number;
  expected: number;
  won: number;
  designs: number;
  available: number;
};
export type Demand = {
  conversion: number;
  weeks: DemandPoint[];
  brands: { brand: string; units: number }[];
  methods: { method: string; count: number }[];
  colors: { color: string; hex: string; count: number }[];
  products: DemandProduct[];
  upcoming: { date: string; units: number; brands: string[]; status: string }[];
};
