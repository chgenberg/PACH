import type { Family } from "@/lib/catalog";
import tagged from "@/data/event-tags.json";

/**
 * Flödesagenten.
 *
 * Avgör vilka produkter som passar vilket tillfälle. En språkmodell (scripts/tag-events.mts) bedömer
 * varje produkt mot varje tillfälle 0–3 utifrån tydliga kriterier – bl.a. årstid (ingen mössa till
 * sommaren, inga strandhanddukar som julklapp) och användning (giveaways på mässan, kvalitetsgåvor
 * som julklapp). Poängen ligger i data/event-tags.json; produkter som ännu inte bedömts faller
 * tillbaka på en regelmotor. Kör om skriptet när katalogen ändras.
 */

export const EVENT_IDS = ["massa", "kickoff", "konferens", "event", "sommar", "julklapp"] as const;
export type EventId = (typeof EVENT_IDS)[number];

export const isEventId = (v: unknown): v is EventId => typeof v === "string" && (EVENT_IDS as readonly string[]).includes(v);

/** Score 2 = a good fit a seller would suggest; 3 = obvious fit. */
export const RELEVANT = 2;

const TAGS = (tagged as { tags: Record<string, { scores: Record<string, number> }> }).tags;

export function eventScore(family: Family, ev: EventId): number {
  const s = TAGS[family.id]?.scores[ev];
  return typeof s === "number" ? s : ruleTags(family).includes(ev) ? RELEVANT : 0;
}

export function eventTags(family: Family): EventId[] {
  return EVENT_IDS.filter((ev) => eventScore(family, ev) >= RELEVANT);
}

/** Fallback for products the agent has not scored yet. */
function ruleTags(family: Family): EventId[] {
  const shop = family.shop;
  const sub = family.subcategory.toLowerCase();
  const name = family.name.toLowerCase();
  const tags = new Set<EventId>();
  const is = (...keys: string[]) => keys.some((k) => sub.includes(k) || name.includes(k));

  const apparel = shop === "klader";
  const tshirt = is("t-shirt", "piké", "funktions");
  const warm = is("mössa", "buff", "fleece", "softshell", "jacka", "hoodie", "sweatshirt");

  // MÄSSA – giveaways och personal i montern
  if (shop === "massa-event" || shop === "pennor") tags.add("massa");
  if (tshirt || is("keps", "tygkasse", "nyckelband", "reflex")) tags.add("massa");

  // KICK-OFF – lagkänsla och aktiviteter
  if (apparel || is("ryggsäck", "sportväska", "sportbag", "vattenflaska", "termosflaska")) tags.add("kickoff");

  // KONFERENS – för deltagarna under dagen
  if (shop === "pennor" || shop === "elektronik") tags.add("konferens");
  if (is("anteckningsbok", "nyckelband", "mugg", "flaska", "tygkasse", "datorfodral", "piké")) tags.add("konferens");

  // EVENT & FEST – det gästerna minns
  if (shop === "godis" || is("presentask", "förkläde", "keramikmugg", "paraply")) tags.add("event");

  // SOMMAR – utomhus i värmen, inget vinterplagg
  if ((tshirt || is("keps")) && !warm) tags.add("sommar");
  if (is("badhandduk", "picknick", "kylväska", "vattenflaska", "glasflaska", "högtalare")) tags.add("sommar");

  // JULKLAPP – kvalitetsgåvor man behåller, inga giveaways eller sommarvaror
  if (warm || is("choklad", "presentask", "termosmugg", "termosflaska", "filt") || shop === "elektronik") tags.add("julklapp");

  if (tags.size === 0) tags.add("massa");
  return EVENT_IDS.filter((id) => tags.has(id));
}
