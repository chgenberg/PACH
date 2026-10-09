import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { EventId } from "@/lib/eventAgent";
import { eventOf, familiesForEvent } from "@/lib/events";
import { errorMessage, openai, TEXT_MODEL } from "@/lib/openai";
import { brandRev, readAnalysis } from "@/lib/siteAnalysis";

export type Idea = { productId: string; reason: string };

const DIR = path.join(process.cwd(), ".data", "ideas");

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["ideas"],
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["productId", "reason"],
        properties: { productId: { type: "string" }, reason: { type: "string" } },
      },
    },
  },
} as const;

/** Products from our catalogue that fit what this company actually does, with a one-line why. */
export async function ideasFor(host: string, event: EventId): Promise<Idea[]> {
  const analysis = await readAnalysis(host);
  if (!analysis) return [];
  const rev = await brandRev(host);
  const file = path.join(DIR, `${createHash("sha1").update(`i1|${host}|${rev}|${event}`).digest("hex").slice(0, 24)}.json`);
  const hit = await readFile(file, "utf8").catch(() => null);
  if (hit) return JSON.parse(hit) as Idea[];

  const candidates = familiesForEvent(event);
  const ids = new Set(candidates.map((f) => f.id));
  const ev = eventOf(event);
  try {
    const res = await openai().responses.create(
      {
        model: TEXT_MODEL,
        input: [
          {
            role: "system",
            content: `Du är en kreativ svensk profilproduktsrådgivare. Välj de 4 produkter ur listan som passar just det här företaget bäst för tillfället, utifrån vad de gör och säljer – inte generiska val.
reason: en kort mening på svenska (max 90 tecken) som kopplar produkten till företagets verksamhet, t.ex. "Ni säljer kaffe – en termosmugg tar varumärket till varje morgonmöte."
Använd bara productId ur listan. Hitta aldrig på egenskaper, certifieringar eller hållbarhetspåståenden.`,
          },
          {
            role: "user",
            content: `Företag: ${analysis.brandName || host}
Bransch: ${analysis.industryEn || "okänd"}
Erbjudande: ${analysis.offeringEn || "okänt"}
Ton: ${analysis.tone || "-"}
Tillfälle: ${ev?.name ?? event} – ${ev?.hint ?? ""}
Produkter (id | namn | typ):
${candidates.map((f) => `${f.id} | ${f.name} | ${f.subcategory}`).join("\n")}`,
          },
        ],
        text: { format: { type: "json_schema", name: "ideas", schema: schema as unknown as Record<string, unknown>, strict: true } },
      },
      { timeout: 45_000, maxRetries: 1 },
    );
    const raw = (JSON.parse(res.output_text) as { ideas: Idea[] }).ideas ?? [];
    const ideas = raw
      .filter((i, k, a) => ids.has(i.productId) && a.findIndex((x) => x.productId === i.productId) === k)
      .slice(0, 4)
      .map((i) => ({ productId: i.productId, reason: String(i.reason).slice(0, 120) }));
    await mkdir(DIR, { recursive: true });
    await writeFile(file, JSON.stringify(ideas));
    return ideas;
  } catch (err) {
    console.error("ideas", errorMessage(err));
    return [];
  }
}
