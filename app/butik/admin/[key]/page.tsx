import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StoreAdmin } from "@/components/StoreAdmin";
import { getStoreByAdminKey, storeTotals } from "@/lib/campaigns";
import { priceQuote } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Butiksadmin – PACH", robots: { index: false, follow: false } };

export default async function StoreAdminPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const c = await getStoreByAdminKey(key);
  if (!c) notFound();
  const spent = c.orders.reduce((s, o) => s + o.total, 0);
  const totals = storeTotals(c);
  // What the combined order actually costs, with one print setup per product.
  const estimate = priceQuote(totals.map((t) => ({ productId: t.productId, qty: t.total, design: c.products.find((p) => p.productId === t.productId)?.design }))).total;
  return (
    <StoreAdmin
      adminKey={key}
      title={c.title}
      storePath={`/butik/${c.token}`}
      budget={c.budget ?? 0}
      sentRef={c.ref ?? null}
      spent={spent}
      orders={c.orders.map((o) => ({ id: o.id, at: o.at, name: o.name, email: o.email, total: o.total, items: o.items }))}
      totals={totals}
      estimate={estimate}
      productCount={c.products.length}
    />
  );
}
