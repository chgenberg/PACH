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
};

export const EVENTS: EventDef[] = [
  {
    slug: "massa",
    name: "Mässa",
    tone: "#d7ecfb",
    ink: "#16324a",
    wide: true,
    hint: "Monter, giveaways och det som syns på håll",
    hero: "DEMO-P040",
  },
  {
    slug: "kickoff",
    name: "Kick-off",
    tone: "#f7d7e4",
    ink: "#4a1730",
    hint: "Profilkläder och produkter som bygger laget",
    hero: "DEMO-P004",
  },
  {
    slug: "konferens",
    name: "Konferens",
    tone: "#eceaf1",
    ink: "#2b2433",
    hint: "Block, pennor och teknik för deltagarna",
    hero: "DEMO-P026",
  },
  {
    slug: "sommar",
    name: "Sommar",
    tone: "#f6e38b",
    ink: "#3d3208",
    hint: "Utomhus, sol och svalka",
    hero: "DEMO-P035",
  },
  {
    slug: "event",
    name: "Event & fest",
    tone: "#f8e4cf",
    ink: "#4a2a12",
    hint: "Mingel, bar och det gästerna minns",
    hero: "DEMO-P038",
  },
  {
    slug: "julklapp",
    name: "Julklapp & gåva",
    tone: "#f4d4d2",
    ink: "#4a1814",
    hint: "Något att ge bort och ta med hem",
    hero: "DEMO-P039",
  },
];

export const eventOf = (slug: string): EventDef | null => EVENTS.find((e) => e.slug === slug) ?? null;

/** Produkter som flödesagenten taggat för den här händelsen. */
export const familiesForEvent = (slug: EventId) => families.filter((f) => eventTags(f).includes(slug));

export { EVENT_IDS };
export type { EventId };
