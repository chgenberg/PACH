import { families, moqOf } from "@/lib/catalog";
import { type CostTable, defaultMethodTerms, defaultUnitCost } from "@/lib/costing";
import { priceList } from "@/lib/supplier";
import { SUPPLIER_PROFILES, profileById } from "@/lib/supplierProfiles";
import { isNwg, SUPPLIER } from "@/lib/supplierTypes";

/** Purchase price, minimum quantity and print prices per product, from each supplier's current price list. */
export async function costTable(): Promise<CostTable> {
  const nwg = await priceList();
  const products: CostTable["products"] = {};
  for (const f of families) {
    const supplierId = isNwg(f.id) ? SUPPLIER.id : f.supplierId;
    const profile = profileById(supplierId);
    const terms = isNwg(f.id) ? nwg.products[f.id] : undefined;
    products[f.id] = {
      productId: f.id,
      supplierId,
      supplierName: profile?.name ?? f.brand,
      unitCost: terms?.price ?? defaultUnitCost(f),
      moq: terms?.moq ?? moqOf(f),
      minOrder: profile?.terms.minOrder ?? 0,
    };
  }
  const methods: CostTable["methods"] = Object.fromEntries(SUPPLIER_PROFILES.map((p) => [p.id, p.id === SUPPLIER.id ? nwg.methods : defaultMethodTerms()]));
  return { products, methods };
}
