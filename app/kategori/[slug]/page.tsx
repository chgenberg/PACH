import { notFound } from "next/navigation";
import { CategoryShop } from "@/components/CategoryShop";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { ASSORTMENT, assortmentOf } from "@/lib/assortment";
import { familiesForAssortment } from "@/lib/catalog";
import { toShopItem } from "@/lib/shopItem";

export function generateStaticParams() {
  return ASSORTMENT.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const shop = assortmentOf((await params).slug);
  return { title: shop ? `${shop.name} – PACH` : "PACH" };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const shop = assortmentOf((await params).slug);
  if (!shop) notFound();
  const items = familiesForAssortment(shop.slug).map(toShopItem);

  return (
    <div className="shop">
      <SiteHeader />
      <CategoryShop
        slug={shop.slug}
        name={shop.name}
        hint={shop.hint}
        scene="/scenes/hero.jpg"
        sceneEvent="hero"
        stages={["Lägger er logga på produkterna…", "Kvalitetsgranskar bilderna…", "Sista detaljerna…"]}
        items={items}
      />
      <SiteFooter />
    </div>
  );
}