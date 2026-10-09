import { notFound } from "next/navigation";
import { CategoryShop, type ShopItem } from "@/components/CategoryShop";
import { SiteHeader } from "@/components/SiteHeader";
import { fromPrice } from "@/lib/catalog";
import { EVENT_IDS, eventOf, familiesForEvent } from "@/lib/events";

export function generateStaticParams() {
  return EVENT_IDS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const ev = eventOf((await params).slug);
  return { title: ev ? `${ev.name} – PACH` : "PACH" };
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const ev = eventOf((await params).slug);
  if (!ev) notFound();
  const items: ShopItem[] = familiesForEvent(ev.slug).map((item) => ({
    id: item.id,
    name: item.name,
    subcategory: item.subcategory,
    image: item.image,
    from: item.variants[0] ? Math.round(fromPrice(item)) : 0,
    colors: item.variants.slice(0, 3).map((v) => v.colorHex),
  }));

  return (
    <div className="shop">
      <SiteHeader back={{ href: "/", label: "Tillbaka" }} />
      <CategoryShop slug={ev.slug} name={ev.name} hint={ev.hint} tone={ev.tone} scene={ev.scene}
        stages={ev.stages}
        photos={ev.photos.map((p) => ({ product: p.product, caption: p.caption }))}
        items={items}
      />
    </div>
  );
}
