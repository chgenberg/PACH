import { fromPrice, type Family } from "@/lib/catalog";
import { METHOD_INFO, methodsFor } from "@/lib/marking";

export type ShopItem = {
  id: string;
  name: string;
  subcategory: string;
  image: string;
  from: number;
  colors: string[];
  brand?: string;
  methods?: string[];
  colorNames?: string[];
};

export function toShopItem(item: Family): ShopItem {
  return {
    id: item.id,
    name: item.name,
    subcategory: item.subcategory,
    image: item.image,
    from: item.variants[0] ? Math.round(fromPrice(item)) : 0,
    colors: [...new Set(item.variants.map((v) => v.colorHex))].slice(0, 6),
    brand: item.brand,
    methods: methodsFor(item).map((m) => METHOD_INFO[m].label),
    colorNames: [...new Set(item.variants.map((v) => v.colorName))],
  };
}