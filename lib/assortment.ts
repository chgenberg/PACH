import { SHOPS } from "@/lib/shop";

/** A browse tile: either a real shop or a curated cut of the same demo families. */
export type Assortment = {
  slug: string;
  name: string;
  tone: string;
  ink: string;
  hint: string;
  hero: string;
  wide?: boolean;
  kind: "shop" | "collection";
};

export const COLLECTIONS: Assortment[] = [
  {
    slug: "muggar",
    name: "Muggar",
    tone: "#f3e6d8",
    ink: "#3d2614",
    hint: "Keramik, termos och det som står på skrivbordet",
    hero: "DEMO-P022",
    kind: "collection",
  },
  {
    slug: "halsa",
    name: "Hälsa & Hygien",
    tone: "#dceee4",
    ink: "#173528",
    hint: "Flaskor, handdukar och det som följer med ut",
    hero: "DEMO-P020",
    kind: "collection",
  },
  {
    slug: "sport",
    name: "Sport & Fritid",
    tone: "#dde8f4",
    ink: "#1a2c42",
    hint: "Träning, laget och det som tål väder",
    hero: "DEMO-P008",
    kind: "collection",
  },
  {
    slug: "gavor",
    name: "Gåvor",
    tone: "#f4ddd8",
    ink: "#3d1a16",
    hint: "Något att ge bort, med er logga på",
    hero: "DEMO-P038",
    kind: "collection",
  },
  {
    slug: "hem",
    name: "Hem & Hushåll",
    tone: "#ebe4d4",
    ink: "#332818",
    hint: "Filt, handduk, förkläde och mugg",
    hero: "DEMO-P036",
    kind: "collection",
  },
  {
    slug: "lek",
    name: "Lek & Spel",
    tone: "#e8e0f0",
    ink: "#2c2040",
    hint: "Det som får följa med hem från eventet",
    hero: "DEMO-P034",
    kind: "collection",
  },
];

export const ASSORTMENT: Assortment[] = [
  ...SHOPS.map((s) => ({
    slug: s.slug,
    name: s.name,
    tone: s.tone,
    ink: s.ink,
    hint: s.hint,
    hero: s.hero,
    wide: "wide" in s ? s.wide : undefined,
    kind: "shop" as const,
  })),
  ...COLLECTIONS,
];

export const assortmentOf = (slug: string) => ASSORTMENT.find((item) => item.slug === slug) ?? null;

export const SEARCH_CHIPS = [
  { label: "T-shirt", q: "t-shirt" },
  { label: "Paraply", q: "paraply" },
  { label: "Tygpåse", q: "tygkasse" },
  { label: "Penna", q: "penna" },
  { label: "Mugg", q: "mugg" },
] as const;
