"use client";

import type { Family } from "@/lib/catalog";
import { estimate, fasterOption, fmtDay, methodLabel } from "@/lib/delivery";
import type { LogoDesign } from "@/lib/marking";

/** "Levereras ca tis 21 okt" – with a check or a warning against the date the customer needs it. */
export function DeliveryNote({ family, design, needBy }: { family: Family; design?: LogoDesign; needBy?: string }) {
  const est = estimate(family, design);
  if (!needBy) {
    return (
      <p className="delivery">
        <span className="delivery-dot" aria-hidden /> Levereras ca {fmtDay(est.date)} med {methodLabel(est.method).toLowerCase()}
      </p>
    );
  }
  if (est.date <= needBy) {
    return (
      <p className="delivery ok">
        <span className="delivery-dot" aria-hidden /> Hinner till {fmtDay(needBy)} – levereras ca {fmtDay(est.date)}
      </p>
    );
  }
  const faster = fasterOption(family, design, needBy);
  return (
    <p className="delivery late">
      <span className="delivery-dot" aria-hidden /> Hinner inte till {fmtDay(needBy)} (ca {fmtDay(est.date)}).
      {faster ? ` Med ${methodLabel(faster.method).toLowerCase()} levereras den ca ${fmtDay(faster.date)}.` : " Kontakta oss för expressproduktion."}
    </p>
  );
}
