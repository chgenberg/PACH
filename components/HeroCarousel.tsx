"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export type Slide = { src: string; place: string; product: string; href: string };

const DURATION = 6000;

export function HeroCarousel({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const frame = useRef<HTMLDivElement>(null);
  const touch = useRef<number | null>(null);

  const go = useCallback((n: number) => setI((n + slides.length) % slides.length), [slides.length]);

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => go(i + 1), DURATION);
    return () => clearTimeout(t);
  }, [i, paused, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!frame.current?.matches(":hover, :focus-within")) return;
      if (e.key === "ArrowRight") go(i + 1);
      if (e.key === "ArrowLeft") go(i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, go]);

  const slide = slides[i];

  return (
    <div
      ref={frame}
      className={`hero-car${paused ? " is-paused" : ""}`}
      style={{ "--tx": `${tilt.x}deg`, "--ty": `${tilt.y}deg` } as React.CSSProperties}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => {
        setPaused(false);
        setTilt({ x: 0, y: 0 });
      }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setTilt({ x: ((e.clientY - r.top) / r.height - 0.5) * -4, y: ((e.clientX - r.left) / r.width - 0.5) * 6 });
      }}
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
        touch.current = null;
      }}
      aria-roledescription="karusell"
      aria-label="Våra produkter i verkligheten"
    >
      <div className="hero-car-stage">
        {slides.map((s, n) => (
          <Image
            key={s.src}
            src={s.src}
            alt={`${s.product} med PACH-loggan – ${s.place}`}
            fill
            sizes="(max-width: 860px) 100vw, 58vw"
            priority={n === 0}
            className={n === i ? "is-on" : ""}
          />
        ))}
        <div className="hero-car-shade" aria-hidden />
        <Link href={slide.href} className="hero-car-tag" key={slide.src}>
          <span>{slide.place}</span>
          <b>{slide.product} →</b>
        </Link>
      </div>

      <div className="hero-car-nav">
        <div className="hero-car-dots" role="tablist" aria-label="Välj bild">
          {slides.map((s, n) => (
            <button
              key={s.src}
              type="button"
              role="tab"
              aria-selected={n === i}
              aria-label={`${s.place} – ${s.product}`}
              className={n === i ? "is-on" : ""}
              onClick={() => go(n)}
            >
              <i style={n === i ? { animationDuration: `${DURATION}ms` } : undefined} />
            </button>
          ))}
        </div>
        <div className="hero-car-arrows">
          <button type="button" aria-label="Föregående bild" onClick={() => go(i - 1)}>
            ‹
          </button>
          <button type="button" aria-label="Nästa bild" onClick={() => go(i + 1)}>
            ›
          </button>
        </div>
      </div>
    </div>
  );
}