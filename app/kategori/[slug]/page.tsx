import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryShop, type ShopItem } from "@/components/CategoryShop";
import { familiesIn, fromPrice } from "@/lib/catalog";
import { SHOPS, shopOf } from "@/lib/shop";

export function generateStaticParams() {
  return SHOPS.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const shop = shopOf((await params).slug);
  return { title: shop ? `${shop.name} – PACH` : "PACH" };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const shop = shopOf((await params).slug);
  if (!shop) notFound();
  const items: ShopItem[] = familiesIn(shop.slug).map((item) => ({
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
      <CategoryShop
        slug={shop.slug}
        name={shop.name}
        hint={shop.hint}
        tone={shop.tone}
        scene="/scenes/hero.jpg"
        stages={["Lägger er logga på produkterna…", "Kvalitetsgranskar bilderna…", "Sista detaljerna…"]}
        items={items}
      />
    </div>
  );
}
