"use client";

import { type MouseEvent, useState } from "react";
import type { Proof, ProofPin } from "@/lib/quoteTypes";

export type PinNote = { n: number; pin: ProofPin; text: string; by: string };

/** The 3D proof renders for one line: a large view, one thumbnail per print and optional comment pins. */
export function ProofGallery({
  proofs,
  name,
  pins = [],
  pending,
  onPin,
}: {
  proofs: Proof[];
  name: string;
  pins?: PinNote[];
  pending?: ProofPin | null;
  onPin?: (pin: ProofPin) => void;
}) {
  const [at, setAt] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const cur = Math.min(at, proofs.length - 1);
  const proof = proofs[cur];
  if (!proof) return null;

  const place = (e: MouseEvent<HTMLDivElement>) => {
    if (!onPin) return;
    const r = e.currentTarget.getBoundingClientRect();
    onPin({ proof: cur, x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
  };

  return (
    <div className="proofs">
      <div className={`proofs-main${onPin ? " is-pinnable" : ""}`} onClick={place} role={onPin ? "button" : undefined} aria-label={onPin ? "Klicka för att kommentera en punkt" : undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL proof */}
        <img src={proof.image} alt={`3D-korrektur: ${name}, ${proof.label}`} />
        {pins
          .filter((p) => p.pin.proof === cur)
          .map((p) => (
            <button
              key={p.n}
              type="button"
              className={`proof-pin${open === p.n ? " is-open" : ""}`}
              style={{ left: `${p.pin.x * 100}%`, top: `${p.pin.y * 100}%` }}
              onClick={(e) => {
                e.stopPropagation();
                setOpen((o) => (o === p.n ? null : p.n));
              }}
              aria-label={`Kommentar ${p.n}: ${p.text}`}
            >
              {p.n}
              {open === p.n ? (
                <span className="proof-pin-note">
                  <b>{p.by}</b> {p.text}
                </span>
              ) : null}
            </button>
          ))}
        {pending && pending.proof === cur ? <span className="proof-pin is-pending" style={{ left: `${pending.x * 100}%`, top: `${pending.y * 100}%` }} aria-hidden /> : null}
        <span className="proofs-label">{proof.label}</span>
        {onPin ? <span className="proofs-hint">Klicka på bilden för att kommentera en punkt</span> : null}
      </div>
      {proofs.length > 1 ? (
        <div className="proofs-thumbs" role="tablist" aria-label={`Vyer för ${name}`}>
          {proofs.map((p, i) => (
            <button key={p.label + i} type="button" role="tab" aria-selected={i === cur} onClick={() => setAt(i)} title={p.label}>
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL proof */}
              <img src={p.image} alt="" />
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
