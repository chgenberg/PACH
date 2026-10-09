"use client";

import { type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildLogoArt, buildNameArt, isDark, type LogoArt } from "@/components/customizer/logoArt";
import { type Layer, ProductScene, type SceneApi } from "@/components/customizer/ProductScene";
import { DeliveryNote } from "@/components/DeliveryNote";
import { readLogoFile } from "@/components/readLogoFile";
import type { Family } from "@/lib/catalog";
import { colorName, suggestions } from "@/lib/colors";
import { colorsOf, sizeCmFor, type LogoDesign, markingPrice, maxSizeCm, METHOD_INFO, methodsFor, NAME_UNIT, type Placement, SHAPE_LABEL, SHAPES, type Shape, zonesFor } from "@/lib/marking";
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
  needBy,
  onSave,
  onClose,
}: {
  family: Family;
  initial: LogoDesign;
  color: string;
  qty: number;
  brandLogo: string | null;
  brandColor?: string;
  needBy?: string;
  onSave: (r: CustomizerResult) => void;
  onClose: () => void;
}) {
  const [design, setDesign] = useState<LogoDesign>(initial);
  const [color, setColor] = useState(initialColor);
  const [arts, setArts] = useState<Record<string, LogoArt>>({});
  const [active, setActive] = useState("main");
  const [namesText, setNamesText] = useState(initial.names?.list.join("\n") ?? "");
  const [modelUrl, setModelUrl] = useState<string | null | undefined>(undefined);
  const [logoSite, setLogoSite] = useState("");
  const api = useRef<SceneApi | null>(null);
  const zones = useMemo(() => zonesFor(family), [family]);
  const methods = methodsFor(family);
  const extraIndex = active.startsWith("x") ? Number(active.slice(1)) : -1;
  const onNames = active === "names" && Boolean(design.names);
  const cur: Placement = extraIndex >= 0 && design.extra?.[extraIndex] ? design.extra[extraIndex] : design;
  const info = METHOD_INFO[cur.method];
  const units = Math.max(qty, design.names?.list.length ?? 0);
  const price = markingPrice(design, units);
  const darkProduct = isDark(color);
  // The verified company logo comes in a variant for light and one for dark products.
  const logo = design.logo ?? (brandLogo && darkProduct ? `${brandLogo}&variant=dark` : brandLogo);
  const customColor = !suggestions(brandColor).some((s) => s.hex.toUpperCase() === color);
  const set = (patch: Partial<LogoDesign>) => setDesign((d) => ({ ...d, ...patch }));
  /** Edit the print position that is selected in the tabs. */
  const setCur = (patch: Partial<Placement>) =>
    setDesign((d) => (extraIndex >= 0 && d.extra?.[extraIndex] ? { ...d, extra: d.extra.map((p, i) => (i === extraIndex ? { ...p, ...patch } : p)) } : { ...d, ...patch }));
  const setNames = (patch: Partial<NonNullable<LogoDesign["names"]>>) => setDesign((d) => (d.names ? { ...d, names: { ...d.names, ...patch } } : d));
  const zoneLabel = (id: string) => (id === "egen" ? "Egen" : (zones.find((z) => z.id === id)?.label ?? id));

  const addPosition = () => {
    const used = new Set([design.zone, ...(design.extra ?? []).map((p) => p.zone)]);
    const zone = zones.find((z) => !used.has(z.id)) ?? zones[0];
    const next: Placement = { method: design.method, colors: design.colors, shape: "original", zone: zone.id, sizeCm: zone.sizeCm ?? design.sizeCm };
    const extra = [...(design.extra ?? []), next];
    set({ extra });
    setActive(`x${extra.length - 1}`);
  };
  const removePosition = (i: number) => {
    const extra = (design.extra ?? []).filter((_, k) => k !== i);
    set({ extra: extra.length ? extra : undefined });
    setActive("main");
  };
  const addNames = () => {
    const used = new Set([design.zone, ...(design.extra ?? []).map((p) => p.zone)]);
    const zone = zones.find((z) => z.id === "rygg" && !used.has(z.id)) ?? zones.find((z) => !used.has(z.id)) ?? zones[0];
    set({ names: { list: [], zone: zone.id, sizeCm: Math.max(4, Math.min(maxSizeCm(family), Math.round(sizeCmFor(family) * 0.33))) } });
    setNamesText("");
    setActive("names");
  };

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

  // The artwork only changes with logo, method, colour count, shape and light/dark product – not with every colour pick.
  const specKey = JSON.stringify([design, ...(design.extra ?? [])].map((p) => [p.method, p.colors, p.shape]));
  useEffect(() => {
    let live = true;
    const specs = JSON.parse(specKey) as [Placement["method"], number, Shape][];
    Promise.all(specs.map(([method, colors, shape]) => buildLogoArt(logo, { method, colors, shape }, darkProduct ? "#111111" : "#FFFFFF"))).then(
      (list) => live && setArts(Object.fromEntries(list.map((a, i) => [i === 0 ? "main" : `x${i - 1}`, a]))),
    );
    return () => {
      live = false;
    };
  }, [logo, specKey, darkProduct]);
  const art = arts.main ?? null;
  const firstName = design.names?.list[0] ?? "";
  const nameArt = useMemo(() => (design.names ? buildNameArt(firstName, color) : null), [design.names, firstName, color]);

  const layers: Layer[] = [
    { key: "main", zone: design.zone, point: design.point, normal: design.normal, sizeCm: design.sizeCm, method: design.method, art },
    ...(design.extra ?? []).map((p, i) => ({ key: `x${i}`, zone: p.zone, point: p.point, normal: p.normal, sizeCm: p.sizeCm, method: p.method, art: arts[`x${i}`] ?? null })),
    ...(design.names ? [{ key: "names", zone: design.names.zone, point: design.names.point, normal: design.names.normal, sizeCm: design.names.sizeCm, method: "transfer" as const, art: nameArt }] : []),
  ];

  const placeLayer = (key: string, p: { point: { x: number; y: number; z: number }; normal: { x: number; y: number; z: number } }) => {
    const at = { zone: "egen", point: [p.point.x, p.point.y, p.point.z] as [number, number, number], normal: [p.normal.x, p.normal.y, p.normal.z] as [number, number, number] };
    setDesign((d) => {
      if (key === "names") return d.names ? { ...d, names: { ...d.names, ...at } } : d;
      const i = key.startsWith("x") ? Number(key.slice(1)) : -1;
      if (i >= 0 && d.extra?.[i]) return { ...d, extra: d.extra.map((x, k) => (k === i ? { ...x, ...at } : x)) };
      return { ...d, ...at };
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onReady = useCallback((a: SceneApi) => {
    api.current = a;
  }, []);

  const [dropping, setDropping] = useState<"panel" | "stage" | null>(null);
  const [uploadError, setUploadError] = useState("");

  const upload = async (file: File | undefined) => {
    setDropping(null);
    if (!file) return;
    setUploadError("");
    try {
      set({ logo: await readLogoFile(file) });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Kunde inte läsa filen.");
    }
  };

  /** Drag-and-drop handlers shared by the logo box and the 3D stage. */
  const dropTarget = (where: "panel" | "stage") => ({
    onDragOver: (e: DragEvent<HTMLElement>) => {
      if (![...e.dataTransfer.types].includes("Files")) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      if (dropping !== where) setDropping(where);
    },
    onDragLeave: (e: DragEvent<HTMLElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(null);
    },
    onDrop: (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      void upload(e.dataTransfer.files?.[0]);
    },
  });

  const save = () => {
    const preview = api.current?.capture() ?? "";
    onSave({ design: design.names?.list.length ? design : { ...design, names: undefined }, color, preview });
  };

  return (
    <div className="cz-wrap" role="dialog" aria-modal="true" aria-label={`Anpassa logga på ${family.name}`}>
      <button type="button" className="drawer-veil" aria-label="Stäng" onClick={onClose} />
      <div className="cz">
        <div className={`cz-stage${dropping === "stage" ? " is-dropping" : ""}`} {...dropTarget("stage")}>
          {dropping === "stage" ? <div className="cz-drop-veil">Släpp för att lägga loggan på produkten</div> : null}
          {modelUrl === undefined ? null : (
            <ProductScene
              modelUrl={modelUrl}
              fallback={fallbackKind(family)}
              color={color}
              layers={layers}
              active={active}
              zones={zones}
              sizeCm={sizeCmFor(family)}
              onReady={onReady}
              onSelect={setActive}
              onPlace={placeLayer}
            />
          )}
          <p className="cz-hint">Dra ett tryck för att flytta det · dra produkten för att snurra · scrolla för att zooma</p>
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
            <p className="drawer-label">Tryckpositioner</p>
            <div className="cz-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={active === "main"} onClick={() => setActive("main")}>
                Logga · {zoneLabel(design.zone)}
              </button>
              {(design.extra ?? []).map((p, i) => (
                <span key={i} className="cz-tab">
                  <button type="button" role="tab" aria-selected={active === `x${i}`} onClick={() => setActive(`x${i}`)}>
                    Logga {i + 2} · {zoneLabel(p.zone)}
                  </button>
                  <button type="button" className="cz-tab-x" aria-label={`Ta bort logga ${i + 2}`} onClick={() => removePosition(i)}>
                    ×
                  </button>
                </span>
              ))}
              {design.names ? (
                <span className="cz-tab">
                  <button type="button" role="tab" aria-selected={active === "names"} onClick={() => setActive("names")}>
                    Namn · {design.names.list.length} st
                  </button>
                  <button
                    type="button"
                    className="cz-tab-x"
                    aria-label="Ta bort namntryck"
                    onClick={() => {
                      set({ names: undefined });
                      setActive("main");
                    }}
                  >
                    ×
                  </button>
                </span>
              ) : null}
              {(design.extra?.length ?? 0) < 3 ? (
                <button type="button" className="cz-tab-add" onClick={addPosition}>
                  + Position
                </button>
              ) : null}
              {!design.names ? (
                <button type="button" className="cz-tab-add" onClick={addNames}>
                  + Namn per plagg
                </button>
              ) : null}
            </div>
          </section>

          {onNames && design.names ? (
            <>
              <section className="cz-sec">
                <p className="drawer-label">
                  Namn <span>{design.names.list.length ? `${design.names.list.length} st · ${sek(NAME_UNIT)}/st` : "ett per rad"}</span>
                </p>
                <textarea
                  className="cz-names"
                  rows={6}
                  value={namesText}
                  placeholder={"Anna\nErik\nSara\n\nKlistra in en kolumn från Excel"}
                  onChange={(e) => {
                    setNamesText(e.target.value);
                    setNames({ list: e.target.value.split(/[\n,;\t]+/).map((n) => n.trim().slice(0, 30)).filter(Boolean).slice(0, 2000) });
                  }}
                />
                {design.names.list.length && design.names.list.length !== qty ? (
                  <p className="cz-note">
                    {design.names.list.length > qty
                      ? `${design.names.list.length} namn – antalet höjs från ${qty} till ${design.names.list.length} st när du sparar.`
                      : `${design.names.list.length} namn på ${qty} st – resten trycks utan namn.`}
                  </p>
                ) : null}
              </section>
              <section className="cz-sec">
                <p className="drawer-label">Placering</p>
                <div className="cz-chips">
                  {zones.map((z) => (
                    <button key={z.id} type="button" aria-pressed={design.names!.zone === z.id} onClick={() => setNames({ zone: z.id, point: undefined, normal: undefined })}>
                      {z.label}
                    </button>
                  ))}
                  {design.names.zone === "egen" ? (
                    <button type="button" aria-pressed>
                      Egen placering
                    </button>
                  ) : null}
                </div>
              </section>
              <section className="cz-sec">
                <label className="insp-range">
                  <span className="drawer-label">
                    Storlek <span>{design.names.sizeCm} cm bred</span>
                  </span>
                  <input type="range" min={2} max={maxSizeCm(family)} value={design.names.sizeCm} onChange={(e) => setNames({ sizeCm: Number(e.target.value) })} />
                </label>
              </section>
            </>
          ) : (
            <>
          <section className="cz-sec">
            <p className="drawer-label">Logga</p>
            <label className={`cz-drop${dropping === "panel" ? " is-dropping" : ""}`} {...dropTarget("panel")}>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(e) => {
                  void upload(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element -- canvas data URL */}
              <span className={`cz-logo-thumb${darkProduct ? " is-dark" : ""}`}>{art ? <img src={art.canvas.toDataURL()} alt="Loggan som den trycks" /> : null}</span>
              <span className="cz-drop-text">
                <b>{dropping === "panel" ? "Släpp loggan här" : "Ladda upp egen logga"}</b>
                <small>Dra in filen hit eller klicka för att välja · PNG, JPG, SVG</small>
              </span>
            </label>
            {uploadError ? <p className="brandbar-err">{uploadError}</p> : null}
            <div className="cz-logo">
              <div className="cz-logo-actions">
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
                <button key={s} type="button" aria-pressed={cur.shape === s} onClick={() => setCur({ shape: s })}>
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
                <button key={m} type="button" aria-pressed={cur.method === m} onClick={() => setCur({ method: m, colors: METHOD_INFO[m].fixedColors ?? Math.min(cur.colors, METHOD_INFO[m].maxColors) })}>
                  <b>{METHOD_INFO[m].label}</b>
                  <small>{METHOD_INFO[m].blurb}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="cz-sec">
            <p className="drawer-label">
              Antal färger <span>{cur.method === "digitaltryck" ? "fyrfärg" : cur.method === "gravyr" ? "ton-i-ton" : colorsOf(cur)}</span>
            </p>
            <div className="seg">
              {[1, 2, 3, 4].map((n) => (
                <button key={n} type="button" aria-pressed={colorsOf(cur) === n} disabled={Boolean(info.fixedColors) || n > info.maxColors} onClick={() => setCur({ colors: n })}>
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
                  aria-pressed={cur.zone === z.id}
                  onClick={() => setCur({ zone: z.id, point: undefined, normal: undefined, ...(z.sizeCm ? { sizeCm: z.sizeCm } : {}) })}
                >
                  {z.label}
                </button>
              ))}
              {cur.zone === "egen" ? (
                <button type="button" aria-pressed>
                  Egen placering
                </button>
              ) : null}
            </div>
          </section>

          <section className="cz-sec">
            <label className="insp-range">
              <span className="drawer-label">
                Storlek <span>{cur.sizeCm} cm bred</span>
              </span>
              <input type="range" min={2} max={maxSizeCm(family)} value={cur.sizeCm} onChange={(e) => setCur({ sizeCm: Number(e.target.value) })} />
            </label>
          </section>

            </>
          )}

          <section className="cz-sec">
            <p className="drawer-label">
              Produktfärg <span>{colorName(color)}</span>
            </p>
            <div className="swatches">
              {suggestions(brandColor).map((s) => (
                <button key={s.hex} type="button" className="swatch" title={s.name} aria-label={s.name} aria-pressed={color === s.hex.toUpperCase()} style={{ background: s.hex }} onClick={() => setColor(s.hex.toUpperCase())} />
              ))}
              <label className={`swatch swatch-custom${customColor ? " is-on" : ""}`} title="Välj egen färg" style={customColor ? { background: color } : undefined}>
                <input type="color" value={color.toLowerCase()} onChange={(e) => setColor(e.target.value.toUpperCase())} aria-label="Välj egen färg" />
              </label>
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
              <span>Märkning för {units} st</span>
              <b>{sek(price.perUnit * units + price.setup)}</b>
            </div>
            <DeliveryNote family={family} design={design} needBy={needBy} />
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
