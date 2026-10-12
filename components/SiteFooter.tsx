import Link from "next/link";
import { ASSORTMENT } from "@/lib/assortment";

export function SiteFooter() {
  return (
    <footer className="site-foot">
      <div className="site-foot-grid">
        <div>
          <p className="kicker">PACH</p>
          <p>Profilprodukter med er logga. Skriftlig offert och 3D-korrektur innan något är bindande.</p>
          <p className="site-foot-meta">Alla priser exkl. moms.</p>
        </div>
        <div>
          <p className="kicker">Sortiment</p>
          <ul>
            {ASSORTMENT.slice(0, 8).map((s) => (
              <li key={s.slug}>
                <Link href={`/kategori/${s.slug}`}>{s.name}</Link>
              </li>
            ))}
            <li>
              <Link href="/kategorier">A–Ö</Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="kicker">Hjälp</p>
          <ul>
            <li>
              <Link href="/tryck">Tryckmetoder</Link>
            </li>
            <li>
              <Link href="/support">Kundsupport</Link>
            </li>
            <li>
              <Link href="/garanti">Garanti</Link>
            </li>
            <li>
              <Link href="/om">Om PACH</Link>
            </li>
            <li>
              <Link href="/inspiration">Inspiration</Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="kicker">Kontakt</p>
          <ul>
            <li>
              <a href="tel:+46800000000">08-000 00 00</a>
            </li>
            <li>
              <a href="mailto:hej@pach.se">hej@pach.se</a>
            </li>
            <li>Mån–fre 08–17</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}