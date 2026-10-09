import Image from "next/image";
import Link from "next/link";

export function SiteHeader({ back }: { back?: { href: string; label: string } }) {
  return (
    <header className="shop-bar">
      <Link href="/" className="shop-logo" aria-label="PACH">
        <Image src="/PACH_logo.png" alt="PACH profile" width={2198} height={1069} priority />
      </Link>
      <nav className="shop-nav">
        {back ? (
          <Link href={back.href} className="shop-back">
            {back.label}
          </Link>
        ) : null}
        <Link href="/dashboard" className="demo-link">
          Dashboard <span>Demo</span>
        </Link>
      </nav>
    </header>
  );
}
