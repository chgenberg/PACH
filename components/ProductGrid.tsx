import Link from "next/link";
import { BrandedPhoto } from "@/components/BrandedPhoto";
import { FavoriteButton } from "@/components/FavoriteButton";
import { fromPrice, type Family } from "@/lib/catalog";
import { sek } from "@/lib/pricing";

export function ProductGrid({ items }: { items: Family[] }) {
  return (
    <ul className="pgrid">
      {items.map((f) => (
        <li key={f.id} className="pcard">
          <Link href={`/p/${f.id}`} className="pcard-link">
            <span className="pcard-photo">
              <BrandedPhoto productId={f.id} src={f.image} alt={f.name} width={480} height={480} sizes="(max-width: 860px) 50vw, 240px" />
            </span>
            <strong>{f.name}</strong>
            <span>{f.subcategory}</span>
            <em>Från {sek(fromPrice(f))} exkl. moms</em>
          </Link>
          <FavoriteButton id={f.id} name={f.name} compact />
        </li>
      ))}
    </ul>
  );
}