import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
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
  const items = familiesIn(shop.slug);

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
      <div className="cat">
        <p className="kicker">{items.length} produkter</p>
        <h1>{shop.name}</h1>
        <p className="lede">{shop.hint}</p>
        <ul className="goods">
          {items.map((item) => (
            <li key={item.id} className="good">
              <div className="good-photo" style={{ background: shop.tone }}>
                <Image src={item.image} alt={item.name} width={760} height={760} sizes="(max-width: 860px) 100vw, 240px" />
                <span className="good-colors">
                  {item.variants.slice(0, 2).map((variant) => (
                    <i key={variant.sku} style={{ background: variant.colorHex }} title={variant.colorName} />
                  ))}
                </span>
              </div>
              <strong>{item.name}</strong>
              <span>{item.subcategory}</span>
              <em>från {item.variants[0] ? Math.round(fromPrice(item)) : 0} kr</em>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
