"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { type CartItem, useCart } from "@/components/CartProvider";
import { familyById } from "@/lib/catalog";
import { BASE_COLOR, colorName, isHex, suggestions } from "@/lib/colors";
import { priceLine, sek } from "@/lib/pricing";

export function ProductDrawer({ productId, baseImage, onClose }: { productId: string; baseImage: string; onClose: () => void }) {
  const cart = useCart();
  const family = familyById(productId);
  const line: CartItem | null = cart.itemOf(productId);
  const swatches = suggestions(cart.brandColor);
  const [color, setColor] = useState((line?.color ?? BASE_COLOR).toUpperCase());
  const [qty, setQty] = useState(line?.qty ?? 50);
  const [shots, setShots] = useState<Record<string, string>>(() => ({
    [BASE_COLOR]: baseImage,
    ...(line?.color && line.image ? { [line.color.toUpperCase()]: line.image } : {}),
  }));
  const [failed, setFailed] = useState("");
  const wanted = useRef(color);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    wanted.current = color;
    if (shots[color]) return;
    const t = setTimeout(async () => {
      setFailed("");
      const res = await fetch("/api/recolor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, hex: color, host: cart.host }),
      }).catch(() => null);
      const json = res ? await res.json().catch(() => ({})) : {};
      if (res?.ok && typeof json.image === "string") setShots((s) => ({ ...s, [color]: json.image }));
      else if (wanted.current === color) setFailed("Kunde inte byta färg just nu. Försök igen.");
    }, 450);
    return () => clearTimeout(t);
  }, [color, shots, productId, cart.host]);

  if (!family) return null;
  const price = priceLine(family, qty);
  const shot = shots[color];
  const loading = !shot && !failed;
  const custom = !swatches.some((s) => s.hex.toUpperCase() === color);

  return (
    <div className="drawer-wrap" role="dialog" aria-modal="true" aria-label={family.name}>
      <button type="button" className="drawer-veil" aria-label="Stäng" onClick={onClose} />
      <aside className="drawer">
        <div className="drawer-head">
          <h2>{family.name}</h2>
          <button type="button" className="drawer-x" onClick={onClose} aria-label="Stäng">
            ×
          </button>
        </div>

        <div className="drawer-photo">
          <Image key={shot ?? shots[BASE_COLOR]} src={shot ?? shots[BASE_COLOR]} alt={`${family.name} i ${colorName(color)}`} width={760} height={760} unoptimized={(shot ?? "").startsWith("/api/")} />
          {loading ? (
            <div className="drawer-busy" role="status">
              <span className="loader-spin" aria-hidden />
              <p>Färgar produkten i {colorName(color).toLowerCase()}…</p>
            </div>
          ) : null}
        </div>

        <p className="drawer-desc">
          {family.subcategory} i {family.material.replace(/;/g, ", ").toLowerCase()}. Tryck med er logga ingår.
        </p>

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
                aria-label={s.name}
                aria-pressed={color === s.hex.toUpperCase()}
                className="swatch"
                style={{ background: s.hex }}
                onClick={() => setColor(s.hex.toUpperCase())}
              />
            ))}
            <label className={`swatch swatch-custom${custom ? " is-on" : ""}`} title="Välj egen färg" style={custom ? { background: color } : undefined}>
              <input
                type="color"
                value={color.toLowerCase()}
                onChange={(e) => isHex(e.target.value) && setColor(e.target.value.toUpperCase())}
                aria-label="Välj egen färg"
              />
            </label>
          </div>
          {failed ? <p className="brandbar-err">{failed}</p> : null}
        </div>

        <div className="drawer-block">
          <p className="drawer-label">Antal</p>
          <div className="stepper">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 10))} aria-label="Färre">
              −
            </button>
            <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
            <button type="button" onClick={() => setQty((q) => q + 10)} aria-label="Fler">
              +
            </button>
          </div>
          <p className="drawer-note">
            {sek(price.unitInclPrint)}/st inkl. tryck · tryckstart {sek(price.setup)}
          </p>
        </div>

        <div className="drawer-foot">
          {line ? (
            <button
              type="button"
              className="drawer-remove"
              onClick={() => {
                cart.remove(productId);
                onClose();
              }}
            >
              Ta bort
            </button>
          ) : null}
          <button
            type="button"
            className="drawer-save"
            disabled={loading}
            onClick={() => {
              cart.save(productId, { qty, color: color === BASE_COLOR ? undefined : color, image: shot });
              onClose();
            }}
          >
            {line ? "Spara" : "Lägg till"} · {sek(price.lineTotal)}
          </button>
        </div>
      </aside>
    </div>
  );
}
