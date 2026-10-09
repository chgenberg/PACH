import data from "@/data/catalog.json";
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

export const familiesIn = (slug: string) => families.filter((item) => item.shop === slug);

export const familyById = (id: string) => families.find((item) => item.id === id) ?? null;

export const fromPrice = (family: Family) => Math.min(...family.variants.map((item) => item.price));
