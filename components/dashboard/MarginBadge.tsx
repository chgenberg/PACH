import { sek } from "@/lib/pricing";

/** Contribution and margin, coloured so a thin or negative margin stands out. */
export function MarginBadge({ tb, pct, compact = false }: { tb: number; pct: number; compact?: boolean }) {
  const tone = tb < 0 ? "is-neg" : pct < 20 ? "is-thin" : "is-ok";
  return (
    <span className={`kp-margin ${tone}`}>
      {compact ? null : <b>{sek(tb)}</b>} {pct} %
    </span>
  );
}
