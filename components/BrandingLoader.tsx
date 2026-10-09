"use client";

import { useEffect, useState } from "react";

/**
 * Laddningsbanner medan scen och produkter brandas. Servern streamar inte, så stegen följer
 * typiska tider och den faktiska andelen klara bilder – och når 100 % först när allt är klart.
 */
export function BrandingLoader({ name, stages, done, total, complete }: { name: string; stages: string[]; done: number; total: number; complete: boolean }) {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  const elapsed = (now - start) / 1000;
  const byTime = 0.92 * (1 - Math.exp(-elapsed / 40));
  const byWork = total ? (done / total) * 0.96 : 0;
  const progress = complete ? 1 : Math.max(byTime, byWork);
  const line = complete ? "Klart!" : stages[Math.min(stages.length - 1, Math.floor(progress * stages.length))];

  return (
    <div className="loader-veil" role="status" aria-live="polite">
      <div className="loader-card">
        <span className={`loader-spin${complete ? " is-done" : ""}`} aria-hidden />
        <p key={line} className="loader-line">
          {line}
        </p>
        <p className="loader-sub">Vi skapar bilderna med {name}s logga och granskar dem innan du får se dem.</p>
        <div className="loader-bar">
          <div style={{ width: `${(progress * 100).toFixed(1)}%` }} />
        </div>
        <p className="loader-pct">{Math.round(progress * 100)} %</p>
      </div>
    </div>
  );
}
