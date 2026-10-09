import { readFile } from "node:fs/promises";
import { toFile } from "openai";
import sharp from "sharp";
import { logoPrefersDark } from "@/lib/brandLogo";
import { errorMessage, IMAGE_MODEL, IMAGE_QUALITY, openai, TEXT_MODEL } from "@/lib/openai";
import type { SiteAnalysis } from "@/lib/siteAnalysis";

/**
 * Brandad händelsescen i tre steg (som New Wave): skräddarsydd bildregi från platsanalysen,
 * rendering med logga + kundens egna produktbilder som referens, och en visionsgranskare som
 * låter bilden göras om (högst tre försök) tills händer, ansikten, loggstavning och layout håller.
 */

type Scene = { subject: string; colours: string; people: string; expected: string[]; items: string; tagline: boolean };

const SCENES: Record<string, Scene> = {
  massa: {
    subject: "a professionally built trade show booth",
    colours: "the back wall, roll-up, beach flag, counter front and the staff's shirts",
    people: "Exactly two staff stand behind the counter, relaxed and facing the camera, each with both hands resting on the counter top.",
    expected: ["a beach flag on a pole", "a roll-up banner", "a brochure stand", "a back wall with the logo and a wall screen", "a centred reception counter with two staff behind it", "open shelving with products and merch on the right"],
    items: "on the counter and the shelves",
    tagline: true,
  },
  konferens: {
    subject: "a branded corporate conference stage and registration area",
    colours: "the stage backdrop, roll-up, floor sign, lectern front, registration desk front and the staff's clothing",
    people: "Exactly two people, both behind the registration desk; nobody on the stage.",
    expected: ["a stage backdrop with the logo and a big screen", "a lectern", "a registration desk with two staff", "a roll-up banner"],
    items: "on the registration desk",
    tagline: false,
  },
  kickoff: {
    subject: "a branded company kick-off in a bright Scandinavian loft",
    colours: "the banner wall, the tablecloths, the beach flag and the team's hoodies",
    people: "Exactly six adults in the centre group with natural adult proportions, everyone on the same floor plane.",
    expected: ["a beach flag", "a banner wall with the logo", "six colleagues in matching branded hoodies", "two round tables with tablecloths", "an easel sign"],
    items: "on the two round tables",
    tagline: false,
  },
  event: {
    subject: "a branded evening brand event with a photo wall and a bar",
    colours: "the bar front, the cocktail table cover, the beach flag, the floor sign and accents on the photo wall; the warm evening light stays",
    people: "Exactly five people: two bartenders behind the bar and three guests at the cocktail table; glasses held naturally.",
    expected: ["a photo wall with the logo", "a bar with two bartenders", "a cocktail table with three guests", "a beach flag"],
    items: "on the back bar",
    tagline: false,
  },
  sommar: {
    subject: "a branded company summer party on a lawn by a Swedish lake",
    colours: "the backdrop, beach flag, picnic blanket, cooler bag, tote bags and the team's t-shirts and caps",
    people: "Exactly five smiling adults in front of the backdrop, natural proportions, everyone on the same ground plane.",
    expected: ["a beach flag", "a picnic blanket with a cooler bag", "a backdrop with the logo", "five people in matching t-shirts and caps", "a bench with towels and tote bags"],
    items: "on the picnic blanket and the bench",
    tagline: false,
  },
  julklapp: {
    subject: "a branded corporate Christmas gift table in a cosy Scandinavian office",
    colours: "the beach flag, tablecloth, wall panel, gift boxes and gift bags",
    people: "Exactly two people behind the table, each with both hands resting on it.",
    expected: ["a beach flag", "a shelf with gift boxes and mugs", "a table with gifts and two people behind it", "a wall panel with the logo"],
    items: "on the table and the shelf",
    tagline: false,
  },
  hero: {
    subject: "a premium promotional products studio table",
    colours: "accents on the products and the wall",
    people: "No people.",
    expected: ["a table with neatly arranged branded products", "a wall with the logo"],
    items: "on the table",
    tagline: false,
  },
};

const hexRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};
const saturated = (hex: string) => {
  const [r, g, b] = hexRgb(hex);
  const max = Math.max(r, g, b);
  return max > 50 && (max - Math.min(r, g, b)) / max > 0.25;
};

/** The logo's own colour, when it has one. */
async function logoColour(logo: Buffer): Promise<string | null> {
  const { data } = await sharp(logo).ensureAlpha().resize(64, 64, { fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const max = Math.max(data[i], data[i + 1], data[i + 2]);
    if (max < 50 || (max - Math.min(data[i], data[i + 1], data[i + 2])) / max < 0.3) continue;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }
  if (n < 20) return null;
  return `#${[r, g, b].map((v) => Math.round(v / n).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/** Site's brand colour first, then the logo's; monochrome brands get a deep navy so the scene still looks designed. */
async function sceneColour(a: SiteAnalysis | null, logo: Buffer) {
  if (a?.brandColor && saturated(a.brandColor)) return a.brandColor;
  return (await logoColour(logo).catch(() => null)) ?? "#14233C";
}

const promptName = (s: string) => s.replace(/["\n]/g, "").slice(0, 40);

function prompt(sc: Scene, a: SiteAnalysis | null, company: string, colour: string, refs: string[]) {
  const what = a ? [a.industryEn && `a ${a.industryEn} company`, a.offeringEn].filter(Boolean).join(" – ") : "";
  const s = a?.scene;
  const line = (label: string, v?: string) => (v ? `- ${label}: ${v}` : "");
  const content = [
    sc.tagline && a?.tagline
      ? `- Back wall: the logo centred at the top, and below it the tagline "${a.tagline.replace(/"/g, "")}" in clean, well-spaced type (this is the only other text allowed).`
      : "- Every logo placement shows only the logo, no other text.",
    line("Screen or backdrop motif", s?.screen),
    sc.tagline ? line("Roll-up", s?.rollup && `${s.rollup}, logo at the top`) : "",
    line(`Products ${sc.items}`, s?.counter),
    line("Merch and shelves", s?.shelves),
    line("Clothing of the people (keep the counts and poses)", s?.staff),
    line("Materials", s?.materials),
    line("Lighting", s?.lighting),
  ].filter(Boolean);
  return `Photorealistic photo of ${sc.subject} for "${promptName(company)}"${what ? `, ${what}` : ""}, shot on a full-frame camera, eye level, straight on, landscape. It must look like it was produced specifically for this company by a top agency.
The first reference image shows the exact layout, camera angle, framing, lighting, people and object positions: keep all of them the same, only restyle and brand the scene for this company.
The second reference image is the company's logo. Replace every "DIN LOGO" placeholder with this exact logo – identical shapes, letters and proportions, no invented or distorted characters. On dark surfaces print the logo in white, on light surfaces in its own colours.
${refs.length ? `The remaining reference images are the company's real products from its website: ${refs.map((d, i) => `(${i + 3}) ${d}`).join("; ")}. Reproduce these exact items – same shapes, packaging and colours, without readable small print – ${sc.items}.\n` : ""}Brand colour: ${colour}. ${a?.tone ? `Visual tone: ${a.tone}. ` : ""}Use the brand colour as the dominant colour of ${sc.colours}, combined with white and natural materials. Premium, clean Scandinavian design.
${a?.palette?.length ? `Secondary brand colours for accents: ${a.palette.join(", ")}.\n` : ""}${a?.rules?.length ? `Brand guidelines to respect:\n${a.rules.map((r) => `- ${r}`).join("\n")}\n` : ""}Company-specific content:
${content.join("\n")}
Realism requirements (most important):
- It must look like an unedited photo by a professional event photographer: physically plausible light, shadows and reflections, correct perspective, nothing floating in the air.
- ${sc.people} Every person has one head, two arms, two hands and five fingers per hand, all connected to their own body; no extra, missing, merged or disembodied limbs. Natural relaxed faces with real skin texture; people are fictional and generic.
- Every logo is spelled exactly as in the logo reference, letter for letter. No garbled, invented or nonsense text anywhere; small print on products may be illegible but must not look like fake letters.`;
}

type Review = { ok: boolean; issues: string[] };

const reviewSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ok", "issues"],
  properties: { ok: { type: "boolean" }, issues: { type: "array", items: { type: "string" } } },
} as const;

const jpgUrl = (b: Buffer) => `data:image/jpeg;base64,${b.toString("base64")}`;

/** Vision QA: null when the reviewer itself fails, so the caller keeps the image. */
async function review(jpg: Buffer, logo: Buffer, sc: Scene, company: string, tagline: string | null): Promise<Review | null> {
  try {
    const { width = 1536, height = 1024 } = await sharp(jpg).metadata();
    const full = await sharp(jpg).resize(1536, 1024, { fit: "inside" }).jpeg({ quality: 82 }).toBuffer();
    const crop = await sharp(jpg)
      .extract({ left: Math.round(width * 0.26), top: Math.round(height * 0.16), width: Math.round(width * 0.48), height: Math.round(height * 0.66) })
      .resize(1024, 1024, { fit: "inside" })
      .jpeg({ quality: 85 })
      .toBuffer();
    const ref = await sharp(logo).flatten({ background: "#FFFFFF" }).resize(512, 512, { fit: "inside" }).jpeg({ quality: 85 }).toBuffer();
    const res = await openai().responses.create(
      {
        model: TEXT_MODEL,
        input: [
          {
            role: "system",
            content: `You are a strict photo editor doing quality control on AI-generated photos of ${sc.subject} before a customer sees them. The photo must be indistinguishable from a real photograph.
You get: (1) the full photo, (2) a close-up of the centre with the people, (3) the company's logo as reference.
- People: ${sc.people} Each has exactly two arms, two hands and five fingers per hand, all connected to their own body. Flag any extra or missing person, extra/missing/merged/floating/disembodied limb, and any distorted, melted or duplicated face.
- Objects: nothing floating or merging into other objects; plausible shadows.
- Text: every logo must match the reference logo's spelling exactly. Flag misspelled, garbled or invented letters and nonsense text. Small illegible print on products is fine.
- Layout: the expected elements are listed in the user message. Flag an expected element that is missing. Elements not listed are intentionally absent.
Ignore blurred background people unless grotesque. Do not flag style choices, colours or minor imperfections a real photo could have.
ok = true only if there are no real issues. issues: short, concrete English fix instructions an image model can act on, max 5.`,
          },
          {
            role: "user",
            content: [
              { type: "input_text", text: `Photo for "${promptName(company)}".${tagline ? ` The back wall also carries the line "${tagline}".` : ""}\nExpected elements: ${sc.expected.join(", ")}.\n(1) Full photo:` },
              { type: "input_image", image_url: jpgUrl(full), detail: "high" },
              { type: "input_text", text: "(2) Close-up of the centre:" },
              { type: "input_image", image_url: jpgUrl(crop), detail: "high" },
              { type: "input_text", text: "(3) Reference logo:" },
              { type: "input_image", image_url: jpgUrl(ref), detail: "low" },
            ],
          },
        ],
        text: { format: { type: "json_schema", name: "scene_review", schema: reviewSchema as unknown as Record<string, unknown>, strict: true } },
      },
      { timeout: 60_000, maxRetries: 1 },
    );
    const r = JSON.parse(res.output_text) as Review;
    const issues = (Array.isArray(r.issues) ? r.issues : []).map((i) => String(i).slice(0, 220)).filter(Boolean).slice(0, 5);
    return { ok: Boolean(r.ok), issues: r.ok ? [] : issues };
  } catch (err) {
    console.error("scene review", errorMessage(err));
    return null;
  }
}

const MAX_SHOTS = 3;

export async function renderScene(opts: { event: string; scene: Buffer; logo: Buffer; company: string; analysis: SiteAnalysis | null }): Promise<Buffer> {
  const sc = SCENES[opts.event] ?? SCENES.massa;
  const a = opts.analysis;
  const colour = await sceneColour(a, opts.logo);
  // White logos (common in site headers) are shown on a dark ground, or neither model can read them.
  const ground = (await logoPrefersDark(opts.logo)) ? "#1A1A1A" : "#FFFFFF";
  const logoRef = await sharp(opts.logo)
    .resize(860, 860, { fit: "inside", kernel: "lanczos3" })
    .extend({ top: 82, bottom: 82, left: 82, right: 82, background: ground })
    .flatten({ background: ground })
    .resize(1024, 1024, { fit: "contain", background: ground })
    .png()
    .toBuffer();
  const refs: { buf: Buffer; description: string }[] = [];
  for (const p of a?.products ?? []) {
    const buf = await readFile(p.file).catch(() => null);
    if (buf) refs.push({ buf, description: p.description });
  }
  const base = prompt(sc, a, a?.brandName || opts.company, colour, refs.map((r) => r.description));
  const tagline = sc.tagline && a?.tagline ? a.tagline : null;

  const shoot = async (fixes: string[]) => {
    const res = await openai().images.edit({
      model: IMAGE_MODEL,
      image: [
        await toFile(opts.scene, "scene.jpg", { type: "image/jpeg" }),
        await toFile(logoRef, "logo.png", { type: "image/png" }),
        ...(await Promise.all(refs.map((r, i) => toFile(r.buf, `product-${i + 1}.jpg`, { type: "image/jpeg" })))),
      ],
      prompt: fixes.length ? `${base}\nA previous attempt had these problems – make sure they do not happen this time:\n${fixes.map((f) => `- ${f}`).join("\n")}` : base,
      size: "1536x1024",
      quality: IMAGE_QUALITY,
      output_format: "jpeg",
    });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error("Bildmodellen returnerade ingen bild");
    return Buffer.from(b64, "base64");
  };

  /** Keep the first clean render, else the one with the fewest issues; a failing reviewer never blocks the scene. */
  let best: { jpg: Buffer; review: Review | null } | null = null;
  let fixes: string[] = [];
  for (let attempt = 1; attempt <= MAX_SHOTS; attempt++) {
    let jpg: Buffer;
    try {
      jpg = await shoot(fixes);
    } catch (err) {
      if (!best) throw err;
      break;
    }
    const r = await review(jpg, logoRef, sc, a?.brandName || opts.company, tagline);
    console.info(`scene ${opts.event} attempt ${attempt}: ${r ? (r.ok ? "ok" : r.issues.join(" | ")) : "review failed"}`);
    if (!best || (r && (!best.review || r.issues.length < best.review.issues.length))) best = { jpg, review: r };
    if (!r || r.ok) break;
    fixes = r.issues;
  }
  return best!.jpg;
}
