import type { EventId } from "@/lib/eventAgent";

/**
 * Färdiga paket per tillfälle. Antal skalar med antalet personer (perPerson) eller är fasta
 * (fixed, t.ex. personalens tröjor eller en mässdisk). Bara produkter som flödesagenten
 * bedömt som relevanta för tillfället används.
 */
export type PackageLine = { id: string; perPerson?: number; fixed?: number };
export type Tier = { id: "bas" | "plus" | "premium"; name: string; pitch: string; lines: PackageLine[] };
export type EventPackages = { people: string; perPerson: string; defaultPeople: number; tiers: Tier[] };

export const PACKAGES: Record<EventId, EventPackages> = {
  massa: {
    people: "besökare",
    perPerson: "per besökare",
    defaultPeople: 500,
    tiers: [
      { id: "bas", name: "Bas", pitch: "Det som syns och delas ut", lines: [{ id: "DEMO-P024", perPerson: 1 }, { id: "DEMO-P028", perPerson: 0.4 }, { id: "DEMO-P001", fixed: 6 }] },
      { id: "plus", name: "Plus", pitch: "Giveaways som följer med hem", lines: [{ id: "DEMO-P024", perPerson: 1 }, { id: "DEMO-P014", perPerson: 0.4 }, { id: "DEMO-P030", perPerson: 0.4 }, { id: "DEMO-P003", fixed: 6 }] },
      { id: "premium", name: "Premium", pitch: "Hela montern, klar att ställa upp", lines: [{ id: "DEMO-P040", fixed: 1 }, { id: "DEMO-P024", perPerson: 1 }, { id: "DEMO-P014", perPerson: 0.4 }, { id: "DEMO-P026", perPerson: 0.2 }, { id: "DEMO-P011", perPerson: 0.15 }, { id: "DEMO-P003", fixed: 6 }] },
    ],
  },
  kickoff: {
    people: "deltagare",
    perPerson: "per deltagare",
    defaultPeople: 80,
    tiers: [
      { id: "bas", name: "Bas", pitch: "Samma tröja, samma lag", lines: [{ id: "DEMO-P001", perPerson: 1 }, { id: "DEMO-P020", perPerson: 1 }] },
      { id: "plus", name: "Plus", pitch: "Hoodie och keps till alla", lines: [{ id: "DEMO-P004", perPerson: 1 }, { id: "DEMO-P011", perPerson: 1 }, { id: "DEMO-P020", perPerson: 1 }] },
      { id: "premium", name: "Premium", pitch: "Utrustade för hela dagen", lines: [{ id: "DEMO-P004", perPerson: 1 }, { id: "DEMO-P015", perPerson: 1 }, { id: "DEMO-P011", perPerson: 1 }, { id: "DEMO-P020", perPerson: 1 }] },
    ],
  },
  konferens: {
    people: "deltagare",
    perPerson: "per deltagare",
    defaultPeople: 150,
    tiers: [
      { id: "bas", name: "Bas", pitch: "Det deltagarna behöver", lines: [{ id: "DEMO-P028", perPerson: 1 }, { id: "DEMO-P024", perPerson: 1 }, { id: "DEMO-P026", perPerson: 1 }] },
      { id: "plus", name: "Plus", pitch: "Välkomstkit i tygkasse", lines: [{ id: "DEMO-P028", perPerson: 1 }, { id: "DEMO-P024", perPerson: 1 }, { id: "DEMO-P026", perPerson: 1 }, { id: "DEMO-P014", perPerson: 1 }, { id: "DEMO-P020", perPerson: 1 }] },
      { id: "premium", name: "Premium", pitch: "Exklusivt kit med teknik", lines: [{ id: "DEMO-P028", perPerson: 1 }, { id: "DEMO-P025", perPerson: 1 }, { id: "DEMO-P026", perPerson: 1 }, { id: "DEMO-P014", perPerson: 1 }, { id: "DEMO-P031", perPerson: 1 }] },
    ],
  },
  event: {
    people: "gäster",
    perPerson: "per gäst",
    defaultPeople: 120,
    tiers: [
      { id: "bas", name: "Bas", pitch: "Något sött att ta med hem", lines: [{ id: "DEMO-P039", perPerson: 1 }] },
      { id: "plus", name: "Plus", pitch: "Gåva och profilerad bar", lines: [{ id: "DEMO-P039", perPerson: 1 }, { id: "DEMO-P022", perPerson: 1 }, { id: "DEMO-P037", fixed: 4 }] },
      { id: "premium", name: "Premium", pitch: "Gåvan gästerna minns", lines: [{ id: "DEMO-P038", perPerson: 1 }, { id: "DEMO-P039", perPerson: 1 }, { id: "DEMO-P037", fixed: 4 }, { id: "DEMO-P029", perPerson: 0.2 }] },
    ],
  },
  sommar: {
    people: "deltagare",
    perPerson: "per deltagare",
    defaultPeople: 60,
    tiers: [
      { id: "bas", name: "Bas", pitch: "T-shirt och keps till alla", lines: [{ id: "DEMO-P001", perPerson: 1 }, { id: "DEMO-P011", perPerson: 1 }] },
      { id: "plus", name: "Plus", pitch: "Redo för stranden", lines: [{ id: "DEMO-P001", perPerson: 1 }, { id: "DEMO-P011", perPerson: 1 }, { id: "DEMO-P020", perPerson: 1 }, { id: "DEMO-P036", perPerson: 1 }] },
      { id: "premium", name: "Premium", pitch: "Hela sommarfesten", lines: [{ id: "DEMO-P001", perPerson: 1 }, { id: "DEMO-P011", perPerson: 1 }, { id: "DEMO-P020", perPerson: 1 }, { id: "DEMO-P036", perPerson: 1 }, { id: "DEMO-P035", perPerson: 0.25 }, { id: "DEMO-P018", perPerson: 0.15 }, { id: "DEMO-P034", fixed: 2 }] },
    ],
  },
  julklapp: {
    people: "mottagare",
    perPerson: "per mottagare",
    defaultPeople: 50,
    tiers: [
      { id: "bas", name: "Bas", pitch: "Varm dryck och choklad", lines: [{ id: "DEMO-P021", perPerson: 1 }, { id: "DEMO-P039", perPerson: 1 }] },
      { id: "plus", name: "Plus", pitch: "Mössa, mugg och choklad", lines: [{ id: "DEMO-P012", perPerson: 1 }, { id: "DEMO-P021", perPerson: 1 }, { id: "DEMO-P039", perPerson: 1 }] },
      { id: "premium", name: "Premium", pitch: "Julklappen man behåller", lines: [{ id: "DEMO-P004", perPerson: 1 }, { id: "DEMO-P019", perPerson: 1 }, { id: "DEMO-P039", perPerson: 1 }] },
    ],
  },
};

/** Quantities for a number of people: at least 10, rounded up to the nearest 5 above 20. */
export function packageQty(line: PackageLine, people: number) {
  if (line.fixed) return line.fixed;
  const raw = Math.ceil((line.perPerson ?? 1) * Math.max(1, people));
  const q = Math.max(10, raw);
  return q > 20 ? Math.ceil(q / 5) * 5 : q;
}
