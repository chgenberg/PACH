"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/components/CartProvider";
import { FavoriteButton } from "@/components/FavoriteButton";
import { LogoCustomizer } from "@/components/customizer/LogoCustomizer";
import { DeliveryNote } from "@/components/DeliveryNote";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { TryOn } from "@/components/TryOn";
import { useBrandedImage } from "@/lib/brandedImage";
import { familyById } from "@/lib/catalog";
import { BASE_COLOR, colorName, suggestions } from "@/lib/colors";
import { estimate, fmtDay } from "@/lib/delivery";
import { defaultDesign, designSummary, METHOD_INFO, methodsFor, type LogoDesign, type Method, zonesFor } from "@/lib/marking";
import { priceLine, priceMatrix, sek } from "@/lib/pricing";

export function ProductPage({ productId }: { productId: string }) {
  const cart = useCart();
  const router = useRouter();
  const family = familyById(productId);
  const line = cart.itemOf(productId);
  const swatches = suggestions(cart.brandColor);
  const [color, setColor] = useState((line?.color ?? BASE_COLOR).toUpperCase());
  const [qty, setQty] = useState(line?.qty ?? 50);
  const [shots, setShots] = useState<Record<string, string>>(() => ({
    [BASE_COLOR]: family?.image ?? "",
    ...(line?.color && line.image ? { [line.color.toUpperCase()]: line.image } : {}),
  }));
  const [failed, setFailed] = useState("");
  const wanted = useRef(color);
  const [design, setDesign] = useState<LogoDesign | undefined>(line?.design);
  const [preview, setPreview] = useState<string | null>(line?.design && line.image ? line.image : null);
  const [proofs, setProofs] = useState(line?.proofs);
  const [customizing, setCustomizing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [method, setMethod] = useState<Method>(line?.design?.method ?? (family ? methodsFor(family)[0] : "screentryck"));
  const base = useBrandedImage(productId, cart.host, family?.image ?? "", { generate: true });

  const requests = useRef(new Map<string, Promise<string | null>>());
  const ensure = useCallback(
    (hex: string) => {
      const known = requests.current.get(hex);
      if (known) return known;
      const job = fetch("/api/recolor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, hex, host: cart.host }),
      })
        .then(async (res) => {
          const json = await res.json().catch(() => ({}));
          if (!res.ok || typeof json.image !== "string") throw new Error();
          await new Promise((done) => {
            const img = new window.Image();
            img.onload = img.onerror = done;
            img.src = json.image;
          });
          setShots((s) => ({ ...s, [hex]: json.image }));
          return json.image as string;
        })
        .catch(() => {
          requests.current.delete(hex);
          return null;
        });
      requests.current.set(hex, job);
      return job;
    },
    [productId, cart.host],
  );

  useEffect(() => {
    for (const s of suggestions(cart.brandColor)) if (s.hex !== BASE_COLOR) void ensure(s.hex.toUpperCase());
  }, [ensure, cart.brandColor]);

  useEffect(() => {
    wanted.current = color;
    if (shots[color]) return;
    const t = setTimeout(async () => {
      setFailed("");
      const img = await ensure(color);
      if (!img && wanted.current === color) setFailed("Kunde inte byta färg just nu. Försök igen.");
    }, 0);
    return () => clearTimeout(t);
  }, [color, shots, ensure]);

  const activeDesign = useMemo(() => {
    if (!family) return undefined;
    const base = design ?? defaultDesign(family);
    return { ...base, method };
  }, [family, design, method]);

  if (!family) return null;

  const price = priceLine(family, qty, activeDesign);
  const matrix = priceMatrix(family, activeDesign);
  const shot = color === BASE_COLOR ? base : shots[color];
  const photo = preview ?? shot ?? base;
  const delivery = estimate(family, activeDesign);
  const allowed = methodsFor(family);
  const zones = zonesFor(family);
  const moq = Math.min(...family.variants.map((v) => v.moq));

  const addAndGo = (href?: string) => {
    cart.save(productId, { qty, color: color === BASE_COLOR ? undefined : color, image: preview ?? shot, design: activeDesign, proofs: design && design.method === method ? proofs : undefined });
    if (href) router.push(href);
  };

  return (
    <div className="shop">
      <SiteHeader />
      <article className="pdp">
        <div className="pdp-hero">
          <div className="pdp-gal">
            <div className="pdp-photo">
              <Image key={photo} src={photo} alt={`${family.name} i ${colorName(color)}`} width={900} height={900} unoptimized={/^(\/api\/|data:)/.test(photo)} />
              <FavoriteButton id={family.id} name={family.name} />
            </div>
          </div>
          <div className="pdp-buy">
            <p className="kicker">
              {family.brand} · {family.subcategory} · {family.id}
            </p>
            <h1>{family.name}</h1>
            <p className="lede">{family.short}</p>
            <p className="pdp-price">
              {sek(price.unitInclPrint)}
              <small>/st inkl. tryck, exkl. moms</small>
            </p>
            <ul className="pdp-facts">
              <li>Minsta antal {moq} st</li>
              <li>{family.material.replace(/;/g, ", ")}</li>
              <li>Leverans ca {fmtDay(delivery.date)}</li>
            </ul>

            <div className="drawer-block">
              <p className="drawer-label">
                Märkning <span>{METHOD_INFO[method].label}</span>
              </p>
              <div className="pdp-methods">
                {allowed.map((m) => (
                  <button key={m} type="button" className={m === method ? "is-on" : ""} onClick={() => setMethod(m)}>
                    {METHOD_INFO[m].label}
                  </button>
                ))}
              </div>
              <p className="drawer-note">
                {METHOD_INFO[method].blurb}. <Link href={`/tryck/${method}`}>Läs mer om {METHOD_INFO[method].label.toLowerCase()} →</Link>
              </p>
            </div>

            <div className="drawer-block">
              <p className="drawer-label">
                Färg <span>{colorName(color)}</span>
              </p>
              <div className="swatches">
                {swatches.map((s) => (
                  <button
                    key={s.hex}
                    type="button"
                    title={s.name}
                    aria-pressed={color === s.hex.toUpperCase()}
                    className="swatch"
                    style={{ background: s.hex }}
                    onClick={() => {
                      setColor(s.hex.toUpperCase());
                      setPreview(null);
                      setProofs(undefined);
                    }}
                  />
                ))}
              </div>
              {failed ? <p className="brandbar-err">{failed}</p> : null}
            </div>

            <div className="drawer-block">
              <p className="drawer-label">Antal</p>
              <div className="stepper">
                <button type="button" onClick={() => setQty((q) => Math.max(moq, q - 10))} aria-label="Färre">
                  −
                </button>
                <input type="number" min={moq} value={qty} onChange={(e) => setQty(Math.max(moq, Number(e.target.value) || moq))} />
                <button type="button" onClick={() => setQty((q) => q + 10)} aria-label="Fler">
                  +
                </button>
              </div>
            </div>

            <div className="pdp-total">
              <div>
                <span>Totalt för {qty} st</span>
                <b>{sek(price.lineTotal)}</b>
              </div>
              <small>
                {sek(price.unitInclPrint)}/st · tryckstart {sek(price.setup)} · exkl. moms
              </small>
              <DeliveryNote family={family} design={activeDesign} needBy={cart.eventDate} />
            </div>

            <div className="pdp-cta">
              <button type="button" className="drawer-save" onClick={() => addAndGo("/offert")}>
                {line ? "Uppdatera offerten" : "Få offert"}
              </button>
              <button type="button" className="cz-cta" onClick={() => setCustomizing(true)}>
                Anpassa i 3D
              </button>
            </div>
            {saved && line ? (
              <p className="pdp-saved" role="status">
                <span>✓ Designen ligger i offerten</span>
                <Link href="/offert">Visa offerten →</Link>
              </p>
            ) : null}
            {design ? <p className="drawer-note">{designSummary(family, design)}</p> : null}
            <p className="cta-promise">Riktpris. Ordern binds först när ni godkänner offert och 3D-korrektur.</p>

            {family.shop === "klader" && cart.host ? <TryOn productId={productId} host={cart.host} image={base} color={color} /> : null}
          </div>
        </div>

        <section className="pdp-matrix">
          <div className="section-head">
            <h2>Beräkna pris</h2>
            <span>{METHOD_INFO[method].label} · exkl. moms</span>
          </div>
          <div className="pdp-table">
          <table>
            <thead>
              <tr>
                <th>Antal</th>
                <th>Produkt/st</th>
                <th>Tryck/st</th>
                <th>Start</th>
                <th>Totalt</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => (
                <tr key={row.qty} className={row.qty === qty ? "is-on" : ""}>
                  <td>
                    <button type="button" onClick={() => setQty(row.qty)}>
                      {row.qty} st
                    </button>
                  </td>
                  <td>{sek(row.unitProduct)}</td>
                  <td>{sek(row.printPerUnit)}</td>
                  <td>{sek(row.setup)}</td>
                  <td>{sek(row.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>

        <section className="pdp-spec">
          <div>
            <h2>Tryckytor</h2>
            <div className="chip-cloud is-static">
              {zones.map((z) => (
                <span key={z.id}>{z.label}</span>
              ))}
            </div>
          </div>
          <div>
            <h2>Metoder som går</h2>
            <div className="chip-cloud">
              {allowed.map((m) => (
                <Link key={m} href={`/tryck/${m}`}>
                  {METHOD_INFO[m].label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h2>Om produkten</h2>
            <p>{family.description.replace(/^Fiktiv exempelprodukt: /, "")}</p>
            <Link href={`/kategori/${family.shop}`} className="text-link">
              Fler i samma kategori →
            </Link>
          </div>
        </section>
      </article>
      <SiteFooter />

      {customizing ? (
        <LogoCustomizer
          family={family}
          initial={activeDesign ?? defaultDesign(family)}
          color={color}
          qty={qty}
          brandLogo={cart.host ? `/api/brand-logo?host=${encodeURIComponent(cart.host)}` : null}
          brandColor={cart.brandColor}
          needBy={cart.eventDate}
          onClose={() => setCustomizing(false)}
          saveLabel="Spara i offerten"
          onSave={(r) => {
            const units = Math.max(qty, r.design.names?.list.length ?? 0);
            setDesign(r.design);
            setMethod(r.design.method);
            setQty(units);
            setColor(r.color);
            setPreview(r.preview || null);
            setProofs(r.proofs.length ? r.proofs : undefined);
            cart.save(productId, { qty: units, color: r.color === BASE_COLOR ? undefined : r.color, image: r.preview || (r.color === BASE_COLOR ? base : shots[r.color]), design: r.design, proofs: r.proofs.length ? r.proofs : undefined });
            setSaved(true);
            setCustomizing(false);
          }}
        />
      ) : null}
    </div>
  );
}