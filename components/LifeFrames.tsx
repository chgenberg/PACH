"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export type Frame = { src: string; title: string; text: string; href: string; cta: string };

function TiltFrame({ f, wide }: { f: Frame; wide?: boolean }) {
  const [t, setT] = useState({ x: 0, y: 0, mx: 50, my: 50 });
  return (
    <Link
      href={f.href}
      className={`life-frame${wide ? " is-wide" : ""}`}
      style={{ "--tx": `${t.x}deg`, "--ty": `${t.y}deg`, "--mx": `${t.mx}%`, "--my": `${t.my}%` } as React.CSSProperties}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        setT({ x: (py - 0.5) * -5, y: (px - 0.5) * 7, mx: px * 100, my: py * 100 });
      }}
      onMouseLeave={() => setT({ x: 0, y: 0, mx: 50, my: 50 })}
    >
      <span className="life-photo">
        <Image src={f.src} alt={f.title} fill sizes={wide ? "(max-width: 860px) 100vw, 66vw" : "(max-width: 860px) 100vw, 33vw"} />
      </span>
      <span className="life-glare" aria-hidden />
      <span className="life-cap">
        <b>{f.title}</b>
        <small>{f.text}</small>
        <em>{f.cta} →</em>
      </span>
    </Link>
  );
}

export function LifeFrames({ title, kicker, frames }: { title: string; kicker: string; frames: Frame[] }) {
  return (
    <section className="life">
      <div className="life-head">
        <p className="kicker">{kicker}</p>
        <h2>{title}</h2>
      </div>
      <div className="life-grid">
        {frames.map((f, n) => (
          <TiltFrame key={f.src} f={f} wide={n === 0} />
        ))}
      </div>
    </section>
  );
}