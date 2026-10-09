import type { Family } from "@/lib/catalog";

/**
 * Märkning: metoder, priser och placeringar.
 * Priserna är platshållare (exkl. moms) tills riktiga tryckpriser kopplas in – samma struktur
 * som branschens kalkyler: startkostnad per färg/kliché + styckpris per färg, stafflat på antal.
 */

export const METHODS = ["screentryck", "transfer", "brodyr", "gravyr", "digitaltryck"] as const;
export type Method = (typeof METHODS)[number];
export const SHAPES = ["original", "rund", "kvadrat", "rektangel"] as const;
export type Shape = (typeof SHAPES)[number];

export type LogoDesign = {
  method: Method;
  /** Antal tryckfärger (1–4). Digitaltryck är alltid fyrfärg, gravyr alltid en ton. */
  colors: number;
  shape: Shape;
  /** Placeringszon (se zonesFor) eller "egen" när kunden klickat på produkten. */
  zone: string;
  /** Egen placering i modellens koordinater, när zone === "egen". */
  point?: [number, number, number];
  normal?: [number, number, number];
  /** Loggans bredd i cm. */
  sizeCm: number;
  /** Egen logga (URL eller data-URL); saknas = företagets logga. */
  logo?: string;
};

type MethodInfo = { label: string; blurb: string; setupPerColor: number; unitPerColor: number; fixedColors?: number; maxColors: number };

export const METHOD_INFO: Record<Method, MethodInfo> = {
  screentryck: { label: "Screentryck", blurb: "Klara färger, bäst från 50 st", setupPerColor: 350, unitPerColor: 6, maxColors: 4 },
  transfer: { label: "Transfer", blurb: "Skarpa detaljer, även små upplagor", setupPerColor: 250, unitPerColor: 9, maxColors: 4 },
  brodyr: { label: "Brodyr", blurb: "Exklusiv, tålig och upphöjd", setupPerColor: 300, unitPerColor: 12, maxColors: 4 },
  gravyr: { label: "Gravyr", blurb: "Permanent, ton-i-ton i materialet", setupPerColor: 300, unitPerColor: 14, fixedColors: 1, maxColors: 1 },
  digitaltryck: { label: "Digitaltryck", blurb: "Fyrfärg, foton och övertoningar", setupPerColor: 400, unitPerColor: 16, fixedColors: 4, maxColors: 4 },
};

export const SHAPE_LABEL: Record<Shape, string> = { original: "Original", rund: "Rund", kvadrat: "Kvadrat", rektangel: "Rektangel" };

/** Staffling: styckpriset sjunker med antal. */
const tier = (qty: number) => (qty >= 250 ? 0.7 : qty >= 100 ? 0.8 : qty >= 50 ? 0.9 : 1);

export function colorsOf(d: Pick<LogoDesign, "method" | "colors">) {
  const info = METHOD_INFO[d.method];
  return info.fixedColors ?? Math.min(info.maxColors, Math.max(1, Math.round(d.colors)));
}

export function markingPrice(d: LogoDesign, qty: number) {
  const info = METHOD_INFO[d.method];
  const colors = colorsOf(d);
  // Digitaltryck prissätts som en färgkanal oavsett motiv; brodyr blir dyrare över 8 cm.
  const channels = d.method === "digitaltryck" ? 1 : colors;
  const sizeFactor = d.method === "brodyr" && d.sizeCm > 8 ? 1.4 : 1;
  return {
    perUnit: Math.round(info.unitPerColor * channels * tier(qty) * sizeFactor),
    setup: info.setupPerColor * channels,
  };
}

type Kind = "top" | "cap" | "beanie" | "bag" | "drink" | "pen" | "book" | "flat" | "box" | "tech" | "textile" | "lanyard" | "umbrella" | "booth";

function kindOf(f: Family): Kind {
  const n = `${f.subcategory} ${f.name}`.toLowerCase();
  if (/keps/.test(n)) return "cap";
  if (/mössa|buff/.test(n)) return "beanie";
  if (f.shop === "klader" || /väst|förkläde/.test(n)) return "top";
  if (/nyckelband/.test(n)) return "lanyard";
  if (/paraply/.test(n)) return "umbrella";
  if (/mässdisk/.test(n)) return "booth";
  if (f.shop === "vaskor") return "bag";
  if (/mugg|flaska/.test(n)) return "drink";
  if (/penna/.test(n)) return "pen";
  if (/anteckningsbok/.test(n)) return "book";
  if (/skrivbordsmatta|reflex/.test(n)) return "flat";
  if (/presentask|choklad/.test(n)) return "box";
  if (f.shop === "elektronik") return "tech";
  return "textile";
}

/**
 * Placeringszoner: kamerariktning (från var vi "tittar" mot produkten) och förskjutning i
 * bråkdelar av modellens storlek. Meshy-modellerna är vända med framsidan mot +Z.
 */
export type Zone = { id: string; label: string; dir: [number, number, number]; offset: [number, number]; sizeCm?: number };

const Z = (id: string, label: string, dir: [number, number, number], offset: [number, number] = [0, 0], sizeCm?: number): Zone => ({ id, label, dir, offset, sizeCm });

const ZONES: Record<Kind, Zone[]> = {
  top: [Z("brost", "Mitt på bröstet", [0, 0, 1], [0, 0.18]), Z("vanster", "Vänster bröst", [0, 0, 1], [0.12, 0.22], 9), Z("rygg", "Ryggen", [0, 0, -1], [0, 0.15]), Z("arm", "Ärmen", [1, 0, 0], [0, 0.25], 8)],
  cap: [Z("front", "Framsida", [0, 0, 1], [0, 0.12]), Z("sida", "Sidan", [1, 0, 0], [0, 0.1]), Z("bak", "Baksida", [0, 0, -1], [0, 0.05])],
  beanie: [Z("front", "Framsida", [0, 0, 1], [0, -0.15]), Z("sida", "Sidan", [1, 0, 0], [0, -0.15])],
  bag: [Z("front", "Framsida", [0, 0, 1], [0, 0]), Z("ovre", "Övre framsida", [0, 0, 1], [0, 0.2]), Z("sida", "Sidan", [1, 0, 0], [0, 0])],
  drink: [Z("front", "Framsida", [0, 0, 1], [0, 0]), Z("bak", "Baksida", [0, 0, -1], [0, 0])],
  pen: [Z("skaft", "Skaftet", [0, 0, 1], [0, 0])],
  book: [Z("framsida", "Framsidan", [0, 0, 1], [0, 0]), Z("hörn", "Nedre hörnet", [0, 0, 1], [0.2, -0.3])],
  flat: [Z("mitt", "Mitten", [0, 1, 0], [0, 0]), Z("hörn", "Hörnet", [0, 1, 0], [0.3, 0.3])],
  box: [Z("lock", "Locket", [0, 1, 0], [0, 0]), Z("front", "Framsidan", [0, 0, 1], [0, 0])],
  tech: [Z("front", "Framsidan", [0, 0, 1], [0, 0]), Z("ovan", "Ovansidan", [0, 1, 0], [0, 0])],
  textile: [Z("mitt", "Mitten", [0, 0, 1], [0, 0]), Z("hörn", "Hörnet", [0, 0, 1], [0.3, -0.3])],
  lanyard: [Z("band", "Bandet", [0, 0, 1], [0, 0.2])],
  umbrella: [Z("panel", "Panelen", [0, 0.6, 1], [0, 0.25]), Z("ovan", "Toppen", [0, 1, 0], [0, 0])],
  booth: [Z("front", "Framsidan", [0, 0, 1], [0, 0]), Z("topp", "Ovankant", [0, 0, 1], [0, 0.3])],
};

/** Ungefärligt största mått i cm – för att översätta loggans storlek i cm till modellen. */
const SIZE_CM: Record<Kind, number> = { top: 72, cap: 27, beanie: 22, bag: 45, drink: 20, pen: 14, book: 21, flat: 40, box: 25, tech: 14, textile: 140, lanyard: 45, umbrella: 100, booth: 150 };

const METHODS_FOR: Record<Kind, Method[]> = {
  top: ["brodyr", "screentryck", "transfer", "digitaltryck"],
  cap: ["brodyr", "transfer", "screentryck"],
  beanie: ["brodyr", "transfer"],
  bag: ["screentryck", "transfer", "brodyr", "digitaltryck"],
  drink: ["gravyr", "screentryck", "digitaltryck"],
  pen: ["gravyr", "screentryck", "digitaltryck"],
  book: ["digitaltryck", "screentryck", "gravyr"],
  flat: ["digitaltryck", "screentryck"],
  box: ["digitaltryck", "screentryck", "gravyr"],
  tech: ["gravyr", "digitaltryck", "screentryck"],
  textile: ["brodyr", "digitaltryck", "transfer"],
  lanyard: ["screentryck", "transfer", "digitaltryck"],
  umbrella: ["screentryck", "transfer", "digitaltryck"],
  booth: ["digitaltryck", "screentryck"],
};

/** Products that lie flat show their logo on top first. */
const LIES_FLAT = /powerbank|laddare|reflex/i;

export const zonesFor = (f: Family) => {
  const zones = ZONES[kindOf(f)];
  return LIES_FLAT.test(f.name) ? [Z("ovan", "Ovansidan", [0, 1, 0]), ...zones.filter((z) => z.id !== "ovan")] : zones;
};
export const methodsFor = (f: Family) => METHODS_FOR[kindOf(f)];
/** Largest real dimension in cm; the 3D models are normalised to this. */
export const sizeCmFor = (f: Family) => (/reflex/i.test(f.name) ? 7 : SIZE_CM[kindOf(f)]);
export const maxSizeCm = (f: Family) => Math.max(4, Math.round(sizeCmFor(f) * 0.45));

export function defaultDesign(f: Family): LogoDesign {
  const method = methodsFor(f)[0];
  return { method, colors: METHOD_INFO[method].fixedColors ?? 1, shape: "original", zone: zonesFor(f)[0].id, sizeCm: Math.max(2, Math.round(sizeCmFor(f) * 0.2)), logo: undefined };
}

export function designSummary(f: Family, d: LogoDesign) {
  const zone = d.zone === "egen" ? "Egen placering" : (zonesFor(f).find((z) => z.id === d.zone)?.label ?? d.zone);
  const colors = d.method === "digitaltryck" ? "fyrfärg" : d.method === "gravyr" ? "ton-i-ton" : `${colorsOf(d)} ${colorsOf(d) === 1 ? "färg" : "färger"}`;
  return [METHOD_INFO[d.method].label, colors, zone, d.shape === "original" ? null : SHAPE_LABEL[d.shape], `${d.sizeCm} cm`].filter(Boolean).join(" · ");
}

/** Server-side guard: keep only known values from a client-sent design. */
export function sanitizeDesign(f: Family, raw: unknown): LogoDesign | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const d = raw as Partial<LogoDesign>;
  const method = (METHODS as readonly string[]).includes(d.method as string) && methodsFor(f).includes(d.method as Method) ? (d.method as Method) : null;
  if (!method) return undefined;
  const vec = (v: unknown) => (Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number" && Number.isFinite(n)) ? (v as [number, number, number]) : undefined);
  return {
    method,
    colors: colorsOf({ method, colors: Number(d.colors) || 1 }),
    shape: (SHAPES as readonly string[]).includes(d.shape as string) ? (d.shape as Shape) : "original",
    zone: typeof d.zone === "string" ? d.zone.slice(0, 20) : zonesFor(f)[0].id,
    point: vec(d.point),
    normal: vec(d.normal),
    sizeCm: Math.min(maxSizeCm(f), Math.max(2, Math.round(Number(d.sizeCm) || 6))),
  };
}
