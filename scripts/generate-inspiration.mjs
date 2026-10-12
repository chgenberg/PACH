// Engångsskript: Inspiration-scenerna med kända varumärken, bara som demo av hur det kan se ut.
// Loggorna hämtas först via /api/brand-logo till /tmp/pach-logos/<host>.png.
// Kör: node --env-file=.env.local scripts/generate-inspiration.mjs [massa kickoff …]
import { mkdir, readFile, writeFile } from "node:fs/promises";
import OpenAI, { toFile } from "openai";
import sharp from "sharp";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-flare";

const BRANDS = {
  massa: { host: "volvocars.com", name: "Volvo", note: "the VOLVO wordmark in dark navy or white depending on the surface" },
  kickoff: { host: "spotify.com", name: "Spotify", note: "the Spotify icon in Spotify green (#1DB954) or white, and where there is room the word Spotify next to it", },
  konferens: { host: "klarna.com", name: "Klarna", note: "the Klarna wordmark in Klarna pink (#FFB3C7) on dark surfaces and black on light surfaces" },
  sommar: { host: "coca-cola.com", name: "Coca-Cola", note: "the Coca-Cola script logo in white on Coca-Cola red (#F40009) surfaces, or red on white", crop: 0.58 },
  event: { host: "oatly.com", name: "Oatly", note: "the OATLY logo in its own light blue and black" },
  julklapp: { host: "ikea.com", name: "IKEA", note: "the IKEA logo: blue wordmark in a yellow oval on a blue field" },
};

const only = process.argv.slice(2);
const todo = Object.entries(BRANDS).filter(([id]) => !only.length || only.includes(id));
await mkdir("public/inspiration", { recursive: true });

async function logoRef(b) {
  let img = sharp(await readFile(`/tmp/pach-logos/${b.host}.png`)).flatten({ background: "#ffffff" });
  if (b.crop) {
    const { width, height } = await img.metadata();
    img = sharp(await img.extract({ left: 0, top: 0, width: Math.round(width * b.crop), height }).png().toBuffer());
  }
  return img.resize(1024, 1024, { fit: "contain", background: "#ffffff" }).png().toBuffer();
}

await Promise.all(
  todo.map(async ([id, b]) => {
    const t0 = Date.now();
    try {
      const scene = await sharp(await readFile(`public/scenes/${id}.jpg`)).png().toBuffer();
      const prompt = `Edit the first image, a photo of a branded event setting. Keep the photo itself exactly the same: same composition, camera angle, people, faces, poses, products, furniture, light and background.
Replace every "DIN LOGO" placement – on banners, flags, walls, counters, tablecloths, clothing, bags, cups, boxes and every other product – with the ${b.name} logo from the second image: ${b.note}. Keep each placement's size and position, and let the logo follow the surface, folds, curvature and light so it looks really printed or embroidered.
Where it suits the brand, tint backdrops, flags and the people's clothing in ${b.name}'s brand colours, while keeping the scene realistic and premium.
The logo must keep its exact shapes, letters and proportions – never misspelled or distorted. No "DIN LOGO" text may remain. No other brands or readable text anywhere. Photorealistic, indistinguishable from a real event photo.`;
      const res = await client.images.edit({
        model: MODEL,
        image: [await toFile(scene, "scene.png", { type: "image/png" }), await toFile(await logoRef(b), "logo.png", { type: "image/png" })],
        prompt,
        size: "1536x1024",
        quality: "high",
        output_format: "jpeg",
      });
      const b64 = res.data?.[0]?.b64_json;
      if (!b64) throw new Error("ingen bild");
      await writeFile(`public/inspiration/${id}.jpg`, await sharp(Buffer.from(b64, "base64")).jpeg({ quality: 86, mozjpeg: true }).toBuffer());
      console.log(`${id} (${b.name}) klar (${Math.round((Date.now() - t0) / 1000)} s)`);
    } catch (err) {
      console.error(`${id} misslyckades: ${err instanceof Error ? err.message : err}`);
    }
  }),
);
