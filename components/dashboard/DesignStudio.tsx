"use client";

import { useRouter } from "next/navigation";
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { useCart } from "@/components/CartProvider";
import { useBrandbook } from "@/components/dashboard/brandbook";
import { familyById } from "@/lib/catalog";
import { BASE_COLOR, colorName, suggestions } from "@/lib/colors";

/** Print area per product, in the 0–1000 coordinates of its square catalogue photo. */
const TEMPLATES = [
  { id: "DEMO-P001", area: { x: 335, y: 250, w: 330, h: 330 } },
  { id: "DEMO-P004", area: { x: 345, y: 320, w: 310, h: 240 } },
  { id: "DEMO-P011", area: { x: 380, y: 330, w: 240, h: 150 } },
  { id: "DEMO-P014", area: { x: 300, y: 430, w: 400, h: 360 } },
  { id: "DEMO-P015", area: { x: 365, y: 300, w: 270, h: 250 } },
  { id: "DEMO-P021", area: { x: 405, y: 330, w: 190, h: 300 } },
  { id: "DEMO-P022", area: { x: 300, y: 350, w: 270, h: 280 } },
  { id: "DEMO-P026", area: { x: 335, y: 260, w: 330, h: 480 } },
  { id: "DEMO-P029", area: { x: 330, y: 210, w: 340, h: 190 } },
  { id: "DEMO-P040", area: { x: 285, y: 360, w: 430, h: 330 } },
] as const;

type Ink = "original" | "white" | "black";
type Layer = {
  id: string;
  kind: "logo" | "text";
  x: number;
  y: number;
  rotate: number;
  opacity: number;
  /** logo */
  w: number;
  ink: Ink;
  /** text */
  text: string;
  font: string;
  size: number;
  color: string;
  bold: boolean;
};

const uid = () => Math.random().toString(36).slice(2, 9);
const INK_MATRIX: Record<Exclude<Ink, "original">, string> = {
  white: "0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0",
  black: "0 0 0 0 0.07  0 0 0 0 0.07  0 0 0 0 0.07  0 0 0 1 0",
};

function logoLayer(productId: string, onDark: boolean, font: string): Layer {
  const { area } = TEMPLATES.find((t) => t.id === productId) ?? TEMPLATES[0];
  return { id: uid(), kind: "logo", x: area.x + area.w / 2, y: area.y + area.h / 2, rotate: 0, opacity: 1, w: area.w * 0.7, ink: onDark ? "white" : "original", text: "", font, size: 40, color: "#FFFFFF", bold: false };
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function DesignStudio() {
  const { book } = useBrandbook();
  const cart = useCart();
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const [tab, setTab] = useState<"produkt" | "brandbook" | "lager">("produkt");
  const [productId, setProductId] = useState<string>(TEMPLATES[0].id);
  const [productColor, setProductColor] = useState(BASE_COLOR);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [recoloring, setRecoloring] = useState(false);
  const [ratio, setRatio] = useState(1);
  const [layers, setLayers] = useState<Layer[]>(() => [logoLayer(TEMPLATES[0].id, true, "Inter")]);
  const [sel, setSel] = useState<string | null>(() => layers[0]?.id ?? null);
  const [busy, setBusy] = useState("");

  const tpl = TEMPLATES.find((t) => t.id === productId) ?? TEMPLATES[0];
  const family = familyById(productId);
  const photo = photos[`${productId}:${productColor}`] ?? (productColor === BASE_COLOR ? family?.image : undefined) ?? family?.image ?? "";
  const selected = layers.find((l) => l.id === sel) ?? null;
  const palette = book.brand.colors;
  const logo = book.brand.logo;

  useEffect(() => {
    if (!logo) return;
    let live = true;
    loadImage(logo)
      .then((img) => live && setRatio(img.naturalHeight / img.naturalWidth || 1))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [logo]);

  const newLogo = () => logoLayer(productId, productColor === BASE_COLOR, book.brand.bodyFont);
  const newText = (heading: boolean): Layer => ({
    id: uid(),
    kind: "text",
    x: tpl.area.x + tpl.area.w / 2,
    y: tpl.area.y + tpl.area.h * (heading ? 0.85 : 0.95),
    rotate: 0,
    opacity: 1,
    w: 0,
    ink: "original",
    text: heading ? book.company.name || "Rubrik" : "Er text här",
    font: heading ? book.brand.headingFont : book.brand.bodyFont,
    size: heading ? Math.round(tpl.area.w / 7) : Math.round(tpl.area.w / 12),
    color: productColor === BASE_COLOR ? "#FFFFFF" : palette[1] ?? "#111111",
    bold: heading,
  });

  const add = (layer: Layer) => {
    setLayers((ls) => [...ls, layer]);
    setSel(layer.id);
  };
  const update = (id: string, patch: Partial<Layer>) => setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const remove = (id: string) => {
    setLayers((ls) => ls.filter((l) => l.id !== id));
    setSel(null);
  };
  const move = (id: string, dir: -1 | 1) =>
    setLayers((ls) => {
      const i = ls.findIndex((l) => l.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ls.length) return ls;
      const next = [...ls];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  /** Every product starts with the logo centred in its print area. */
  const chooseProduct = (id: string) => {
    const first = logoLayer(id, true, book.brand.bodyFont);
    setProductId(id);
    setProductColor(BASE_COLOR);
    setLayers([first]);
    setSel(first.id);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!sel || (e.target as HTMLElement)?.closest("input, textarea, select")) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        setLayers((ls) => ls.filter((l) => l.id !== sel));
        setSel(null);
      }
      const step = e.shiftKey ? 20 : 4;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (d) {
        e.preventDefault();
        setLayers((ls) => ls.map((l) => (l.id === sel ? { ...l, x: l.x + d[0], y: l.y + d[1] } : l)));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel]);

  const toSvg = (e: ReactPointerEvent) => {
    const svg = svgRef.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };

  const pickColor = async (hex: string) => {
    setProductColor(hex);
    const key = `${productId}:${hex}`;
    if (hex === BASE_COLOR || photos[key]) return;
    setRecoloring(true);
    const res = await fetch("/api/recolor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, hex }) }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok && json.image) setPhotos((p) => ({ ...p, [key]: json.image }));
    setRecoloring(false);
  };

  /** Draw the design onto a canvas – the same layers as the SVG preview. */
  const render = async (): Promise<HTMLCanvasElement> => {
    const c = document.createElement("canvas");
    c.width = 1000;
    c.height = 1000;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 1000, 1000);
    ctx.drawImage(await loadImage(photo), 0, 0, 1000, 1000);
    const logoImg = logo ? await loadImage(logo).catch(() => null) : null;
    for (const l of layers) {
      ctx.save();
      ctx.globalAlpha = l.opacity;
      ctx.translate(l.x, l.y);
      ctx.rotate((l.rotate * Math.PI) / 180);
      if (l.kind === "logo" && logoImg) {
        const h = l.w * ratio;
        if (l.ink === "original") ctx.drawImage(logoImg, -l.w / 2, -h / 2, l.w, h);
        else {
          const t = document.createElement("canvas");
          t.width = Math.max(1, Math.round(l.w));
          t.height = Math.max(1, Math.round(h));
          const tc = t.getContext("2d")!;
          tc.drawImage(logoImg, 0, 0, t.width, t.height);
          tc.globalCompositeOperation = "source-in";
          tc.fillStyle = l.ink === "white" ? "#ffffff" : "#121212";
          tc.fillRect(0, 0, t.width, t.height);
          ctx.drawImage(t, -l.w / 2, -h / 2, l.w, h);
        }
      } else if (l.kind === "text") {
        const font = `${l.bold ? 700 : 400} ${l.size}px "${l.font}"`;
        await document.fonts.load(font).catch(() => undefined);
        ctx.font = font;
        ctx.fillStyle = l.color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(l.text, 0, 0);
      }
      ctx.restore();
    }
    return c;
  };

  const exportPng = async () => {
    setBusy("export");
    try {
      const c = await render();
      const a = document.createElement("a");
      a.href = c.toDataURL("image/png");
      a.download = `${family?.name ?? "design"}-${book.company.name || "PACH"}.png`.replace(/\s+/g, "-");
      a.click();
    } finally {
      setBusy("");
    }
  };

  const toQuote = async () => {
    setBusy("quote");
    try {
      const c = await render();
      cart.save(productId, { qty: 50, image: c.toDataURL("image/jpeg", 0.86), color: productColor === BASE_COLOR ? undefined : productColor });
      router.push("/offert");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="studio">
      <aside className="studio-rail">
        <div className="studio-tabs" role="tablist">
          {(["produkt", "brandbook", "lager"] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
              {t === "produkt" ? "Produkt" : t === "brandbook" ? "Brandbook" : `Lager (${layers.length})`}
            </button>
          ))}
        </div>

        {tab === "produkt" ? (
          <div className="studio-panel">
            <p className="drawer-label">Produkt</p>
            <div className="tpl-grid">
              {TEMPLATES.map((t) => {
                const f = familyById(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={t.id === productId}
                    onClick={() => chooseProduct(t.id)}
                    title={f?.name}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f?.image} alt="" />
                    <span>{f?.name}</span>
                  </button>
                );
              })}
            </div>
            <p className="drawer-label">
              Produktfärg <span>{colorName(productColor)}</span>
            </p>
            <div className="swatches">
              {suggestions(palette[0]).map((s) => (
                <button key={s.hex} type="button" className="swatch" title={s.name} aria-label={s.name} aria-pressed={productColor === s.hex.toUpperCase()} style={{ background: s.hex }} onClick={() => void pickColor(s.hex.toUpperCase())} />
              ))}
            </div>
          </div>
        ) : null}

        {tab === "brandbook" ? (
          <div className="studio-panel">
            <p className="drawer-label">Logotyp</p>
            <button type="button" className="bb-logo" onClick={() => add(newLogo())} disabled={!logo}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {logo ? <img src={logo} alt="Logotyp" /> : "Ingen logga – lägg till under Inställningar"}
              <span>+ Lägg till logga</span>
            </button>
            <p className="drawer-label">Text</p>
            <div className="bb-texts">
              <button type="button" onClick={() => add(newText(true))} style={{ fontFamily: `"${book.brand.headingFont}"` }}>
                <b>+ Rubrik</b>
                <small>{book.brand.headingFont}</small>
              </button>
              <button type="button" onClick={() => add(newText(false))} style={{ fontFamily: `"${book.brand.bodyFont}"` }}>
                <span>+ Brödtext</span>
                <small>{book.brand.bodyFont}</small>
              </button>
            </div>
            <p className="drawer-label">Färger</p>
            <div className="swatches">
              {palette.map((c) => (
                <button key={c} type="button" className="swatch" title={c} aria-label={`Använd ${c}`} style={{ background: c }} onClick={() => selected?.kind === "text" && update(selected.id, { color: c })} />
              ))}
            </div>
            <p className="drawer-note">Välj ett textlager och klicka på en färg. Brandbooken ändras under Inställningar.</p>
          </div>
        ) : null}

        {tab === "lager" ? (
          <div className="studio-panel">
            {layers.length === 0 ? <p className="drawer-note">Inga lager än. Lägg till logga eller text under Brandbook.</p> : null}
            <ul className="layer-list">
              {[...layers].reverse().map((l) => (
                <li key={l.id} className={l.id === sel ? "is-on" : ""}>
                  <button type="button" className="layer-name" onClick={() => setSel(l.id)}>
                    {l.kind === "logo" ? "Logotyp" : `”${l.text.slice(0, 18)}”`}
                  </button>
                  <button type="button" onClick={() => move(l.id, 1)} aria-label="Flytta upp">
                    ↑
                  </button>
                  <button type="button" onClick={() => move(l.id, -1)} aria-label="Flytta ner">
                    ↓
                  </button>
                  <button type="button" onClick={() => remove(l.id)} aria-label="Ta bort">
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </aside>

      <section className="studio-stage">
        <div className="studio-canvas">
          <svg
            ref={svgRef}
            viewBox="0 0 1000 1000"
            onPointerMove={(e) => {
              if (!drag.current) return;
              const p = toSvg(e);
              update(drag.current.id, { x: Math.round(p.x - drag.current.dx), y: Math.round(p.y - drag.current.dy) });
            }}
            onPointerUp={() => (drag.current = null)}
            onPointerLeave={() => (drag.current = null)}
            onPointerDown={(e) => e.target === e.currentTarget && setSel(null)}
          >
            <defs>
              {(["white", "black"] as const).map((k) => (
                <filter key={k} id={`ink-${k}`}>
                  <feColorMatrix type="matrix" values={INK_MATRIX[k]} />
                </filter>
              ))}
            </defs>
            <image href={photo} width={1000} height={1000} onPointerDown={() => setSel(null)} />
            <rect className="print-area" x={tpl.area.x} y={tpl.area.y} width={tpl.area.w} height={tpl.area.h} rx={8} pointerEvents="none" />
            {layers.map((l) => {
              const h = l.kind === "logo" ? l.w * ratio : l.size * 1.2;
              const w = l.kind === "logo" ? l.w : Math.max(40, l.text.length * l.size * 0.56);
              return (
                <g
                  key={l.id}
                  transform={`translate(${l.x} ${l.y}) rotate(${l.rotate})`}
                  opacity={l.opacity}
                  style={{ cursor: "move" }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    (e.currentTarget.ownerSVGElement as SVGSVGElement).setPointerCapture(e.pointerId);
                    const p = toSvg(e);
                    drag.current = { id: l.id, dx: p.x - l.x, dy: p.y - l.y };
                    setSel(l.id);
                  }}
                >
                  {l.kind === "logo" ? (
                    <image href={logo} x={-l.w / 2} y={-h / 2} width={l.w} height={h} filter={l.ink === "original" ? undefined : `url(#ink-${l.ink})`} />
                  ) : (
                    <text textAnchor="middle" dominantBaseline="central" fontFamily={`"${l.font}", sans-serif`} fontSize={l.size} fontWeight={l.bold ? 700 : 400} fill={l.color}>
                      {l.text}
                    </text>
                  )}
                  {l.id === sel ? <rect className="sel-box" x={-w / 2 - 8} y={-h / 2 - 8} width={w + 16} height={h + 16} rx={6} /> : null}
                </g>
              );
            })}
          </svg>
          {recoloring ? (
            <div className="drawer-busy" role="status">
              <span className="loader-spin" aria-hidden />
              <p>Färgar produkten…</p>
            </div>
          ) : null}
        </div>
        <p className="studio-hint">Dra lagren för att flytta · piltangenter finjusterar · Delete tar bort · streckad ruta = tryckyta</p>
      </section>

      <aside className="studio-side">
        <h2>{family?.name}</h2>
        <p className="drawer-note">
          {book.company.name} · {colorName(productColor)}
        </p>

        {selected ? (
          <div className="inspector">
            <p className="drawer-label">{selected.kind === "logo" ? "Logotyp" : "Text"}</p>
            {selected.kind === "text" ? (
              <>
                <input className="insp-text" value={selected.text} onChange={(e) => update(selected.id, { text: e.target.value })} aria-label="Text" />
                <div className="insp-row">
                  <select value={selected.font} onChange={(e) => update(selected.id, { font: e.target.value })} aria-label="Typsnitt">
                    {[...new Set([book.brand.headingFont, book.brand.bodyFont])].map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                  <button type="button" className={`insp-bold${selected.bold ? " is-on" : ""}`} onClick={() => update(selected.id, { bold: !selected.bold })} aria-pressed={selected.bold}>
                    B
                  </button>
                </div>
                <label className="insp-range">
                  Storlek <input type="range" min={12} max={200} value={selected.size} onChange={(e) => update(selected.id, { size: Number(e.target.value) })} />
                </label>
                <div className="swatches small">
                  {[...palette, "#FFFFFF", "#111111"].filter((c, i, a) => a.indexOf(c) === i).map((c) => (
                    <button key={c} type="button" className="swatch" aria-label={c} aria-pressed={selected.color === c} style={{ background: c }} onClick={() => update(selected.id, { color: c })} />
                  ))}
                </div>
              </>
            ) : (
              <>
                <label className="insp-range">
                  Storlek <input type="range" min={40} max={700} value={selected.w} onChange={(e) => update(selected.id, { w: Number(e.target.value) })} />
                </label>
                <div className="seg">
                  {(["original", "white", "black"] as const).map((k) => (
                    <button key={k} type="button" aria-pressed={selected.ink === k} onClick={() => update(selected.id, { ink: k })}>
                      {k === "original" ? "Original" : k === "white" ? "Vit" : "Svart"}
                    </button>
                  ))}
                </div>
              </>
            )}
            <label className="insp-range">
              Rotation <input type="range" min={-180} max={180} value={selected.rotate} onChange={(e) => update(selected.id, { rotate: Number(e.target.value) })} />
            </label>
            <label className="insp-range">
              Opacitet <input type="range" min={0.1} max={1} step={0.05} value={selected.opacity} onChange={(e) => update(selected.id, { opacity: Number(e.target.value) })} />
            </label>
            <button
              type="button"
              className="dash-btn ghost"
              onClick={() => update(selected.id, { x: tpl.area.x + tpl.area.w / 2, y: tpl.area.y + tpl.area.h / 2 })}
            >
              Centrera i tryckytan
            </button>
          </div>
        ) : (
          <p className="drawer-note">Markera ett lager för att ändra det.</p>
        )}

        <div className="studio-actions">
          <button type="button" className="drawer-save" onClick={() => void toQuote()} disabled={Boolean(busy) || recoloring}>
            {busy === "quote" ? "Lägger till…" : "Lägg i offert"}
          </button>
          <button type="button" className="dash-btn ghost" onClick={() => void exportPng()} disabled={Boolean(busy) || recoloring}>
            {busy === "export" ? "Exporterar…" : "Exportera PNG"}
          </button>
        </div>
      </aside>
    </div>
  );
}
