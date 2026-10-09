// Flödesagenten: bedömer varje produkt mot varje tillfälle och skriver data/event-tags.json.
// Kör om när katalogen ändras: npx tsx scripts/tag-events.mts
import { readFileSync, writeFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const { families } = await import("../lib/catalog");
const { EVENT_IDS } = await import("../lib/eventAgent");
const { openai, TEXT_MODEL } = await import("../lib/openai");

const SYSTEM = `You are the merchandise planner at a Swedish promotional products agency. For every product in the catalogue, score how relevant it is for each occasion a customer can pick:
- massa (trade fair, indoors): booth equipment and giveaways that visitors take home – light, cheap per piece, handed out in volume, or worn by booth staff (t-shirts, polos). Bulky winter outerwear is not a fair giveaway.
- kickoff (internal company kick-off, often with outdoor team activities): team apparel the staff wear together, gear for activities (bottles, backpacks, sports bags), things that build team spirit.
- konferens (conference, indoors): what delegates use during the day – notebooks, pens, lanyards, bottles, mugs, laptop sleeves, chargers, tote bags; polos for staff. No outdoor or seasonal items.
- event (evening brand event or party): things guests remember and take home (gift boxes, chocolate, quality mugs), items for staff and bar (aprons), umbrellas for guests. Not workwear or office basics.
- sommar (Swedish summer party or summer gift, outdoors in warm weather): t-shirts, caps, towels, picnic blankets, cooler bags, bottles, sunny-day items, speakers. Never warm winter items such as beanies, neck warmers worn for cold, fleece, softshell or rain jackets, and never winter safety gear.
- julklapp (Christmas gift to employees or clients, Swedish winter): quality gifts people keep – beanies, hoodies, fleece, blankets, tumblers and thermos bottles, chocolate and gift boxes, tech, notebooks. Not cheap giveaways (pens, lanyards, reflectors) and not summer-only items (beach towels, cooler bags, picnic blankets).

Score each occasion 0-3: 3 = a perfect, obvious fit; 2 = a good fit a seller would happily suggest; 1 = possible but not typical; 0 = wrong for the occasion. Be strict and realistic – a product typically fits 1-3 occasions well. note: one short Swedish sentence explaining the main fit.`;

const scoreProps = Object.fromEntries(EVENT_IDS.map((id) => [id, { type: "integer", minimum: 0, maximum: 3 }]));
const schema = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "scores", "note"],
        properties: { id: { type: "string" }, scores: { type: "object", additionalProperties: false, required: [...EVENT_IDS], properties: scoreProps }, note: { type: "string" } },
      },
    },
  },
};

const list = families.map((f) => `${f.id}: ${f.name} – ${f.subcategory}, ${f.material.replace(/;/g, ", ")}. ${f.short}`).join("\n");
const res = await openai().responses.create({
  model: TEXT_MODEL,
  input: [
    { role: "system", content: SYSTEM },
    { role: "user", content: `Score every product below. Return exactly one item per product id.\n\n${list}` },
  ],
  text: { format: { type: "json_schema", name: "event_tags", schema, strict: true } },
});
const out = JSON.parse(res.output_text) as { items: { id: string; scores: Record<string, number>; note: string }[] };

const tags: Record<string, { scores: Record<string, number>; note: string }> = {};
for (const it of out.items) if (families.some((f) => f.id === it.id)) tags[it.id] = { scores: it.scores, note: it.note };
const missing = families.filter((f) => !tags[f.id]).map((f) => f.id);
if (missing.length) throw new Error(`Agenten missade: ${missing.join(", ")}`);

writeFileSync("data/event-tags.json", `${JSON.stringify({ model: TEXT_MODEL, createdAt: new Date().toISOString(), tags }, null, 2)}\n`);
for (const ev of EVENT_IDS) {
  const picked = families.filter((f) => tags[f.id].scores[ev] >= 2).map((f) => `${f.name}(${tags[f.id].scores[ev]})`);
  console.log(`${ev} [${picked.length}]: ${picked.join(", ")}`);
}
