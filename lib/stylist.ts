import { fitToBudget } from "@/lib/budget";
import { families, familyById, fromPrice } from "@/lib/catalog";
import { estimate } from "@/lib/delivery";
import { EVENT_IDS, eventScore, type EventId } from "@/lib/eventAgent";
import { defaultDesign, METHOD_INFO, methodsFor, type Method } from "@/lib/marking";
import { openai, TEXT_MODEL } from "@/lib/openai";
import { priceLine } from "@/lib/pricing";
import { readAnalysis } from "@/lib/siteAnalysis";

export type StylistMessage = { role: "user" | "assistant"; text: string };
export type StylistLine = { productId: string; name: string; image: string; qty: number; method: Method; methodLabel: string; lineTotal: number; delivery: string; late: boolean };
export type StylistReply = {
  reply: string;
  proposal: { event: EventId | null; needBy: string | null; budget: number | null; people: number | null; lines: StylistLine[]; total: number; overBudget: boolean } | null;
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "propose", "event", "people", "budget", "needBy", "lines"],
  properties: {
    reply: { type: "string" },
    propose: { type: "boolean" },
    event: { type: "string", enum: [...EVENT_IDS, ""] },
    people: { type: "integer" },
    budget: { type: "integer" },
    needBy: { type: "string" },
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["productId", "qty", "method"],
        properties: { productId: { type: "string" }, qty: { type: "integer" }, method: { type: "string" } },
      },
    },
  },
} as const;

function catalogText() {
  return families
    .map((f) => {
      const tags = EVENT_IDS.filter((e) => eventScore(f, e) >= 2).join(",");
      return `${f.id} | ${f.name} | ${f.subcategory} | från ${Math.round(fromPrice(f))} kr | metoder: ${methodsFor(f).join("/")} | passar: ${tags || "-"}`;
    })
    .join("\n");
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Turn a brief into a priced, delivery-checked cart. The model only picks catalogue ids; prices and dates are ours. */
export async function stylist(messages: StylistMessage[], host?: string): Promise<StylistReply> {
  const analysis = host ? await readAnalysis(host).catch(() => null) : null;
  const brandLine = analysis
    ? `Kunden: ${analysis.brandName || host}${analysis.industryEn ? `, bransch ${analysis.industryEn}` : ""}${analysis.offeringEn ? `, erbjuder ${analysis.offeringEn}` : ""}${analysis.tone ? `, ton ${analysis.tone}` : ""}.`
    : host
      ? `Kunden: ${host}.`
      : "";
  const today = iso(new Date());

  const res = await openai().responses.create(
    {
      model: TEXT_MODEL,
      input: [
        {
          role: "system",
          content: `Du är PACH:s merch-stylist – en erfaren svensk profilproduktsrådgivare. Du hjälper företag att välja rätt profilprodukter med deras logga.
Dagens datum: ${today}. ${brandLine}
Arbetssätt:
- Ta reda på tillfälle, antal personer, budget och när produkterna behövs. Fråga kort om det som saknas – högst en fråga i taget, och föreslå direkt om du har tillräckligt (antal + tillfälle räcker).
- När du föreslår: propose=true, 2–6 produkter ur katalogen nedan som passar tillfället och varandra, ett antal per produkt (oftast ett per person för kläder/flaskor, fler för giveaways, 1 för mässdisk), och en märkmetod per rad bland produktens tillåtna metoder.
- Håll dig inom budget om den finns. Priserna i katalogen är från-priser exkl. tryck; tryck tillkommer. Servern räknar exakt pris och leverans och skalar om antalen vid behov – du behöver inte räkna.
- Använd bara productId som finns i katalogen. Hitta aldrig på produkter, priser, certifieringar eller leveranslöften.
- reply: kort, varm och konkret svenska (max 3 meningar). Motivera valet i en mening när du föreslår.
- event: ett av ${EVENT_IDS.join(", ")} eller tom sträng. people/budget: 0 om okänt. needBy: YYYY-MM-DD eller tom sträng.
Katalog (id | namn | typ | pris | metoder | passar):
${catalogText()}`,
        },
        ...messages.slice(-12).map((m) => ({ role: m.role, content: m.text.slice(0, 2000) })),
      ],
      text: { format: { type: "json_schema", name: "stylist", schema: schema as unknown as Record<string, unknown>, strict: true } },
    },
    { timeout: 60_000, maxRetries: 1 },
  );
  const out = JSON.parse(res.output_text) as { reply: string; propose: boolean; event: string; people: number; budget: number; needBy: string; lines: { productId: string; qty: number; method: string }[] };

  if (!out.propose) return { reply: out.reply, proposal: null };

  const picked = out.lines
    .map((l) => {
      const family = familyById(l.productId);
      if (!family) return null;
      const methods = methodsFor(family);
      const method = (methods as string[]).includes(l.method) ? (l.method as Method) : methods[0];
      const design = { ...defaultDesign(family), method, colors: METHOD_INFO[method].fixedColors ?? 1 };
      return { family, qty: Math.max(1, Math.min(10000, Math.round(l.qty))), design };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .filter((x, i, a) => a.findIndex((y) => y.family.id === x.family.id) === i)
    .slice(0, 8);

  const budget = out.budget > 0 ? out.budget : null;
  const fit = budget ? fitToBudget(picked, budget) : null;
  const needBy = /^\d{4}-\d{2}-\d{2}$/.test(out.needBy) && out.needBy >= today ? out.needBy : null;
  const lines: StylistLine[] = picked.map((p, i) => {
    const qty = fit ? fit.qty[i] : p.qty;
    const delivery = estimate(p.family, p.design).date;
    return {
      productId: p.family.id,
      name: p.family.name,
      image: p.family.image,
      qty,
      method: p.design.method,
      methodLabel: METHOD_INFO[p.design.method].label,
      lineTotal: priceLine(p.family, qty, p.design).lineTotal,
      delivery,
      late: Boolean(needBy && delivery > needBy),
    };
  });
  const total = lines.reduce((s, l) => s + l.lineTotal, 0);

  return {
    reply: out.reply,
    proposal: {
      event: (EVENT_IDS as readonly string[]).includes(out.event) ? (out.event as EventId) : null,
      needBy,
      budget,
      people: out.people > 0 ? out.people : null,
      lines,
      total,
      overBudget: Boolean(budget && total > budget),
    },
  };
}
