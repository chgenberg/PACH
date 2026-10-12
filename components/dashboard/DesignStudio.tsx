"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/components/CartProvider";
import { type CustomizerResult, LogoCustomizer } from "@/components/customizer/LogoCustomizer";
import { useBrandbook } from "@/components/dashboard/brandbook";
import { families, familyById, moqOf } from "@/lib/catalog";
import { BASE_COLOR } from "@/lib/colors";
import { defaultDesign } from "@/lib/marking";

/** The public 3D editor, embedded in the dashboard with the brandbook logo and a product chooser. */
export function DesignStudio() {
  const { book } = useBrandbook();
  const cart = useCart();
  const router = useRouter();
  const [productId, setProductId] = useState(families[0].id);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const family = familyById(productId) ?? families[0];
  const qty = Math.max(50, moqOf(family));
  const q = query.trim().toLowerCase();
  const hits = q ? families.filter((f) => `${f.name} ${f.subcategory} ${f.brand}`.toLowerCase().includes(q)) : families;

  const choose = (id: string) => {
    setProductId(id);
    setPicking(false);
    setQuery("");
  };

  const toQuote = (r: CustomizerResult) => {
    cart.save(family.id, {
      qty: Math.max(qty, r.design.names?.list.length ?? 0),
      color: r.color === BASE_COLOR ? undefined : r.color,
      image: r.preview || undefined,
      design: r.design,
      proofs: r.proofs.length ? r.proofs : undefined,
    });
    router.push("/offert");
  };

  const exportImage = (r: CustomizerResult) => {
    if (!r.preview) return;
    const a = document.createElement("a");
    a.href = r.preview;
    a.download = `${family.name}-${book.company.name || "PACH"}.png`.replace(/\s+/g, "-");
    a.click();
  };

  const picker = (
    <div className="ds-pick">
      <p className="drawer-label">
        Produkt <span>{families.length} st</span>
      </p>
      <button type="button" className="ds-current" onClick={() => setPicking((p) => !p)} aria-expanded={picking}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={family.image} alt="" />
        <span>
          <b>{family.name}</b>
          <small>{family.subcategory}</small>
        </span>
        <em>{picking ? "Stäng" : "Byt"}</em>
      </button>
      {picking ? (
        <>
          <input className="ds-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Sök produkt" aria-label="Sök produkt" autoFocus />
          <div className="ds-grid">
            {hits.map((f) => (
              <button key={f.id} type="button" aria-pressed={f.id === family.id} onClick={() => choose(f.id)} title={f.name}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.image} alt="" loading="lazy" />
                <span>{f.name}</span>
              </button>
            ))}
            {hits.length ? null : <p className="drawer-note">Inga produkter matchar.</p>}
          </div>
        </>
      ) : null}
    </div>
  );

  return (
    <LogoCustomizer
      key={family.id}
      family={family}
      initial={defaultDesign(family)}
      color={BASE_COLOR}
      qty={qty}
      brandLogo={book.brand.logo || null}
      brandColor={book.brand.colors[0]}
      onSave={toQuote}
      onExport={exportImage}
      picker={picker}
      saveLabel="Lägg i offert"
    />
  );
}
