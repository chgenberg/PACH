import type { ReactNode } from "react";

export function PageHero({ kicker, title, lede, children }: { kicker: string; title: string; lede?: ReactNode; children?: ReactNode }) {
  return (
    <header className="page-hero">
      <p className="kicker">{kicker}</p>
      <h1>{title}</h1>
      {lede ? <p className="lede">{lede}</p> : null}
      {children}
    </header>
  );
}