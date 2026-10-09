"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildLogoArt, type LogoArt } from "@/components/customizer/logoArt";
import { ProductScene, type SceneApi } from "@/components/customizer/ProductScene";
import type { Family } from "@/lib/catalog";
import { colorName, suggestions } from "@/lib/colors";
import { colorsOf, sizeCmFor, type LogoDesign, markingPrice, maxSizeCm, METHOD_INFO, methodsFor, SHAPE_LABEL, SHAPES, type Shape, zonesFor } from "@/lib/marking";
import { sek } from "@/lib/pricing";

export type CustomizerResult = { design: LogoDesign; color: string; preview: string };

const SHAPE_ICON: Record<Shape, string> = {
  original: "M4 8h16M4 12h10M4 16h13",
  rund: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z",
  kvadrat: "M5 5h14v14H5z",
  rektangel: "M3 8h18v8H3z",
};

function fallbackKind(f: Family): "box" | "cylinder" | "shirt" {
  if (/mugg|flaska|penna/i.test(f.name)) return "cylinder";
  if (f.shop === "klader") return "shirt";
  return "box";
}

export function LogoCustomizer({
  family,
  initial,
  color: initialColor,
  qty,
  brandLogo,
  brandColor,
  onSave,
  onClose,
}: {
  family: Family;
  initial: LogoDesign;
  color: string;
  qty: number;
  brandLogo: string | null;
  brandColor?: string;
  onSave: (r: CustomizerResult) => void;
  onClose: () => void;
}) {
  const [design, setDesign] = useState<LogoDesign>(initial);
  const [color, setColor] = useState(initialColor);
  const [art, setArt] = useState<LogoArt | null>(null);
  const [modelUrl, setModelUrl] = useState<string | null | undefined>(undefined);
  const [logoSite, setLogoSite] = useState("");
  const api = useRef<SceneApi | null>(null);
  const zones = useMemo(() => zonesFor(family), [family]);
  const methods = methodsFor(family);
  const info = METHOD_INFO[design.method];
  const price = markingPrice(design, qty);
  const logo = design.logo ?? brandLogo;
  const set = (patch: Partial<LogoDesign>) => setDesign((d) => ({ ...d, ...patch }));

  useEffect(() => {
    const url = `/models/${family.id}.glb`;
    let live = true;
    fetch(url, { method: "HEAD" })
      .then((r) => live && setModelUrl(r.ok ? url : null))
      .catch(() => live && setModelUrl(null));
    return () => {
      live = false;
    };
  }, [family.id]);

  useEffect(() => {
    let live = true;
    buildLogoArt(logo, design, color).then((a) => live && setArt(a));
    return () => {
      live = false;
    };
  }, [logo, design, color]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onReady = useCallback((a: SceneApi) => {
    api.current = a;
  }, []);

  const upload = (file: File | undefined) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => typeof r.result === "string" && set({ logo: r.result });
    r.readAsDataURL(file);
  };

  const save = () => {
    const preview = api.current?.capture() ?? "";
    onSave({ design, color, preview });
  };

  return (
    <div className="cz-wrap" role="dialog" aria-modal="true" aria-label={`Anpassa logga på ${family.name}`}>
      <button type="button" className="drawer-veil" aria-label="Stäng" onClick={onClose} />
      <div className="cz">
        <div className="cz-stage">
          {modelUrl === undefined ? null : (
            <ProductScene
              modelUrl={modelUrl}
              fallback={fallbackKind(family)}
              color={color}
              design={design}
              zones={zones}
              sizeCm={sizeCmFor(family)}
              art={art}
              onReady={onReady}
              onPlace={(p) => set({ zone: "egen", point: [p.point.x, p.point.y, p.point.z], normal: [p.normal.x, p.normal.y, p.normal.z] })}
            />
          )}
          <p className="cz-hint">Dra för att snurra · scrolla för att zooma · klicka på produkten för att placera loggan</p>
        </div>

        <aside className="cz-panel">
          <div className="drawer-head cz-head">
            <div>
              <p className="kicker">Anpassa logga</p>
              <h2>{family.name}</h2>
            </div>
            <button type="button" className="drawer-x" onClick={onClose} aria-label="Stäng">
              ×
            </button>
          </div>

          <section className="cz-sec">
            <p className="drawer-label">Logga</p>
            <div className="cz-logo">
              {/* eslint-disable-next-line @next/next/no-img-element -- canvas data URL */}
              <div className="cz-logo-thumb">{art ? <img src={art.canvas.toDataURL()} alt="Loggan som den trycks" /> : null}</div>
              <div className="cz-logo-actions">
                <label className="file-btn">
                  Byt logga
                  <input type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={(e) => upload(e.target.files?.[0])} />
                </label>
                <form
                  className="cz-site"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const host = logoSite.trim().replace(/^https?:\/\//, "").split("/")[0];
                    if (host) set({ logo: `/api/brand-logo?host=${encodeURIComponent(host)}` });
                  }}
                >
                  <input value={logoSite} onChange={(e) => setLogoSite(e.target.value)} placeholder="eller hämta från webbadress" aria-label="Webbadress för logga" />
                </form>
                {design.logo ? (
                  <button type="button" className="cz-link" onClick={() => set({ logo: undefined })}>
                    Återställ till företagets logga
                  </button>
                ) : null}
              </div>
            </div>
          </section>

          <section className="cz-sec">
            <p className="drawer-label">Form</p>
            <div className="cz-chips">
              {SHAPES.map((s) => (
                <button key={s} type="button" aria-pressed={design.shape === s} onClick={() => set({ shape: s })}>
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <path d={SHAPE_ICON[s]} />
                  </svg>
                  {SHAPE_LABEL[s]}
                </button>
              ))}
            </div>
          </section>

          <section className="cz-sec">
            <p className="drawer-label">Märkmetod</p>
            <div className="cz-methods">
              {methods.map((m) => (
                <button key={m} type="button" aria-pressed={design.method === m} onClick={() => set({ method: m, colors: METHOD_INFO[m].fixedColors ?? Math.min(design.colors, METHOD_INFO[m].maxColors) })}>
                  <b>{METHOD_INFO[m].label}</b>
                  <small>{METHOD_INFO[m].blurb}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="cz-sec">
            <p className="drawer-label">
              Antal färger <span>{design.method === "digitaltryck" ? "fyrfärg" : design.method === "gravyr" ? "ton-i-ton" : colorsOf(design)}</span>
            </p>
            <div className="seg">
              {[1, 2, 3, 4].map((n) => (
                <button key={n} type="button" aria-pressed={colorsOf(design) === n} disabled={Boolean(info.fixedColors) || n > info.maxColors} onClick={() => set({ colors: n })}>
                  {n}
                </button>
              ))}
            </div>
          </section>

          <section className="cz-sec">
            <p className="drawer-label">Placering</p>
            <div className="cz-chips">
              {zones.map((z) => (
                <button
                  key={z.id}
                  type="button"
                  aria-pressed={design.zone === z.id}
                  onClick={() => set({ zone: z.id, point: undefined, normal: undefined, ...(z.sizeCm ? { sizeCm: z.sizeCm } : {}) })}
                >
                  {z.label}
                </button>
              ))}
              {design.zone === "egen" ? (
                <button type="button" aria-pressed>
                  Egen placering
                </button>
              ) : null}
            </div>
          </section>

          <section className="cz-sec">
            <label className="insp-range">
              <span className="drawer-label">
                Storlek <span>{design.sizeCm} cm bred</span>
              </span>
              <input type="range" min={2} max={maxSizeCm(family)} value={design.sizeCm} onChange={(e) => set({ sizeCm: Number(e.target.value) })} />
            </label>
          </section>

          <section className="cz-sec">
            <p className="drawer-label">
              Produktfärg <span>{colorName(color)}</span>
            </p>
            <div className="swatches">
              {suggestions(brandColor).map((s) => (
                <button key={s.hex} type="button" className="swatch" title={s.name} aria-label={s.name} aria-pressed={color === s.hex.toUpperCase()} style={{ background: s.hex }} onClick={() => setColor(s.hex.toUpperCase())} />
              ))}
            </div>
          </section>

          <div className="cz-price">
            <div>
              <span>Märkning</span>
              <b>{sek(price.perUnit)}/st</b>
            </div>
            <div>
              <span>Startkostnad</span>
              <b>{sek(price.setup)}</b>
            </div>
            <div>
              <span>Märkning för {qty} st</span>
              <b>{sek(price.perUnit * qty + price.setup)}</b>
            </div>
          </div>

          <div className="cz-foot">
            <button type="button" className="drawer-save" onClick={save} disabled={!art}>
              Spara design
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
