import { families } from "@/lib/catalog";
import { METHOD_INFO, METHODS, methodsFor, type Method } from "@/lib/marking";

export type PrintPage = {
  slug: Method;
  lede: string;
  areas: string;
  maxSize: string;
  maxColors: string;
  underprint?: string;
  cheapestWhen: string;
  file: string;
};

export const PRINT_PAGES: Record<Method, PrintPage> = {
  screentryck: {
    slug: "screentryck",
    lede: "En färg i taget genom en schablon. Klara PMS-toner och den mest hållbara märkningen på textil när upplagan är större.",
    areas: "Framsida, baksida och ärm på plagg. Panel på paraply. Skaft på penna.",
    maxSize: "Framsida/baksida ca 33 × 48 cm. Ärm ca 8 × 7 cm.",
    maxColors: "Upp till 8 tryckfärger på textil. Färre på hårda ytor.",
    underprint: "På mörka plagg kan ett vitt undertryck krävas – det räknas som en extra färg.",
    cheapestWhen: "Bäst från 50 stycken när loggan har en till tre raka färger.",
    file: "Vektor: PDF, SVG, AI eller EPS. Bitmap går att skicka – vi hjälper till att rita om.",
  },
  transfer: {
    slug: "transfer",
    lede: "Trycket görs på ark och värms sedan på produkten. Bra när många färger ska sitta skarpt, eller när varje plagg ska ha ett eget namn.",
    areas: "Framsida, baksida, ärm, keps och väska.",
    maxSize: "Framsida/baksida ca 33 × 48 cm. Ärm ca 8 × 7 cm.",
    maxColors: "Upp till 8 tryckfärger, eller fullfärg som digital transfer.",
    underprint: "Vitt undertryck på mörka plagg räknas som extra färg.",
    cheapestWhen: "När loggan har flera färger i en mindre upplaga, eller vid namn och nummer.",
    file: "Vektor för raka färger. Foto och övertoning går som digital transfer.",
  },
  brodyr: {
    slug: "brodyr",
    lede: "Tråd i tyget. Upphöjd, tålig och den märkning som känns mest exklusiv på keps, hoodie och piké.",
    areas: "Bröst, rygg, ärm, kepsfront och väska.",
    maxSize: "Ca 33 × 48 cm på stora ytor. Kepsfront ofta under 12 × 6 cm.",
    maxColors: "Upp till 12 trådfärger. Närmaste tråd mot PMS.",
    cheapestWhen: "När loggan är tydlig, inte för liten i detaljerna, och plagget ska användas länge.",
    file: "Vektor. Vi ritar ett brodyrkort första gången – det sparas till nästa order.",
  },
  gravyr: {
    slug: "gravyr",
    lede: "Lasern tar bort det översta skiktet. Permanent, utan färg, och rätt på metall, glas och en del plast.",
    areas: "Mugg, flaska, penna, powerbank och ask.",
    maxSize: "Beror på ytan – ofta 6 × 2 cm på mugg, 6 × 1 cm på penna.",
    maxColors: "Ingen tryckfärg. Tonen kommer från materialet.",
    cheapestWhen: "På hårda presenter där tryckfärg skulle slitas, även i små upplagor.",
    file: "Vektor med tydliga ytor. Tunna linjer under 0,3 mm försvinner.",
  },
  digitaltryck: {
    slug: "digitaltryck",
    lede: "Fullfärg direkt. Foton, övertoningar och små upplagor utan en schablon per färg.",
    areas: "Textil, väska, block, mugg (viss modell) och dekal.",
    maxSize: "Upp till tryckytan på produkten – ofta hela framsidan.",
    maxColors: "CMYK, inget tak i antalet färger.",
    cheapestWhen: "När loggan har foto eller många färger, eller när ni behöver få stycken snabbt.",
    file: "PDF, SVG, PNG eller JPG i hög upplösning. Vektor ger skarpast kant.",
  },
};

export const printPageOf = (slug: string) => (METHODS as readonly string[]).includes(slug) ? PRINT_PAGES[slug as Method] : null;

export const familiesForMethod = (method: Method) => families.filter((f) => methodsFor(f).includes(method));

export const printIndex = METHODS.map((slug) => ({ ...METHOD_INFO[slug], ...PRINT_PAGES[slug] }));
