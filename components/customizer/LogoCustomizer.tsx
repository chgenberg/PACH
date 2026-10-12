"use client";

import { type DragEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { buildLogoArt, buildNameArt, inkContrast, isDark, type LogoArt } from "@/components/customizer/logoArt";
import { type Layer, ProductScene, type SceneApi } from "@/components/customizer/ProductScene";
import { DeliveryNote } from "@/components/DeliveryNote";
import { readLogoFile } from "@/components/readLogoFile";
import type { Family } from "@/lib/catalog";
import { colorName, suggestions } from "@/lib/colors";
import { colorsOf, freeZone, sizeCmFor, zonesClash, type LogoDesign, markingPrice, maxSizeCm, METHOD_INFO, methodsFor, NAME_UNIT, type Placement, SHAPE_LABEL, SHAPES, type Shape, zonesFor } from "@/lib/marking";
import { sek } from "@/lib/pricing";

export type Proof = { label: string; image: string };
export type CustomizerResult = { design: LogoDesign; color: string; preview: string; proofs: Proof[] };

const SHAPE_ICON: Record<Shape, string> = {
  original: "M4 8h16M4 12h10M4 16h13",
  rund: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z",
  kvadrat: "M5 5h14v14H5z",
  rektangel: "M3 8h18v8H3z",
};

const noSubscribe = () => () => {};
/** The server can't know the platform, so it renders ⌘ and the client corrects it after hydration. */
const useModKey = () => useSyncExternalStore(noSubscribe, () => (/Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl"), () => "⌘");

const shortcuts = (MOD: string): [string[], string][] => [
  [["⌫"], "Ta bort vald logga"],
  [[MOD, "Z"], "Ångra"],
  [["⇧", MOD, "Z"], "Gör om"],
  [[MOD, "D"], "Duplicera logga"],
  [["←", "→", "↑", "↓"], "Flytta loggan (⇧ = längre)"],
  [["+", "−"], "Större / mindre"],
  [["[", "]"], "Föregående / nästa tryck"],
  [["N"], "Ny tryckposition"],
  [["M"], "Byt märkmetod"],
  [["F"], "Byt form"],
  [["R"], "Vrid fram vald logga"],
  [["P"], "Visa / dölj panelen"],
  [["V"], "Spela in ett 3D-klipp"],
  [[MOD, "S"], "Spara design"],
  [["?"], "Visa kortkommandon"],
  [["Esc"], "Stäng"],
];

type Toast = { id: number; text: string; undo?: boolean };

const RAIL_KEY = "pach.cz.rail";

/** Icon rail shown when the panel is collapsed; each opens the panel at its section. */
const RAIL: { sec: string; label: string; icon: string; names?: boolean }[] = [
  { sec: "positions", label: "Tryckpositioner", icon: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 18l9 5 9-5", names: true },
  { sec: "logo", label: "Logga", icon: "M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9.5a1.5 1.5 0 1 0 0-.01" },
  { sec: "shape", label: "Form", icon: "M4 4h7v7H4zM17.5 4a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7zM4 20l3.5-6 3.5 6zM14 14h7v6h-7z" },
  { sec: "method", label: "Märkmetod", icon: "M15 4l5 5-9.5 9.5H5.5v-5zM13 6l5 5" },
  { sec: "colors", label: "Antal färger", icon: "M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2 0-1.5-1.5-1.6-1.5-3 0-1 .8-2 2.5-2H18a3 3 0 0 0 3-3c0-4.4-4-8-9-8zM7.5 11.5h.01M10.5 7.5h.01M15.5 7.5h.01" },
  { sec: "zone", label: "Placering", icon: "M12 3v4M12 17v4M3 12h4M17 12h4M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z", names: true },
  { sec: "size", label: "Storlek", icon: "M4 14v6h6M20 10V4h-6M4 20l7-7M20 4l-7 7", names: true },
  { sec: "product", label: "Produktfärg", icon: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z", names: true },
  { sec: "price", label: "Pris och leverans", icon: "M3 12V4h8l10 10-8 8zM7.5 7.5h.01", names: true },
];

const PICK_RAIL = { sec: "pick", label: "Byt produkt", icon: "M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10", names: true };

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
  onExport,
  picker,
  saveLabel = "Spara design",
}: {
  family: Family;
  initial: LogoDesign;
  color: string;
  qty: number;
  brandLogo: string | null;
  brandColor?: string;
  needBy?: string;
  onSave: (r: CustomizerResult) => void;
  /** Without it the editor is embedded in the page instead of opening as a dialog. */
  onClose?: () => void;
  onExport?: (r: CustomizerResult) => void;
  /** Product chooser shown first in the panel. */
  picker?: ReactNode;
  saveLabel?: string;
}) {
  const embedded = !onClose;
  const MOD = useModKey();
  const [design, setDesignNow] = useState<LogoDesign>(initial);
  const [history, setHistory] = useState<{ past: LogoDesign[]; future: LogoDesign[] }>({ past: [], future: [] });
  const lastChange = useRef(0);
  const latest = useRef(initial);
  /** Every edit goes through here; quick successive edits (dragging, sliders) become one undo step. */
  const setDesign = (next: LogoDesign | ((d: LogoDesign) => LogoDesign)) => {
    const d = latest.current;
    const value = typeof next === "function" ? next(d) : next;
    if (value === d) return;
    latest.current = value;
    const now = Date.now();
    if (now - lastChange.current > 600) setHistory((h) => ({ past: [...h.past.slice(-79), d], future: [] }));
    lastChange.current = now;
    setDesignNow(value);
  };
  const [toast, setToast] = useState<Toast | null>(null);
  const say = (text: string, undo = false) => setToast({ id: Date.now(), text, undo });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);
  const [help, setHelp] = useState(false);
  const [rail, setRailNow] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
    setRailNow(localStorage.getItem(RAIL_KEY) === "1");
  }, []);
  const setRail = (v: boolean) => {
    setRailNow(v);
    localStorage.setItem(RAIL_KEY, v ? "1" : "0");
  };
  const panel = useRef<HTMLElement>(null);
  /** Open the panel at a section, from the icon rail. */
  const openAt = (sec: string) => {
    setRail(false);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = panel.current?.querySelector<HTMLElement>(`[data-sec="${sec}"]`);
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.classList.remove("is-flash");
        void el.offsetWidth;
        el.classList.add("is-flash");
      }),
    );
  };
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
  const logo = design.logo ?? (brandLogo && darkProduct && brandLogo.startsWith("/api/brand-logo?") ? `${brandLogo}&variant=dark` : brandLogo);
  const customColor = !suggestions(brandColor).some((s) => s.hex.toUpperCase() === color);
  const set = (patch: Partial<LogoDesign>) => setDesign((d) => ({ ...d, ...patch }));
  /** Edit the print position that is selected in the tabs. */
  const setCur = (patch: Partial<Placement>) =>
    setDesign((d) => (extraIndex >= 0 && d.extra?.[extraIndex] ? { ...d, extra: d.extra.map((p, i) => (i === extraIndex ? { ...p, ...patch } : p)) } : { ...d, ...patch }));
  const setNames = (patch: Partial<NonNullable<LogoDesign["names"]>>) => setDesign((d) => (d.names ? { ...d, names: { ...d.names, ...patch } } : d));
  const zoneLabel = (id: string) => (id === "egen" ? "Egen" : (zones.find((z) => z.id === id)?.label ?? id));
  const activeLabel = onNames && design.names ? `Namn · ${zoneLabel(design.names.zone)}` : extraIndex >= 0 ? `Logga ${extraIndex + 2} · ${zoneLabel(cur.zone)}` : `Logga · ${zoneLabel(design.zone)}`;

  const placed = [design, ...(design.extra ?? []), ...(design.names ? [design.names] : [])];
  const spots = [
    { key: "main", label: `Logga · ${zoneLabel(design.zone)}`, zone: design.zone, sizeCm: design.sizeCm },
    ...(design.extra ?? []).map((p, i) => ({ key: `x${i}`, label: `Logga ${i + 2} · ${zoneLabel(p.zone)}`, zone: p.zone, sizeCm: p.sizeCm })),
    ...(design.names ? [{ key: "names", label: `Namn · ${zoneLabel(design.names.zone)}`, zone: design.names.zone, sizeCm: design.names.sizeCm }] : []),
  ];
  const activeSpot = spots.find((s) => s.key === active);
  const clash = activeSpot ? spots.find((s) => s.key !== active && zonesClash(family, activeSpot, s)) : undefined;
  const clashNote = clash ? <p className="cz-warn">Krockar med {clash.label.toLowerCase()} – välj en annan placering eller gör loggan mindre.</p> : null;
  const addPosition = () => {
    const zone = freeZone(family, placed);
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

  const restore = (to: LogoDesign) => {
    latest.current = to;
    setDesignNow(to);
    lastChange.current = 0;
    setNamesText(to.names?.list.join("\n") ?? "");
    setActive((a) => (a === "names" && !to.names ? "main" : a.startsWith("x") && !to.extra?.[Number(a.slice(1))] ? "main" : a));
  };
  const undo = () => {
    const prev = history.past.at(-1);
    if (!prev) return say("Inget att ångra");
    setHistory({ past: history.past.slice(0, -1), future: [design, ...history.future] });
    restore(prev);
    setToast(null);
  };
  const redo = () => {
    const next = history.future[0];
    if (!next) return say("Inget att göra om");
    setHistory({ past: [...history.past, design], future: history.future.slice(1) });
    restore(next);
  };

  /** Delete the selected print. The main logo hands its place to the next print, if there is one. */
  const removeActive = () => {
    if (active === "names" && design.names) {
      set({ names: undefined });
      setActive("main");
      return say("Namntryck borttaget", true);
    }
    if (extraIndex >= 0) {
      removePosition(extraIndex);
      return say(`Logga ${extraIndex + 2} borttagen`, true);
    }
    const [first, ...rest] = design.extra ?? [];
    if (!first) return say("Minst ett tryck behövs – byt loggan eller placeringen i stället");
    setDesign((d) => ({ ...d, ...first, logo: d.logo, extra: rest.length ? rest : undefined }));
    setActive("main");
    say("Logga borttagen", true);
  };

  const duplicate = () => {
    if (onNames) return;
    if ((design.extra?.length ?? 0) >= 3) return say("Max fyra tryck per produkt");
    const zone = freeZone(family, placed);
    const copy: Placement = { method: cur.method, colors: cur.colors, shape: cur.shape, sizeCm: cur.sizeCm, zone: zone.id };
    const extra = [...(design.extra ?? []), copy];
    set({ extra });
    setActive(`x${extra.length - 1}`);
    say(`Duplicerad till ${zone.label.toLowerCase()}`);
  };

  const resize = (by: number) => {
    const max = maxSizeCm(family);
    if (onNames && design.names) return setNames({ sizeCm: Math.min(max, Math.max(2, design.names.sizeCm + by)) });
    setCur({ sizeCm: Math.min(max, Math.max(2, cur.sizeCm + by)) });
  };

  const cycleMethod = () => {
    if (onNames) return;
    const m = methods[(methods.indexOf(cur.method) + 1) % methods.length];
    setCur({ method: m, colors: METHOD_INFO[m].fixedColors ?? Math.min(cur.colors, METHOD_INFO[m].maxColors) });
    say(METHOD_INFO[m].label);
  };

  const cycleShape = () => {
    if (onNames) return;
    const s = SHAPES[(SHAPES.indexOf(cur.shape) + 1) % SHAPES.length];
    setCur({ shape: s });
    say(`Form: ${SHAPE_LABEL[s]}`);
  };
  const addNames = () => {
    const zone = freeZone(family, placed, "rygg");
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
  const curArt = onNames ? null : (extraIndex >= 0 ? arts[`x${extraIndex}`] : art) ?? null;
  // Below ~1.8 the print disappears into the fabric – a dark logo on navy, or a green logo on green.
  const lowContrast = useMemo(() => {
    if (!curArt || cur.method === "gravyr") return null;
    if (inkContrast(curArt, color) >= 1.8) return null;
    const better = suggestions(brandColor)
      .map((s) => ({ ...s, hex: s.hex.toUpperCase(), score: inkContrast(curArt, s.hex) }))
      .filter((s) => s.hex !== color)
      .sort((a, b) => b.score - a.score)[0];
    return better && better.score >= 3 ? better : { hex: "", name: "", score: 0 };
  }, [curArt, color, brandColor, cur.method]);
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

  const result = (): CustomizerResult => {
    const preview = api.current?.capture() ?? "";
    const labelOf = (key: string) => {
      if (key === "names" && design.names) return `Namn · ${zoneLabel(design.names.zone)}`;
      const i = key.startsWith("x") ? Number(key.slice(1)) : -1;
      const p = i >= 0 ? design.extra?.[i] : design;
      return `${i >= 0 ? `Logga ${i + 2}` : "Logga"} · ${p ? zoneLabel(p.zone) : ""}`;
    };
    const keep = design.names?.list.length ? design : { ...design, names: undefined };
    const proofs = (api.current?.captureAll() ?? []).filter((s) => s.key !== "names" || keep.names).map((s) => ({ label: labelOf(s.key), image: s.image }));
    return { design: keep, color, preview, proofs };
  };
  const save = () => onSave(result());

  const [recording, setRecording] = useState(false);
  const recordSpin = async () => {
    if (recording || !api.current) return;
    setRecording(true);
    const clip = await api.current.recordSpin(4).catch(() => null);
    setRecording(false);
    if (!clip) return say("Webbläsaren kan inte spela in – prova Chrome eller Safari");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(clip.blob);
    a.download = `${family.name.replace(/\s+/g, "-")}-3D.${clip.ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    say("3D-klippet är sparat – dela det i Slack eller Teams");
  };

  const layerKeys = layers.map((l) => l.key);
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyHandler.current = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el?.closest("input, textarea, select, [contenteditable='true']");
      if (e.key === "Escape") {
        e.preventDefault();
        if (help) setHelp(false);
        else if (typing) (el as HTMLElement).blur();
        else onClose?.();
        return;
      }
      if (typing) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      const run = (fn: () => void) => {
        e.preventDefault();
        fn();
      };
      if (mod && k === "z") return run(e.shiftKey ? redo : undo);
      if (mod && k === "y") return run(redo);
      if (mod && k === "d") return run(duplicate);
      if (mod && k === "s") return run(save);
      if (mod) return;
      if (e.key === "Backspace" || e.key === "Delete" || e.key === "\\") return run(removeActive);
      if (e.key === "?" || (e.shiftKey && e.key === "/")) return run(() => setHelp((h) => !h));
      const step = e.shiftKey ? 0.1 : 0.03;
      if (e.key === "ArrowLeft") return run(() => api.current?.nudge(active, -step, 0));
      if (e.key === "ArrowRight") return run(() => api.current?.nudge(active, step, 0));
      if (e.key === "ArrowUp") return run(() => api.current?.nudge(active, 0, step));
      if (e.key === "ArrowDown") return run(() => api.current?.nudge(active, 0, -step));
      if (e.key === "+" || e.key === "=") return run(() => resize(e.shiftKey ? 2 : 1));
      if (e.key === "-" || e.key === "_") return run(() => resize(e.shiftKey ? -2 : -1));
      if (e.key === "[" || e.key === "]") {
        return run(() => {
          const i = layerKeys.indexOf(active);
          const n = layerKeys.length;
          setActive(layerKeys[(i + (e.key === "]" ? 1 : n - 1)) % n]);
        });
      }
      if (k === "n") return run(() => ((design.extra?.length ?? 0) >= 3 ? say("Max fyra tryck per produkt") : addPosition()));
      if (k === "m") return run(cycleMethod);
      if (k === "f") return run(cycleShape);
      if (k === "r") return run(() => api.current?.frame(active));
      if (k === "p") return run(() => setRail(!rail));
      if (k === "v") return run(() => void recordSpin());
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  return (
    <div
      className={`cz-wrap${embedded ? " is-embedded" : ""}`}
      {...(embedded ? { "aria-label": `Designverktyg för ${family.name}` } : { role: "dialog", "aria-modal": true, "aria-label": `Anpassa logga på ${family.name}` })}
    >
      {embedded ? null : <button type="button" className="drawer-veil" aria-label="Stäng" onClick={onClose} />}
      <div className={`cz${rail ? " is-rail" : ""}`}>
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
          <div className="cz-tools" role="toolbar" aria-label="Verktyg för vald logga">
            <span className="cz-tools-name">{activeLabel}</span>
            {clash ? (
              <span className="cz-tools-warn" title={`Krockar med ${clash.label.toLowerCase()}`}>
                Krockar
              </span>
            ) : null}
            {lowContrast ? (
              <button type="button" className="cz-tools-warn is-btn" title="Loggan syns dåligt på den här färgen" onClick={() => openAt("product")}>
                Låg kontrast
              </button>
            ) : null}
            <span className="cz-tools-sep" aria-hidden />
            <button type="button" title="Mindre (−)" aria-label="Mindre" onClick={() => resize(-1)}>
              −
            </button>
            <span className="cz-tools-size">{onNames && design.names ? design.names.sizeCm : cur.sizeCm} cm</span>
            <button type="button" title="Större (+)" aria-label="Större" onClick={() => resize(1)}>
              +
            </button>
            <span className="cz-tools-sep" aria-hidden />
            <button type="button" title={`Duplicera (${MOD}D)`} aria-label="Duplicera" onClick={duplicate} disabled={onNames}>
              <svg viewBox="0 0 24 24" aria-hidden>
                <rect x="8" y="8" width="12" height="12" rx="2.5" />
                <path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8" />
              </svg>
            </button>
            <button type="button" className="is-danger" title="Ta bort (⌫)" aria-label="Ta bort vald logga" onClick={removeActive}>
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
              </svg>
            </button>
            <span className="cz-tools-sep" aria-hidden />
            <button type="button" title={`Ångra (${MOD}Z)`} aria-label="Ångra" onClick={undo} disabled={!history.past.length}>
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />
              </svg>
            </button>
            <button type="button" title={`Gör om (⇧${MOD}Z)`} aria-label="Gör om" onClick={redo} disabled={!history.future.length}>
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" />
              </svg>
            </button>
            <span className="cz-tools-sep" aria-hidden />
            <button type="button" className={recording ? "is-rec" : ""} title="Spela in ett snurrande 3D-klipp (V)" aria-label="Spela in ett 3D-klipp" onClick={() => void recordSpin()} disabled={recording || !art}>
              <svg viewBox="0 0 24 24" aria-hidden>
                <rect x="3" y="6" width="13" height="12" rx="2.5" />
                <path d="M16 10.5l5-3v9l-5-3z" />
              </svg>
            </button>
            <button type="button" className={help ? "is-on" : ""} title="Kortkommandon (?)" aria-label="Kortkommandon" aria-expanded={help} onClick={() => setHelp((h) => !h)}>
              ?
            </button>
          </div>

          {help ? (
            <div className="cz-help" role="dialog" aria-label="Kortkommandon">
              <div className="cz-help-head">
                <b>Kortkommandon</b>
                <button type="button" onClick={() => setHelp(false)} aria-label="Stäng">
                  ×
                </button>
              </div>
              <ul>
                {shortcuts(MOD).map(([keys, what]) => (
                  <li key={what}>
                    <span>{what}</span>
                    <span className="cz-keys">
                      {keys.map((k) => (
                        <kbd key={k}>{k}</kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {recording ? (
            <div className="cz-rec" role="status">
              <span aria-hidden /> Spelar in 3D-klipp…
            </div>
          ) : null}

          {toast ? (
            <div key={toast.id} className="cz-toast" role="status">
              <span>{toast.text}</span>
              {toast.undo ? (
                <button type="button" onClick={undo}>
                  Ångra
                </button>
              ) : null}
            </div>
          ) : null}

          <p className="cz-hint">
            <span>Dra loggan för att flytta</span>
            <span>
              <kbd>⌫</kbd> ta bort
            </span>
            <span>
              <kbd>{MOD}</kbd>
              <kbd>Z</kbd> ångra
            </span>
            <span>
              <kbd>←</kbd>
              <kbd>→</kbd> flytta
            </span>
            <button type="button" onClick={() => setHelp(true)}>
              <kbd>?</kbd> alla
            </button>
          </p>
        </div>

        <aside ref={panel} className="cz-panel" aria-label="Inställningar">
          {rail ? (
            <nav className="cz-rail" aria-label="Inställningar, minimerad">
              <button type="button" className="cz-rail-btn cz-rail-open" onClick={() => setRail(false)} aria-label="Visa panelen (P)" data-tip="Visa panelen · P">
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
              <span className="cz-rail-sep" aria-hidden />
              {(picker ? [PICK_RAIL, ...RAIL] : RAIL).filter((r) => !onNames || r.names).map((r) => (
                <button key={r.sec} type="button" className="cz-rail-btn" onClick={() => openAt(r.sec)} aria-label={r.label} data-tip={r.label}>
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <path d={r.icon} />
                  </svg>
                </button>
              ))}
              <span className="cz-rail-swatch" style={{ background: color }} data-tip={colorName(color)} aria-hidden />
              <div className="cz-rail-foot">
                <button type="button" className="cz-rail-btn is-save" onClick={save} disabled={!art} aria-label={saveLabel} data-tip={`${saveLabel} · ${MOD}S`}>
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </button>
                {onClose ? (
                  <button type="button" className="cz-rail-btn" onClick={onClose} aria-label="Stäng" data-tip="Stäng · Esc">
                    <svg viewBox="0 0 24 24" aria-hidden>
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                ) : null}
              </div>
            </nav>
          ) : (
          <>
          <div className="drawer-head cz-head">
            <div>
              <p className="kicker">{embedded ? "Designverktyg" : "Anpassa logga"}</p>
              <h2>{family.name}</h2>
            </div>
            <div className="cz-head-actions">
              <button type="button" className="cz-collapse" onClick={() => setRail(true)} aria-label="Minimera panelen (P)" title="Minimera panelen · P">
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M15 6l-6 6 6 6" />
                </svg>
              </button>
              {onClose ? (
                <button type="button" className="drawer-x" onClick={onClose} aria-label="Stäng">
                  ×
                </button>
              ) : null}
            </div>
          </div>

          {picker ? (
            <section className="cz-sec" data-sec={PICK_RAIL.sec}>
              {picker}
            </section>
          ) : null}

          <section className="cz-sec" data-sec="positions">
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
              <section className="cz-sec" data-sec="zone">
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
                {clashNote}
              </section>
              <section className="cz-sec" data-sec="size">
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
          <section className="cz-sec" data-sec="logo">
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
                <small>Vektor är bäst: PDF, SVG, AI, EPS. PNG och JPG går – vi hjälper till att rita om.</small>
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

          <section className="cz-sec" data-sec="shape">
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

          <section className="cz-sec" data-sec="method">
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

          <section className="cz-sec" data-sec="colors">
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

          <section className="cz-sec" data-sec="zone">
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
            {clashNote}
          </section>

          <section className="cz-sec" data-sec="size">
            <label className="insp-range">
              <span className="drawer-label">
                Storlek <span>{cur.sizeCm} cm bred</span>
              </span>
              <input type="range" min={2} max={maxSizeCm(family)} value={cur.sizeCm} onChange={(e) => setCur({ sizeCm: Number(e.target.value) })} />
            </label>
          </section>

            </>
          )}

          <section className="cz-sec" data-sec="product">
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
            {lowContrast ? (
              <div className="cz-warn cz-contrast">
                <span>Loggan syns dåligt på {colorName(color).toLowerCase()}.</span>
                {lowContrast.hex ? (
                  <button type="button" onClick={() => setColor(lowContrast.hex)}>
                    <i style={{ background: lowContrast.hex }} aria-hidden /> Byt till {lowContrast.name.toLowerCase()}
                  </button>
                ) : (
                  <span>Prova en ljusare eller mörkare produktfärg, eller färre färger i trycket.</span>
                )}
              </div>
            ) : null}
          </section>

          <div className="cz-price" data-sec="price">
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
              {saveLabel}
            </button>
            {onExport ? (
              <button type="button" className="cz-export" onClick={() => onExport(result())} disabled={!art}>
                Exportera bild
              </button>
            ) : null}
          </div>
          </>
          )}
        </aside>
      </div>
    </div>
  );
}
