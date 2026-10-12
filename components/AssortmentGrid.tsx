import Image from "next/image";
import Link from "next/link";
import { ASSORTMENT } from "@/lib/assortment";
import { familyById } from "@/lib/catalog";

export function AssortmentGrid({ title = "Vårt sortiment" }: { title?: string }) {
  return (
    <section className="assort">
      <div className="assort-head">
        <h2 className="mosaic-title">{title}</h2>
        <Link href="/kategorier" className="assort-all">
          A–Ö →
        </Link>
      </div>
      <div className="assort-grid">
        {ASSORTMENT.map((tile) => {
          const src = familyById(tile.hero)?.image;
          return (
            <Link
              key={tile.slug}
              href={`/kategori/${tile.slug}`}
              className={`assort-tile${tile.wide ? " is-wide" : ""}`}
            >
              {src ? <Image className="assort-photo" src={src} alt="" width={720} height={720} sizes="(max-width: 860px) 50vw, 20vw" /> : null}
              <span className="assort-name">{tile.name}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}