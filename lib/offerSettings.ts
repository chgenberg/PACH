import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { BUILTIN_TEMPLATES, DEFAULT_SELLER, type OfferTemplate, sanitizeSeller, sanitizeTemplate, type SellerProfile } from "@/lib/offerTemplates";

/** Seller profile and offer templates, set under Inställningar. Demo: JSON on disk, reset on deploy. */

const DIR = path.join(process.cwd(), ".data");
const TEMPLATES = path.join(DIR, "offer-templates.json");
const SELLER = path.join(DIR, "seller.json");

async function write(file: string, data: unknown) {
  await mkdir(DIR, { recursive: true });
  await writeFile(file, JSON.stringify(data));
}

export async function readSeller(): Promise<SellerProfile> {
  return readFile(SELLER, "utf8")
    .then((s) => sanitizeSeller(JSON.parse(s)))
    .catch(() => DEFAULT_SELLER);
}

export async function writeSeller(raw: unknown): Promise<SellerProfile> {
  const seller = sanitizeSeller(raw);
  await write(SELLER, seller);
  return seller;
}

/** Built-ins first (as edited by the seller), then the seller's own copies. */
export async function readTemplates(): Promise<OfferTemplate[]> {
  const stored: OfferTemplate[] = await readFile(TEMPLATES, "utf8")
    .then((s) => JSON.parse(s) as OfferTemplate[])
    .catch(() => []);
  const byId = new Map(stored.filter((t) => t && typeof t.id === "string").map((t) => [t.id, t]));
  const builtins = BUILTIN_TEMPLATES.map((b) => (byId.has(b.id) ? sanitizeTemplate(byId.get(b.id), b) : b));
  const own = stored.filter((t) => t && !BUILTIN_TEMPLATES.some((b) => b.id === t.id)).map((t) => sanitizeTemplate(t, { ...BUILTIN_TEMPLATES[1], id: t.id, builtin: undefined }));
  return [...builtins, ...own];
}

export type TemplateAction = { action: "save"; template: Partial<OfferTemplate> & { id: string } } | { action: "copy" | "delete" | "reset"; id: string };

export async function applyTemplateAction(a: TemplateAction): Promise<{ templates?: OfferTemplate[]; id?: string; error?: string }> {
  const list = await readTemplates();
  const id = a.action === "save" ? a.template?.id : a.id;
  const current = list.find((t) => t.id === id);
  if (!current) return { error: "Mallen finns inte" };
  let next = list;
  let focus = current.id;

  if (a.action === "save") {
    next = list.map((t) => (t.id === current.id ? sanitizeTemplate(a.template, current) : t));
  } else if (a.action === "copy") {
    if (list.length >= 20) return { error: "Max 20 mallar" };
    focus = `t-egen-${randomBytes(4).toString("hex")}`;
    const copy: OfferTemplate = { ...current, id: focus, name: `${current.name} (kopia)`.slice(0, 40) };
    delete copy.builtin;
    next = [...list, copy];
  } else if (a.action === "delete") {
    if (current.builtin) return { error: "Grundmallarna kan inte tas bort, bara återställas" };
    next = list.filter((t) => t.id !== current.id);
    focus = "";
  } else {
    const original = BUILTIN_TEMPLATES.find((b) => b.id === current.id);
    if (!original) return { error: "Bara grundmallarna kan återställas" };
    next = list.map((t) => (t.id === current.id ? original : t));
  }
  await write(TEMPLATES, next);
  return { templates: next, id: focus };
}
