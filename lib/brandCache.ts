import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const DIR = path.join(process.cwd(), ".data", "brand");
const ID = /^[0-9a-f]{24}$/;

export const urlOf = (id: string) => `/api/img/${id}`;

export const cacheKey = (...parts: string[]) => createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 24);

export async function cachedUrl(id: string): Promise<string | null> {
  return stat(path.join(DIR, `${id}.jpg`))
    .then(() => urlOf(id))
    .catch(() => null);
}

export async function storeImage(id: string, image: Buffer): Promise<string> {
  const jpg = await sharp(image).flatten({ background: "#ffffff" }).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
  await mkdir(DIR, { recursive: true });
  await writeFile(path.join(DIR, `${id}.jpg`), jpg);
  return urlOf(id);
}

export async function readImage(id: string): Promise<Buffer | null> {
  if (!ID.test(id)) return null;
  return readFile(path.join(DIR, `${id}.jpg`)).catch(() => null);
}

/** Resolve a branded image URL produced by this cache back to its bytes. */
export async function readImageUrl(url: string): Promise<Buffer | null> {
  const id = url.startsWith("/api/img/") ? url.slice("/api/img/".length) : "";
  return id ? readImage(id) : null;
}
