import { notFound } from "next/navigation";
import { CategoryShop } from "@/components/CategoryShop";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { EVENT_IDS, eventOf, familiesForEvent } from "@/lib/events";
import { toShopItem } from "@/lib/shopItem";

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
  const items = familiesForEvent(ev.slug).map(toShopItem);

  return (
    <div className="shop">
      <SiteHeader />
      <CategoryShop slug={ev.slug} name={ev.name} hint={ev.hint} scene={ev.scene}
        stages={ev.stages}
        photos={ev.photos.map((p) => ({ product: p.product, caption: p.caption }))}
        items={items}
      />
      <SiteFooter />
    </div>
  );
}
