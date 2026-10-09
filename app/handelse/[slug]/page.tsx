import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryShop, type ShopItem } from "@/components/CategoryShop";
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
      <header className="shop-bar">
        <Link href="/" className="shop-logo" aria-label="PACH">
          <Image src="/PACH_logo.png" alt="PACH profile" width={2198} height={1069} priority />
        </Link>
        <Link href="/" className="shop-back">
          Tillbaka
        </Link>
      </header>
      <CategoryShop slug={ev.slug} name={ev.name} hint={ev.hint} tone={ev.tone} items={items} />
    </div>
  );
}
