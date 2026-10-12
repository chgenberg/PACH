// Skapar en 3D-modell av denimskjortan från fyra foton (fram, bak, vänster, höger) med Meshy 7.1 i högsta kvalitet.
// Kör: npx tsx scripts/gen-shirt.mts
import { existsSync, readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const KEY = process.env.MESHY_API_KEY;
if (!KEY) throw new Error("MESHY_API_KEY saknas i .env.local");

const DIR = "public/models/raw/skjorta-denim";
const API = "https://api.meshy.ai/openapi/v1/multi-image-to-3d";
const headers = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const TASK = `${DIR}/task.json`;

// Meshy 7.1 reads the first image as the front; the order of the others does not matter.
const views = ["1-front", "2-back", "3-left", "4-right"];
const images = await Promise.all(views.map(async (v) => `data:image/png;base64,${(await readFile(`${DIR}/${v}.png`)).toString("base64")}`));

let id = existsSync(TASK) ? (JSON.parse(readFileSync(TASK, "utf8")) as { id: string }).id : "";
if (id) {
  console.log(`Återupptar ${id}`);
} else {
  const res = await fetch(API, {
    method: "POST",
    headers,
    body: JSON.stringify({
      image_urls: images,
      ai_model: "meshy-7.1",
      geometry_resolution: "2k",
      should_remesh: false,
      should_texture: true,
      texture_image_urls: images,
      texture_resolution: "8k",
      enable_pbr: true,
      image_enhancement: false,
      remove_lighting: true,
      multi_view_thumbnails: true,
      target_formats: ["glb", "usdz"],
    }),
  });
  const created = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(created)}`);
  id = created.result as string;
  await writeFile(TASK, JSON.stringify({ id, createdAt: new Date().toISOString() }, null, 2));
  console.log(`Uppgift ${id} skapad`);
}

const t0 = Date.now();
let last = -1;
for (;;) {
  await new Promise((r) => setTimeout(r, 10_000));
  const task = await (await fetch(`${API}/${id}`, { headers })).json();
  if (task.progress !== last) {
    last = task.progress;
    console.log(`${task.status} ${task.progress ?? 0} % (${Math.round((Date.now() - t0) / 1000)} s)`);
  }
  if (task.status === "SUCCEEDED") {
    const save = async (url: string | undefined, name: string) => {
      if (!url) return;
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      await writeFile(`${DIR}/${name}`, buf);
      console.log(`  ${name} ${(buf.byteLength / 1e6).toFixed(1)} MB`);
    };
    await save(task.model_urls?.glb, "model.glb");
    await save(task.model_urls?.usdz, "model.usdz");
    for (const [k, url] of Object.entries((task.thumbnail_urls ?? {}) as Record<string, string>)) await save(url, `preview-${k}.png`);
    await writeFile(TASK, JSON.stringify({ id, done: new Date().toISOString(), credits: task.consumed_credits }, null, 2));
    console.log(`Klar på ${Math.round((Date.now() - t0) / 1000)} s, ${task.consumed_credits ?? "?"} krediter`);
    break;
  }
  if (task.status === "FAILED" || task.status === "CANCELED") throw new Error(task.task_error?.message || task.status);
}
