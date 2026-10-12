"use client";

import Link from "next/link";
import { PageHero } from "@/components/PageHero";
import { ProductGrid } from "@/components/ProductGrid";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { familyById } from "@/lib/catalog";
import { useFavorites } from "@/lib/favorites";

export default function FavoritesPage() {
  const fav = useFavorites();
  const items = fav.ids.map((id) => familyById(id)).filter((f): f is NonNullable<typeof f> => Boolean(f));

  return (
    <div className="shop">
      <SiteHeader />
      <article className="prose-page">
        <PageHero kicker="Favoriter" title="Sparat hos er" lede={items.length ? `${items.length} ${items.length === 1 ? "produkt" : "produkter"}, sparade i den här webbläsaren.` : undefined} />
        {fav.ready && !items.length ? (
          <div className="empty">
            <b>Inget sparat än.</b>
            <p>Tryck på hjärtat på en produkt så hamnar den här.</p>
            <Link href="/kategorier" className="btn-dark">
              Se sortimentet
            </Link>
          </div>
        ) : (
          <ProductGrid items={items} />
        )}
      </article>
      <SiteFooter />
    </div>
  );
}