import type { ShopSlug } from "@/lib/shop";

type Hint = {
  category_code?: string | null;
  subcategory?: string | null;
  product_name_sv?: string | null;
};

export function categorizeFamily(row: Hint): ShopSlug {
  const code = row.category_code ?? "";
  const sub = (row.subcategory ?? "").toLowerCase();
  const name = (row.product_name_sv ?? "").toLowerCase();

  if (sub.includes("paraply") || name.includes("paraply")) return "paraplyer";
  if (sub === "penna" || name.includes("penna")) return "pennor";
  if (sub.includes("reflex") || name.includes("reflex")) return "sakerhet";
  if (code === "WORKWEAR" || sub.includes("väst") || name.includes("väst")) return "sakerhet";
  if (code === "EVENT") return "massa-event";
  if (code === "TEXTILE" || code === "HEADWEAR") return "klader";
  if (code === "BAGS") return "vaskor";
  if (code === "TECH") return "elektronik";
  if (code === "FOOD") return "godis";
  if (code === "OFFICE") return "kontor";
  if (code === "ACCESSORIES") return name.includes("nyckel") ? "kontor" : "massa-event";
  if (code === "HOME" || code === "GIFTS") return "massa-event";
  if (code === "DRINKWARE") return "kontor";
  return "kontor";
}
