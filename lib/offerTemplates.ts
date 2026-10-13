/** Offer templates and the seller profile – client-safe types, defaults and sanitizers. */

export const LAYOUTS = ["bildfokus", "detaljerad", "kompakt"] as const;
export type Layout = (typeof LAYOUTS)[number];

export const LAYOUT_INFO: Record<Layout, { label: string; blurb: string }> = {
  bildfokus: { label: "Bildfokus", blurb: "Omslag med kundens miljö, stora produktbilder och kort text." },
  detaljerad: { label: "Detaljerad", blurb: "Allt per rad: à-pris, tryck per position, korrektur, leverans och villkor." },
  kompakt: { label: "Kompakt", blurb: "Bilder och radsummor på en sida. Korrektur som tillval." },
};

export const SHOW_KEYS = ["cover", "prices", "unitPrices", "printSpec", "proofs", "delivery", "terms", "vat", "contact"] as const;
export type ShowKey = (typeof SHOW_KEYS)[number];
export type Show = Record<ShowKey, boolean>;

export const SHOW_LABEL: Record<ShowKey, { label: string; hint: string }> = {
  cover: { label: "Omslagsbild", hint: "Kundens miljöbild, annars produkterna i ett kollage" },
  prices: { label: "Priser", hint: "Radsummor och totalbelopp" },
  unitPrices: { label: "À-pris och startkostnad", hint: "Pris per styck inkl. tryck" },
  printSpec: { label: "Tryckdetaljer", hint: "Metod, placering, färger och storlek per position" },
  proofs: { label: "3D-korrektur", hint: "Korrekturbilderna, med kommentarer på bilden" },
  delivery: { label: "Leveransdatum", hint: "Beräknad leverans per rad" },
  terms: { label: "Villkor", hint: "Giltighet och betalvillkor" },
  vat: { label: "Moms", hint: "Belopp inklusive moms" },
  contact: { label: "Kontaktperson", hint: "Ditt namn, bild och kontaktuppgifter" },
};

export type OfferTemplate = { id: string; name: string; layout: Layout; intro: string; show: Show; builtin?: boolean };

const ALL_ON: Show = { cover: true, prices: true, unitPrices: true, printSpec: true, proofs: true, delivery: true, terms: true, vat: true, contact: true };

export const BUILTIN_TEMPLATES: OfferTemplate[] = [
  {
    id: "t-bildfokus",
    name: "Bildfokus",
    layout: "bildfokus",
    intro: "Här är vårt förslag – era produkter med er logga. Säg till vad ni tycker, så tar vi fram priser och korrektur.",
    show: { ...ALL_ON, prices: false, unitPrices: false, printSpec: false, proofs: false, terms: false, vat: false },
    builtin: true,
  },
  {
    id: "t-detaljerad",
    name: "Detaljerad",
    layout: "detaljerad",
    intro: "Titta på 3D-korrekturet, kommentera direkt på bilden och godkänn. Ordern binds när ni godkänner offert och korrektur – inte förr.",
    show: { ...ALL_ON, cover: false },
    builtin: true,
  },
  {
    id: "t-kompakt",
    name: "Kompakt",
    layout: "kompakt",
    intro: "Sammanställning av offerten. Godkänn raderna så sätter vi igång.",
    show: { ...ALL_ON, cover: false, unitPrices: false, printSpec: false, proofs: false, terms: false },
    builtin: true,
  },
];

export const DEFAULT_TEMPLATE_ID = "t-detaljerad";
export const isTemplateId = (v: unknown): v is string => typeof v === "string" && /^t-[a-z0-9-]{3,40}$/.test(v);

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max) : "");

export function sanitizeShow(raw: unknown, fallback: Show): Show {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const show = Object.fromEntries(SHOW_KEYS.map((k) => [k, typeof o[k] === "boolean" ? o[k] : fallback[k]])) as Show;
  // À-pris without prices makes no sense; neither does a price breakdown of hidden prices.
  if (!show.prices) show.unitPrices = false;
  return show;
}

export function sanitizeTemplate(raw: unknown, fallback: OfferTemplate): OfferTemplate {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    id: fallback.id,
    name: text(o.name, 40) || fallback.name,
    layout: LAYOUTS.includes(o.layout as Layout) ? (o.layout as Layout) : fallback.layout,
    intro: typeof o.intro === "string" ? text(o.intro, 600) : fallback.intro,
    show: sanitizeShow(o.show, fallback.show),
    ...(fallback.builtin ? { builtin: true } : {}),
  };
}

/** How one offer is presented: the template, possibly with the seller's tweaks for this send. */
export type Presentation = { templateId: string; name: string; layout: Layout; intro: string; show: Show };

export const presentationOf = (t: OfferTemplate): Presentation => ({ templateId: t.id, name: t.name, layout: t.layout, intro: t.intro, show: t.show });

/** Offers shared before templates existed look like the detailed template. */
export const DEFAULT_PRESENTATION = presentationOf(BUILTIN_TEMPLATES[1]);

export function sanitizePresentation(raw: unknown, templates: OfferTemplate[]): Presentation {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const t = templates.find((x) => x.id === o.templateId) ?? templates.find((x) => x.id === DEFAULT_TEMPLATE_ID) ?? BUILTIN_TEMPLATES[1];
  return {
    templateId: t.id,
    name: t.name,
    layout: LAYOUTS.includes(o.layout as Layout) ? (o.layout as Layout) : t.layout,
    intro: typeof o.intro === "string" ? text(o.intro, 600) : t.intro,
    show: sanitizeShow(o.show, t.show),
  };
}

export type SellerProfile = { name: string; title: string; email: string; phone: string; photo?: string };

export const DEFAULT_SELLER: SellerProfile = { name: "Sara Lindqvist", title: "Kundansvarig", email: "sara@pach.se", phone: "070-123 45 67" };

export function sanitizeSeller(raw: unknown): SellerProfile {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const photo = typeof o.photo === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(o.photo) && o.photo.length < 600_000 ? o.photo : undefined;
  return {
    name: text(o.name, 60),
    title: text(o.title, 60),
    email: text(o.email, 80),
    phone: text(o.phone, 30),
    ...(photo ? { photo } : {}),
  };
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("") || "?";
