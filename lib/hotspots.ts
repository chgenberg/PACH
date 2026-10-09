import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { Family } from "@/lib/catalog";
import { errorMessage, openai, TEXT_MODEL } from "@/lib/openai";

export type Hotspot = { productId: string; x: number; y: number };

const DIR = path.join(process.cwd(), ".data", "hotspots");
const VERSION = "h1";
const GRID = 10;

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["spots"],
  properties: {
    spots: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["productId", "x", "y", "confidence"],
        properties: {
          productId: { type: "string" },
          x: { type: "number" },
          y: { type: "number" },
          confidence: { type: "number" },
        },
      },
    },
  },
} as const;

/** A faint labelled grid helps the vision model report coordinates instead of guessing them. */
async function withGrid(image: Buffer): Promise<Buffer> {
  const W = 1536;
  const H = 1024;
  const lines: string[] = [];
  for (let i = 1; i < GRID; i++) {
    const x = (W / GRID) * i;
    const y = (H / GRID) * i;
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#ff00ff" stroke-opacity="0.45" stroke-width="2"/>`);
    lines.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#ff00ff" stroke-opacity="0.45" stroke-width="2"/>`);
  }
  for (let i = 0; i < GRID; i++) {
    lines.push(`<text x="${(W / GRID) * i + 6}" y="22" font-size="20" font-family="Arial" font-weight="700" fill="#ff00ff">${i * 10}</text>`);
    lines.push(`<text x="6" y="${(H / GRID) * i + 22}" font-size="20" font-family="Arial" font-weight="700" fill="#ff00ff">${i * 10}</text>`);
  }
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${lines.join("")}</svg>`);
  return sharp(image).resize(W, H, { fit: "fill" }).composite([{ input: svg }]).jpeg({ quality: 84 }).toBuffer();
}

const clamp = (n: number) => Math.min(0.97, Math.max(0.03, n));

/** Vision agent: which of the given products are visible in the scene, and where. Coordinates are 0–1. */
export async function findHotspots(key: string, image: Buffer, candidates: Family[]): Promise<Hotspot[]> {
  const id = createHash("sha1").update(`${VERSION}|${key}`).digest("hex").slice(0, 24);
  const file = path.join(DIR, `${id}.json`);
  const hit = await readFile(file, "utf8").catch(() => null);
  if (hit) return JSON.parse(hit) as Hotspot[];

  const ids = new Set(candidates.map((f) => f.id));
  const list = candidates.map((f) => `${f.id}: ${f.name} (${f.subcategory || f.short})`).join("\n");
  const grid = await withGrid(image);
  const spots: Hotspot[] = [];
  try {
    const res = await openai().responses.create(
      {
        model: TEXT_MODEL,
        input: [
          {
            role: "system",
            content: `You locate promotional products in a photo so a web shop can put clickable dots on them.
The photo has a magenta grid; the numbers along the top edge are x in percent and along the left edge y in percent.
Only report a product when an item of that type is clearly visible (e.g. a T-shirt worn by a person or lying on a table, a cap, a water bottle, a tote bag, a roll-up banner). Never guess. Each productId at most once; pick the clearest instance.
x and y are the centre of the item as a fraction of width and height (0–1). Two spots must be at least 0.08 apart. confidence 0–1. At most 6 spots.`,
          },
          {
            role: "user",
            content: [
              { type: "input_text", text: `Products in the shop (productId: name):\n${list}` },
              { type: "input_image", image_url: `data:image/jpeg;base64,${grid.toString("base64")}`, detail: "high" },
            ],
          },
        ],
        text: { format: { type: "json_schema", name: "hotspots", schema: schema as unknown as Record<string, unknown>, strict: true } },
      },
      { timeout: 60_000, maxRetries: 1 },
    );
    const raw = (JSON.parse(res.output_text) as { spots: (Hotspot & { confidence: number })[] }).spots ?? [];
    const seen = new Set<string>();
    for (const s of raw.sort((a, b) => b.confidence - a.confidence)) {
      if (!ids.has(s.productId) || seen.has(s.productId) || s.confidence < 0.6) continue;
      const x = clamp(s.x > 1 ? s.x / 100 : s.x);
      const y = clamp(s.y > 1 ? s.y / 100 : s.y);
      if (spots.some((o) => Math.hypot(o.x - x, o.y - y) < 0.08)) continue;
      seen.add(s.productId);
      spots.push({ productId: s.productId, x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 });
      if (spots.length >= 6) break;
    }
  } catch (err) {
    console.error("hotspots", errorMessage(err));
    return [];
  }
  await mkdir(DIR, { recursive: true });
  await writeFile(file, JSON.stringify(spots));
  return spots;
}
