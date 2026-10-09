import type { Family } from "@/lib/catalog";

/**
 * Flödesagenten.
 *
 * Taggar varje produkt med de HÄNDELSER (flöden) där den passar, t.ex. mässa, kick-off,
 * konferens. Just nu är det en deterministisk regelmotor som läser produktens kategori,
 * underkategori och namn. När katalogen växer till tiotusentals artiklar kan samma kontrakt
 * (Family -> EventId[]) bytas ut mot en LLM som kör en gång och skriver taggarna till katalogen –
 * resten av appen behöver inte ändras.
 */

export const EVENT_IDS = ["massa", "kickoff", "konferens", "event", "sommar", "julklapp"] as const;
export type EventId = (typeof EVENT_IDS)[number];

export const isEventId = (v: unknown): v is EventId =>
  typeof v === "string" && (EVENT_IDS as readonly string[]).includes(v);

export function eventTags(family: Family): EventId[] {
  const shop = family.shop;
  const sub = family.subcategory.toLowerCase();
  const name = family.name.toLowerCase();
  const tags = new Set<EventId>();
  const is = (...keys: string[]) => keys.some((k) => sub.includes(k) || name.includes(k));

  const apparel = shop === "klader";
  const tshirt = is("t-shirt", "piké", "funktions");
  const headwear = is("keps", "mössa", "buff");

  // MÄSSA – breda giveaways och monter
  if (shop === "massa-event" || shop === "pennor" || shop === "godis") tags.add("massa");
  if (tshirt || headwear) tags.add("massa");
  if (is("tygkasse", "ryggsäck")) tags.add("massa");
  if (is("flaska", "mugg")) tags.add("massa");
  if (is("reflex", "nyckelband")) tags.add("massa");

  // KICK-OFF – lagkänsla, profilkläder och produkter som engagerar
  if (apparel) tags.add("kickoff");
  if (is("ryggsäck", "sportväska", "sportbag")) tags.add("kickoff");
  if (is("termosmugg", "vattenflaska", "termosflaska")) tags.add("kickoff");
  if (shop === "godis" || is("högtalare")) tags.add("kickoff");

  // KONFERENS – professionellt, för deltagarna
  if (shop === "pennor" || shop === "elektronik") tags.add("konferens");
  if (is("anteckningsbok", "skrivbord", "nyckelband", "mugg", "flaska")) tags.add("konferens");
  if (is("tygkasse", "datorfodral", "piké")) tags.add("konferens");

  // EVENT & FEST – mingel och gäster
  if (shop === "godis") tags.add("event");
  if (is("presentask", "badhandduk", "picknick", "förkläde", "filt")) tags.add("event");
  if (is("keramikmugg", "mugg", "paraply")) tags.add("event");
  if (is("keps", "t-shirt")) tags.add("event");

  // SOMMAR – utomhus och sol
  if (tshirt || headwear) tags.add("sommar");
  if (is("badhandduk", "picknick", "kylväska", "tygkasse")) tags.add("sommar");
  if (is("vattenflaska", "glasflaska", "termosflaska", "paraply")) tags.add("sommar");
  if (is("högtalare") || shop === "godis") tags.add("sommar");

  // JULKLAPP & GÅVA – något att ge bort och ta med hem
  if (is("choklad", "presentask")) tags.add("julklapp");
  if (is("termosmugg", "keramikmugg", "anteckningsbok", "filt", "badhandduk")) tags.add("julklapp");
  if (shop === "elektronik") tags.add("julklapp");
  if (is("hoodie", "mössa", "buff", "ryggsäck")) tags.add("julklapp");

  // Varje produkt syns åtminstone på mässan
  if (tags.size === 0) tags.add("massa");
  return EVENT_IDS.filter((id) => tags.has(id));
}
