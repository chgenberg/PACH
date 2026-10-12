import data from "@/data/catalog.json";
import { assortmentOf } from "@/lib/assortment";
import type { ShopSlug } from "@/lib/shop";

export type Variant = {
  sku: string;
  colorName: string;
  colorHex: string;
  size: string;
  price: number;
  moq: number;
};

export type Family = {
  id: string;
  supplierId: string;
  brand: string;
  name: string;
  short: string;
  description: string;
  catalogCode: string;
  subcategory: string;
  material: string;
  shop: ShopSlug;
  decorationId: string;
  image: string;
  variants: Variant[];
};

export const families = data.families as Family[];

const COLLECTION_MATCH: Record<string, (f: Family) => boolean> = {
  muggar: (f) => /mugg/i.test(`${f.subcategory} ${f.name}`),
  halsa: (f) => /flaska|handduk|reflex/i.test(`${f.subcategory} ${f.name}`),
  sport: (f) => /sport|softshell|fleece|buff|funktions|sportväska|sportbag|skaljacka/i.test(`${f.subcategory} ${f.name}`),
  gavor: (f) => /present|choklad/i.test(`${f.subcategory} ${f.name}`) || f.shop === "godis",
  hem: (f) => /filt|handduk|förkläde|mugg|flaska/i.test(`${f.subcategory} ${f.name}`),
  lek: (f) => /högtalare|present|choklad|picknick/i.test(`${f.subcategory} ${f.name}`),
};

export const familiesIn = (slug: string) => families.filter((item) => item.shop === slug);

export const familiesForAssortment = (slug: string) => {
  const tile = assortmentOf(slug);
  if (!tile) return [];
  if (tile.kind === "shop") return familiesIn(slug);
  return families.filter(COLLECTION_MATCH[slug] ?? (() => false));
};

export const familyById = (id: string) => families.find((item) => item.id === id) ?? null;

export const fromPrice = (family: Family) => Math.min(...family.variants.map((item) => item.price));

export const moqOf = (family: Family) => Math.min(...family.variants.map((item) => item.moq));

export const searchFamilies = (q: string) => {
  const n = q.trim().toLowerCase();
  if (!n) return [];
  return families.filter((f) => [f.name, f.subcategory, f.brand, f.short, f.material, f.shop].join(" ").toLowerCase().includes(n));
};

/** Subcategories A–Ö with product counts, plus every family. */
export function catalogIndex() {
  const groups = new Map<string, Family[]>();
  for (const f of families) {
    const list = groups.get(f.subcategory) ?? [];
    list.push(f);
    groups.set(f.subcategory, list);
  }
  const categories = [...groups.entries()]
    .map(([name, list]) => ({ name, count: list.length, href: `/sok?q=${encodeURIComponent(name)}` }))
    .sort((a, b) => a.name.localeCompare(b.name, "sv"));
  const products = [...families].sort((a, b) => a.name.localeCompare(b.name, "sv"));
  return { categories, products };
}
