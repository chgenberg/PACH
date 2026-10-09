"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { type CartItem, useCart } from "@/components/CartProvider";
import { familyById } from "@/lib/catalog";
import { BASE_COLOR, colorName, isHex, suggestions } from "@/lib/colors";
import { LogoCustomizer } from "@/components/customizer/LogoCustomizer";
import { defaultDesign, designSummary, type LogoDesign } from "@/lib/marking";
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
  const [design, setDesign] = useState<LogoDesign | undefined>(line?.design);
  const [preview, setPreview] = useState<string | null>(line?.design && line.image ? line.image : null);
  const [customizing, setCustomizing] = useState(false);
  const pickColor = (hex: string) => {
    setColor(hex);
    setPreview(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const requests = useRef(new Map<string, Promise<string | null>>());

  /** One request per colour; the image is preloaded so switching to it is instant. */
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

  // The standard colours are fetched as soon as the drawer opens.
  useEffect(() => {
    for (const s of suggestions(cart.brandColor)) if (s.hex !== BASE_COLOR) void ensure(s.hex.toUpperCase());
  }, [ensure, cart.brandColor]);

  useEffect(() => {
    wanted.current = color;
    if (shots[color]) return;
    const standard = suggestions(cart.brandColor).some((s) => s.hex.toUpperCase() === color);
    const t = setTimeout(
      async () => {
        setFailed("");
        const img = await ensure(color);
        if (!img && wanted.current === color) setFailed("Kunde inte byta färg just nu. Försök igen.");
      },
      standard ? 0 : 450,
    );
    return () => clearTimeout(t);
  }, [color, shots, ensure, cart.brandColor]);

  if (!family) return null;
  const price = priceLine(family, qty, design);
  const shot = shots[color];
  const loading = !preview && !shot && !failed;
  const photo = preview ?? shot ?? shots[BASE_COLOR];
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
          <Image key={photo} src={photo} alt={`${family.name} i ${colorName(color)}`} width={760} height={760} unoptimized={/^(\/api\/|data:)/.test(photo)} />
          {loading ? (
            <div className="drawer-busy" role="status">
              <span className="loader-spin" aria-hidden />
              <p>Färgar produkten i {colorName(color).toLowerCase()}…</p>
            </div>
          ) : null}
        </div>

        <div className="drawer-block cz-cta-row">
          <button type="button" className="cz-cta" onClick={() => setCustomizing(true)}>
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M12 2l9 5v10l-9 5-9-5V7z M12 22V12 M21 7l-9 5-9-5" />
            </svg>
            {design ? "Ändra logga i 3D" : "Anpassa logga i 3D"}
          </button>
          {design ? <p className="drawer-note">{designSummary(family, design)}</p> : <p className="drawer-note">Välj form, märkmetod, färger och placering – och snurra produkten.</p>}
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
                onClick={() => pickColor(s.hex.toUpperCase())}
              />
            ))}
            <label className={`swatch swatch-custom${custom ? " is-on" : ""}`} title="Välj egen färg" style={custom ? { background: color } : undefined}>
              <input
                type="color"
                value={color.toLowerCase()}
                onChange={(e) => isHex(e.target.value) && pickColor(e.target.value.toUpperCase())}
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
              cart.save(productId, { qty, color: color === BASE_COLOR ? undefined : color, image: preview ?? shot, design });
              onClose();
            }}
          >
            {line ? "Spara" : "Lägg till"} · {sek(price.lineTotal)}
          </button>
        </div>
      </aside>

      {customizing ? (
        <LogoCustomizer
          family={family}
          initial={design ?? defaultDesign(family)}
          color={color}
          qty={qty}
          brandLogo={cart.host ? `/api/brand-logo?host=${encodeURIComponent(cart.host)}` : null}
          brandColor={cart.brandColor}
          onClose={() => setCustomizing(false)}
          onSave={(r) => {
            setDesign(r.design);
            setColor(r.color);
            setPreview(r.preview || null);
            setCustomizing(false);
          }}
        />
      ) : null}
    </div>
  );
}
