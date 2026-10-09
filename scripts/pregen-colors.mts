// Förgenererar katalogfotona i standardfärgerna till public/merch/colors (hoppar över befintliga).
// Kör: npx tsx scripts/pregen-colors.mts
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const { families } = await import("../lib/catalog");
const { BASE_COLOR, SWATCHES } = await import("../lib/colors");
const { stockColorFile } = await import("../lib/stockColors");
const { recolorProduct } = await import("../lib/openai");
const sharp = (await import("sharp")).default;

const jobs = families.flatMap((f) => SWATCHES.filter((s) => s.hex !== BASE_COLOR).map((s) => ({ f, s })));
const todo = jobs.filter(({ f, s }) => !existsSync(path.join("public", stockColorFile(f.id, s.hex))));
console.log(`${todo.length} av ${jobs.length} bilder kvar att skapa`);
await mkdir("public/merch/colors", { recursive: true });

let done = 0;
let i = 0;
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (i < todo.length) {
      const { f, s } = todo[i++];
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const shot = await recolorProduct({ image: await readFile(path.join("public", f.image)), hex: s.hex, colorName: s.name, productName: f.name });
          const jpg = await sharp(shot).resize(800, 800).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
          await writeFile(path.join("public", stockColorFile(f.id, s.hex)), jpg);
          console.log(`${++done}/${todo.length} ${f.name} – ${s.name}`);
          break;
        } catch (err) {
          console.warn(`fel ${f.name} – ${s.name} (försök ${attempt}): ${err instanceof Error ? err.message : err}`);
          await new Promise((r) => setTimeout(r, 4000 * attempt));
        }
      }
    }
  }),
);
console.log("klart");
