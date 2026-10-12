// Engångsskript: livsstilsfoton med PACH-loggan till public/lifestyle.
// Kör: node --env-file=.env.local scripts/generate-lifestyle.mjs [stockholm skog …]
import { mkdir, readFile, writeFile } from "node:fs/promises";
import OpenAI, { toFile } from "openai";
import sharp from "sharp";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-flare";

const STYLE = `Hyperrealistic editorial campaign photo for a Scandinavian brand, shot on a full-frame camera with a 50mm lens, natural light, gentle film-like colour grading, shallow depth of field, soft and slightly dreamy but completely believable – indistinguishable from a real photo shoot.
People are fictional, naturally good-looking Swedish adults in their 20s–40s: real skin texture, freckles and small imperfections allowed, minimal makeup, relaxed genuine expressions, natural posture, anatomically correct hands with five fingers. Not famous, not models posing stiffly.
The logo from the reference image is the brand mark "PACH profile". Wherever the scene says "the logo", print exactly that logo – the same letters PACH with the small word profile underneath, same proportions and typeface, never misspelled or distorted. Print it in white on dark products and in near-black on light products, crisp and naturally following fabric folds, curvature and light. No other logos, brands, readable text or signage anywhere in the image.`;

const SHOTS = {
  stockholm: `A young woman with long light brown hair walking towards the camera down a narrow cobblestone street in Gamla stan, Stockholm, on an autumn afternoon in light drizzle. Ochre and rust-coloured old facades, wet cobblestones reflecting warm shop-window light, soft bokeh. She holds a large black umbrella over her shoulder; the logo is printed in white on one umbrella panel facing the camera. She wears a camel wool coat and smiles softly to herself. Wide landscape composition, she is right of centre, open space on the left.`,
  skog: `Two friends, a woman and a man in their thirties, walking side by side on a mossy trail through a misty Swedish pine forest in early morning, sun rays through the trees. Both wear navy hoodies with the logo printed in white on the chest. The woman holds a black water bottle with the logo in white. Laughing mid-conversation, natural movement. Wide landscape composition, people slightly left of centre.`,
  massa: `A bright, modern trade fair hall in Stockholm. A clean light-wood exhibition booth: a tall curved beach flag with the logo, a white counter with the logo on its front, a rack with folded t-shirts and tote bags. Two friendly staff, a woman and a man, wear black t-shirts with the logo printed in white on the chest; the woman hands a white tote bag with the logo in black to a smiling visitor. Busy, softly blurred visitors in the background. Wide landscape composition.`,
  skargard: `Swedish archipelago in high summer, golden evening light. A woman with sun-kissed skin and a loose blonde ponytail sits on the edge of a weathered wooden jetty, feet above the calm water, red wooden boathouses and pine-covered islands softly out of focus. She wears a black baseball cap with the logo in white on the front and a linen shirt; beside her a natural canvas tote bag with the logo in black. She looks out over the water, relaxed. Wide landscape composition, woman left of centre.`,
  kontor: `A bright Scandinavian office in the morning, large windows, plants and light oak furniture. A man in his thirties with a short beard sits at a desk by the window, smiling at a colleague out of frame. He holds a black ceramic mug with the logo in white; on the desk a black notebook with the logo in white and a pen. Calm, warm daylight. Wide landscape composition.`,
  vinter: `A snowy Södermalm street in Stockholm at blue hour in December, warm windows and soft Christmas lights in the background, gentle snowfall. A young woman with dark curly hair and rosy cheeks walks and laughs, wearing a black knitted beanie with the logo embroidered in white on the cuff, a cream wool scarf and holding a black insulated tumbler with the logo in white, steam rising. Wide landscape composition.`,
  support: `A friendly, naturally good-looking Swedish woman in her early thirties with shoulder-length light brown hair stands outdoors in bright morning light on a Stockholm waterfront, Riddarholmen and Söder softly out of focus behind her. She smiles warmly at the camera and holds up a large unfolded paper map of Sweden with both hands at chest height, the map facing the camera: the clear, recognisable long shape of Sweden in soft sage green on a cream background with a few small coral pins dotted across the country, lakes in pale blue, and no readable text or labels on the map. She wears a black baseball cap with the logo printed in white on the front and a cream knit sweater. Inviting, helpful, "we are here for you" feeling. Wide landscape composition, she is right of centre, calm open sky on the left.`,
  team: `A company kick-off outdoors by a Swedish lake in early autumn, birch trees with yellow leaves. Five colleagues, a natural mix of women and men of different ages, stand close together laughing, arms around each other; all wear matching black hoodies with the logo printed in white on the chest. One holds a black tote bag with the logo in white. Candid moment, golden afternoon light. Wide landscape composition.`,
};

const only = process.argv.slice(2);
const todo = Object.entries(SHOTS).filter(([id]) => !only.length || only.includes(id));

const logo = await sharp(await readFile("public/PACH_logo.png"))
  .flatten({ background: "#ffffff" })
  .resize(1024, 1024, { fit: "contain", background: "#ffffff" })
  .png()
  .toBuffer();

await mkdir("public/lifestyle", { recursive: true });

let next = 0;
const worker = async () => {
  while (next < todo.length) {
    const [id, scene] = todo[next++];
    const t0 = Date.now();
    try {
      const res = await client.images.edit({
        model: MODEL,
        image: await toFile(logo, "logo.png", { type: "image/png" }),
        prompt: `${scene}\n${STYLE}`,
        size: "1536x1024",
        quality: "high",
        output_format: "jpeg",
      });
      const b64 = res.data?.[0]?.b64_json;
      if (!b64) throw new Error("ingen bild");
      const jpg = await sharp(Buffer.from(b64, "base64")).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
      await writeFile(`public/lifestyle/${id}.jpg`, jpg);
      console.log(`${id} klar (${Math.round((Date.now() - t0) / 1000)} s)`);
    } catch (err) {
      console.error(`${id} misslyckades: ${err instanceof Error ? err.message : err}`);
    }
  }
};
await Promise.all(Array.from({ length: 4 }, worker));
