// Skapar 3D-modeller (GLB) av katalogfotona via Meshy och sparar dem i public/models.
// Kör: npx tsx scripts/gen-models.mts [DEMO-P011 DEMO-P021 …]   (utan argument: alla som saknas)
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const KEY = process.env.MESHY_API_KEY;
if (!KEY) throw new Error("MESHY_API_KEY saknas i .env.local");

const { families } = await import("../lib/catalog");
const sharp = (await import("sharp")).default;
const API = "https://api.meshy.ai/openapi/v1/image-to-3d";
const headers = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

/** Soft, complex shapes get Meshy 7.1; simple hard shapes get the cheaper Smart Topology model. */
const COMPLEX = new Set(["klader", "vaskor"]);
const COMPLEX_WORDS = /keps|mössa|buff|filt|handduk|förkläde|paraply|nyckelband|väst/i;

function settings(f: (typeof families)[number]) {
  const complex = COMPLEX.has(f.shop) || COMPLEX_WORDS.test(f.name);
  return complex
    ? { model_type: "standard", ai_model: "meshy-7.1", should_remesh: true, topology: "triangle", target_polycount: 24000, texture_resolution: "2k", label: "meshy-7.1" }
    : { model_type: "smart-topology", ai_model: "meshy-t2", target_polycount: 8000, texture_resolution: "2k", label: "meshy-t2" };
}

const wanted = process.argv.slice(2);
const todo = families.filter((f) => (wanted.length ? wanted.includes(f.id) : !existsSync(`public/models/${f.id}.glb`)));
console.log(`${todo.length} modeller att skapa`);
await mkdir("public/models/raw", { recursive: true });

/** Task ids per product, so an interrupted run resumes instead of paying for a new model. */
const TASKS = "public/models/raw/tasks.json";
const tasks: Record<string, string> = existsSync(TASKS) ? JSON.parse(readFileSync(TASKS, "utf8")) : {};
const remember = (pid: string, id: string) => {
  tasks[pid] = id;
  return writeFile(TASKS, JSON.stringify(tasks, null, 2));
};

async function make(f: (typeof families)[number]) {
  const { label, ...opts } = settings(f);
  let id = tasks[f.id];
  if (id) {
    console.log(`${f.id} ${f.name}: återupptar ${id}`);
  } else {
    const jpg = await sharp(await readFile(path.join("public", f.image))).flatten({ background: "#ffffff" }).resize(1024, 1024, { fit: "contain", background: "#ffffff" }).jpeg({ quality: 90 }).toBuffer();
    const res = await fetch(API, {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...opts,
        image_url: `data:image/jpeg;base64,${jpg.toString("base64")}`,
        should_texture: true,
        enable_pbr: false,
        ...(opts.model_type === "standard" ? { image_enhancement: false } : {}),
        target_formats: ["glb"],
      }),
    });
    const created = await res.json();
    if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(created)}`);
    id = created.result as string;
    await remember(f.id, id);
    console.log(`${f.id} ${f.name}: uppgift ${id} (${label})`);
  }
  const t0 = Date.now();
  for (;;) {
    await new Promise((r) => setTimeout(r, 6000));
    const task = await (await fetch(`${API}/${id}`, { headers })).json();
    if (task.status === "SUCCEEDED") {
      const glb = Buffer.from(await (await fetch(task.model_urls.glb)).arrayBuffer());
      await writeFile(`public/models/raw/${f.id}.glb`, glb);
      await run("npx", ["gltf-transform", "optimize", `public/models/raw/${f.id}.glb`, `public/models/${f.id}.glb`, "--compress", "meshopt", "--texture-compress", "webp", "--texture-size", "1024"]);
      console.log(`${f.id} klar på ${Math.round((Date.now() - t0) / 1000)} s, ${(glb.byteLength / 1e6).toFixed(1)} MB, ${task.consumed_credits ?? "?"} krediter`);
      return;
    }
    if (task.status === "FAILED" || task.status === "CANCELED") {
      delete tasks[f.id];
      await writeFile(TASKS, JSON.stringify(tasks, null, 2));
      throw new Error(`${f.id}: ${task.task_error?.message || task.status}`);
    }
  }
}

let i = 0;
const failed: string[] = [];
await Promise.all(
  Array.from({ length: Math.min(10, todo.length) }, async () => {
    while (i < todo.length) {
      const f = todo[i++];
      await make(f).catch((e) => {
        failed.push(f.id);
        console.warn(`fel ${f.id}: ${e instanceof Error ? e.message : e}`);
      });
    }
  }),
);
console.log(failed.length ? `Misslyckade: ${failed.join(" ")}` : "Alla klara");
