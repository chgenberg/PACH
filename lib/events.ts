import { families } from "@/lib/catalog";
import { eventTags, EVENT_IDS, type EventId } from "@/lib/eventAgent";

export type EventDef = {
  slug: EventId;
  name: string;
  tone: string;
  ink: string;
  hint: string;
  /** Produkt-id vars bild används som motiv i rutan. */
  hero: string;
  wide?: boolean;
  /** Neutral "DIN LOGO"-scen som brandas med kundens logga. */
  scene: string;
  /** Laddningstexter som visas medan scenen och produkterna skapas. */
  stages: string[];
};

const PRODUCT_STAGES = ["Lägger er logga på produkterna…", "Kvalitetsgranskar bilderna…", "Sista detaljerna…"];

export const EVENTS: EventDef[] = [
  {
    slug: "massa",
    name: "Mässa",
    tone: "#d7ecfb",
    ink: "#16324a",
    wide: true,
    hint: "Monter, giveaways och det som syns på håll",
    hero: "DEMO-P040",
    scene: "/scenes/massa.jpg",
    stages: ["Bygger montern…", "Trycker mässväggen…", "Klär personalen i profilkläder…", ...PRODUCT_STAGES],
  },
  {
    slug: "kickoff",
    name: "Kick-off",
    tone: "#f7d7e4",
    ink: "#4a1730",
    hint: "Profilkläder och produkter som bygger laget",
    hero: "DEMO-P004",
    scene: "/scenes/kickoff.jpg",
    stages: ["Klär lokalen…", "Trycker bannerväggen…", "Klär laget i hoodies…", ...PRODUCT_STAGES],
  },
  {
    slug: "konferens",
    name: "Konferens",
    tone: "#eceaf1",
    ink: "#2b2433",
    hint: "Block, pennor och teknik för deltagarna",
    hero: "DEMO-P026",
    scene: "/scenes/konferens.jpg",
    stages: ["Bygger scenen…", "Trycker scenväggen…", "Dukar registreringen…", ...PRODUCT_STAGES],
  },
  {
    slug: "sommar",
    name: "Sommar",
    tone: "#f6e38b",
    ink: "#3d3208",
    hint: "Utomhus, sol och svalka",
    hero: "DEMO-P035",
    scene: "/scenes/sommar.jpg",
    stages: ["Dukar upp vid sjön…", "Trycker fotoväggen…", "Klär laget i sommarkläder…", ...PRODUCT_STAGES],
  },
  {
    slug: "event",
    name: "Event & fest",
    tone: "#f8e4cf",
    ink: "#4a2a12",
    hint: "Mingel, bar och det gästerna minns",
    hero: "DEMO-P038",
    scene: "/scenes/event.jpg",
    stages: ["Bygger eventet…", "Trycker fotoväggen…", "Ställer i ordning baren…", ...PRODUCT_STAGES],
  },
  {
    slug: "julklapp",
    name: "Julklapp & gåva",
    tone: "#f4d4d2",
    ink: "#4a1814",
    hint: "Något att ge bort och ta med hem",
    hero: "DEMO-P039",
    scene: "/scenes/julklapp.jpg",
    stages: ["Dukar julbordet…", "Slår in paketen…", "Trycker presentaskarna…", ...PRODUCT_STAGES],
  },
];

export const eventOf = (slug: string): EventDef | null => EVENTS.find((e) => e.slug === slug) ?? null;

/** Produkter som flödesagenten taggat för den här händelsen. */
export const familiesForEvent = (slug: EventId) => families.filter((f) => eventTags(f).includes(slug));

export { EVENT_IDS };
export type { EventId };
