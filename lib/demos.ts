import { randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isEventId, type EventId } from "@/lib/eventAgent";
import { hostOk, normalizeHost } from "@/lib/host";

/** Pre-branded demo links the sales team sends to prospects. Demo storage: JSON on disk. */
export type Demo = { token: string; createdAt: string; host: string; brand: string; color?: string; event: EventId; contact?: string; opens: string[] };

const DIR = path.join(process.cwd(), ".data", "demos");
const TOKEN = /^[0-9a-f]{20}$/;
const file = (t: string) => path.join(DIR, `${t}.json`);

export async function createDemo(input: { host?: string; brand?: string; color?: string; event?: string; contact?: string }): Promise<Demo | { error: string }> {
  const host = normalizeHost(input.host ?? "");
  if (!hostOk(host)) return { error: "Ange prospektens webbadress" };
  if (!isEventId(input.event)) return { error: "Välj tillfälle" };
  const demo: Demo = {
    token: randomBytes(10).toString("hex"),
    createdAt: new Date().toISOString(),
    host,
    brand: (input.brand ?? "").trim().slice(0, 60) || host,
    color: typeof input.color === "string" && /^#[0-9a-f]{6}$/i.test(input.color) ? input.color : undefined,
    event: input.event,
    contact: (input.contact ?? "").trim().slice(0, 40) || undefined,
    opens: [],
  };
  await mkdir(DIR, { recursive: true });
  await writeFile(file(demo.token), JSON.stringify(demo, null, 2));
  return demo;
}

export async function getDemo(token: string): Promise<Demo | null> {
  if (!TOKEN.test(token)) return null;
  return readFile(file(token), "utf8")
    .then((s) => JSON.parse(s) as Demo)
    .catch(() => null);
}

export async function recordOpen(demo: Demo) {
  const opens = [...demo.opens, new Date().toISOString()].slice(-200);
  await writeFile(file(demo.token), JSON.stringify({ ...demo, opens }, null, 2));
}

export async function listDemos(): Promise<Demo[]> {
  const names = await readdir(DIR).catch(() => [] as string[]);
  const all = await Promise.all(names.filter((n) => n.endsWith(".json")).map((n) => readFile(path.join(DIR, n), "utf8").then((s) => JSON.parse(s) as Demo).catch(() => null)));
  return all.filter((d): d is Demo => d !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
