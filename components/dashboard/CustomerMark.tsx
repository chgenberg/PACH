"use client";

import { useState } from "react";
import { initials } from "@/lib/offerTemplates";

/** The customer's logo when they have a website, else their initials. */
export function CustomerMark({ name, host, size = 40 }: { name: string; host: string | null; size?: number }) {
  const [ok, setOk] = useState(true);
  return (
    <span className={`kd-mark${host && ok ? "" : " is-text"}`} style={{ width: size, height: size }}>
      {host && ok ? (
        // eslint-disable-next-line @next/next/no-img-element -- same-origin logo proxy
        <img src={`/api/brand-logo?host=${host}`} alt="" onError={() => setOk(false)} />
      ) : (
        initials(name)
      )}
    </span>
  );
}
