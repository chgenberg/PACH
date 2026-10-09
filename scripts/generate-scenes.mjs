// Engångsskript: genererar neutrala "DIN LOGO"-scener till public/scenes.
// Kör: node --env-file=.env.local scripts/generate-scenes.mjs [sommar julklapp hero]
import { writeFile } from "node:fs/promises";
import OpenAI from "openai";
import sharp from "sharp";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-flare";

const STYLE = `Hyperrealistic, unedited photo by a professional event photographer, shot on a full-frame camera, eye level, straight-on wide landscape composition. Physically plausible light, shadows and reflections. Premium, clean Scandinavian design in neutral light grey, white and natural wood.
Every logo placement shows exactly the text "DIN LOGO" in a clean, bold, dark sans-serif typeface, spelled exactly like that and nothing else. No other text, brands or logos anywhere.
People are fictional and generic, with natural adult proportions, relaxed faces, real skin texture, anatomically correct hands with five fingers, everyone standing on the same floor plane.`;

const SCENES = {
  sommar: `A branded company summer party outdoors on a sunny Swedish lawn by a lake in the late afternoon, warm golden light.
Fixed composition, left to right:
- FAR LEFT: a tall curved beach flag on a pole with "DIN LOGO".
- LEFT: a round picnic blanket on the grass with "DIN LOGO", a cooler bag with "DIN LOGO", glass water bottles and a bowl of fruit on it.
- CENTRE: a large light grey fabric backdrop on a frame with "DIN LOGO" large at the top. In front of it, five smiling adults, a natural mix of women and men, in matching light grey t-shirts and caps with a small "DIN LOGO" on the chest and cap front, relaxed and facing the camera.
- RIGHT: a wooden bench with folded beach towels with "DIN LOGO", tote bags with "DIN LOGO" and a sun umbrella.
The lake and trees softly out of focus in the background.`,
  julklapp: `A branded corporate Christmas gift table in a bright, cosy Scandinavian office lounge in December, warm lamp light, a softly lit Christmas tree and window with snow in the background.
Fixed composition, left to right:
- FAR LEFT: a tall curved beach flag on a pole with "DIN LOGO".
- LEFT: a light wood shelf with stacked gift boxes with "DIN LOGO", folded cream fleece blankets with "DIN LOGO" and a row of light grey ceramic mugs with "DIN LOGO".
- CENTRE: a long table covered with a light grey tablecloth with "DIN LOGO" on its front. On the table: open gift boxes with chocolates, insulated tumblers with "DIN LOGO", notebooks with "DIN LOGO" and wrapped presents with ribbons. Behind the table two smiling colleagues, a woman and a man, in light grey knit sweaters, each with both hands resting on the table.
- RIGHT: a light grey wall panel with "DIN LOGO" large at the top, and below it a small stack of gift bags with "DIN LOGO".`,
  hero: `An editorial overview photo of a premium promotional products studio: a long light oak table seen from a low three-quarter angle in a bright, minimal Scandinavian studio with soft daylight from large windows.
On the table, neatly arranged with generous space between them: a folded light grey t-shirt, a navy hoodie, a black baseball cap, a white tote bag, a black backpack, a white insulated tumbler, a light grey ceramic mug, a black notebook, a black pen, a compact black power bank and a closed black umbrella. Every product carries a crisp printed "DIN LOGO" mark.
Behind the table, a light grey wall with "DIN LOGO" large and centred. No people. Calm, airy, plenty of negative space in the upper left for a headline.`,
};

const only = process.argv.slice(2);
const todo = Object.entries(SCENES).filter(([id]) => !only.length || only.includes(id));

await Promise.all(
  todo.map(async ([id, scene]) => {
    const t0 = Date.now();
    const res = await client.images.generate({
      model: MODEL,
      prompt: `${scene}\n${STYLE}`,
      size: "1536x1024",
      quality: "high",
      output_format: "jpeg",
    });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error(`${id}: ingen bild`);
    const jpg = await sharp(Buffer.from(b64, "base64")).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
    await writeFile(`public/scenes/${id}.jpg`, jpg);
    console.log(`${id} klar (${Math.round((Date.now() - t0) / 1000)} s)`);
  }),
);
