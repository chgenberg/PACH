/**
 * PACH:s leverantörer och avtalsvillkor (demo). New Wave Group har leverantörsportalen; de andra
 * får inköpsordrar som PDF via e-post. Datum anges i dagar från i dag så att demon alltid ser aktuell ut.
 */

export type Integration = "portal" | "email";

export type SupplierProfile = {
  id: string;
  name: string;
  short: string;
  /** Brand colour of the supplier's mark in the list. */
  mark: string;
  integration: Integration;
  categories: string;
  contact: { name: string; role: string; email: string; phone: string };
  terms: {
    payment: string;
    paymentDays: number;
    freight: string;
    minOrder: number;
    leadTime: string;
    print: string;
    returns: string;
    bonus: string;
    /** Days from today until the agreement ends. */
    contractDays: number;
    /** Days since the last price list arrived. */
    priceListAge: number;
  };
  /** Share of orders delivered on the promised day, last 12 months. */
  onTime: number;
  note?: string;
};

export const SUPPLIER_PROFILES: SupplierProfile[] = [
  {
    id: "NWG",
    name: "New Wave Group",
    short: "NWG",
    mark: "#0b2545",
    integration: "portal",
    categories: "Kläder, väskor, dryckesflaskor och presenter – Clique, Craft, Printer, Projob, Sagaform, Orrefors",
    contact: { name: "Johanna Lind", role: "Key account PACH", email: "order.pach@nwg-demo.se", phone: "0321-000 00" },
    terms: {
      payment: "30 dagar netto",
      paymentDays: 30,
      freight: "Fritt över 3 000 kr, annars 190 kr per order",
      minOrder: 1000,
      leadTime: "5–11 arbetsdagar inkl. tryck",
      print: "Eget tryckeri – brodyr, transfer, screen och gravyr",
      returns: "Reklamation inom 14 dagar, feltryck ersätts kostnadsfritt",
      bonus: "3 % volymbonus över 500 000 kr per år",
      contractDays: 240,
      priceListAge: 40,
    },
    onTime: 0.96,
  },
  {
    id: "DEMO-S02",
    name: "Demo Profile Goods",
    short: "DPG",
    mark: "#8d3d2c",
    integration: "email",
    categories: "Pennor, anteckningsböcker, nyckelband, reflexer och kontor",
    contact: { name: "Mikael Ström", role: "Orderkontor", email: "order@demoprofilegoods.se", phone: "031-000 00 00" },
    terms: {
      payment: "30 dagar netto",
      paymentDays: 30,
      freight: "Fritt över 5 000 kr, annars 245 kr per order",
      minOrder: 2000,
      leadTime: "8–12 arbetsdagar inkl. tryck",
      print: "Tryck via partner – screen, tampong och gravyr",
      returns: "Reklamation inom 8 dagar",
      bonus: "Ingen bonus – fasta nettopriser",
      contractDays: 38,
      priceListAge: 290,
    },
    onTime: 0.91,
    note: "Bekräftar ordrar per e-post inom ett dygn.",
  },
  {
    id: "DEMO-S03",
    name: "Demo Tech & Gift",
    short: "DTG",
    mark: "#2f5d46",
    integration: "email",
    categories: "Elektronik, choklad, presentaskar och mässmaterial",
    contact: { name: "Sara Holm", role: "Säljsupport", email: "sales@demotechgift.se", phone: "08-000 00 00" },
    terms: {
      payment: "20 dagar netto, förskott på mässmaterial",
      paymentDays: 20,
      freight: "Fast frakt 350 kr per order",
      minOrder: 3000,
      leadTime: "10–15 arbetsdagar, choklad 6 dagar",
      print: "Gravyr och digitaltryck i eget hus",
      returns: "Elektronik: 2 års garanti, reklamation inom 14 dagar",
      bonus: "2 % vid mer än 200 000 kr per kvartal",
      contractDays: 400,
      priceListAge: 60,
    },
    onTime: 0.88,
    note: "Choklad skickas bara mån–ons för att inte bli liggande över helgen.",
  },
];

export const profileById = (id: string) => SUPPLIER_PROFILES.find((s) => s.id === id) ?? null;

export type SupplierActionTone = "urgent" | "normal" | "info";
export type SupplierActionCta = { label: string; kind: string; payload?: Record<string, string> } | { label: string; href: string };
export type SupplierAction = { id: string; tone: SupplierActionTone; title: string; detail: string; cta?: SupplierActionCta; secondary?: { label: string; href: string } };

export type SupplierOrderRow = { key: string; ref: string; customer: string; date: string; units: number; value: number; status: string; href?: string };

export type SupplierView = {
  profile: SupplierProfile;
  contractUntil: string;
  priceListDate: string;
  products: { id: string; name: string; image: string }[];
  openOrders: number;
  spend90: number;
  orders: SupplierOrderRow[];
  actions: SupplierAction[];
};
