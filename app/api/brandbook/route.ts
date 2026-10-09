import { NextResponse } from "next/server";
import { type BrandbookFile, readBrandbook } from "@/lib/brandbook";
import { errorMessage, hasOpenAIKey } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_FILES = 8;
const MAX_BYTES = 40_000_000;
const ACCEPT = /^(application\/pdf|image\/(png|jpeg|webp))$/;

/** Upload a brand book (PDF or page images); the agent reads it and returns the brand like a website profile. */
export async function POST(req: Request) {
  if (!hasOpenAIKey()) return NextResponse.json({ error: "Bildtjänsten är inte aktiverad här." }, { status: 503 });
  const form = await req.formData().catch(() => null);
  const entries = (form?.getAll("files") ?? []).filter((v): v is File => v instanceof File).slice(0, MAX_FILES);
  if (!entries.length) return NextResponse.json({ error: "Välj en brandbook (PDF) eller bilder." }, { status: 400 });
  const total = entries.reduce((s, f) => s + f.size, 0);
  if (total > MAX_BYTES) return NextResponse.json({ error: "Filerna är för stora (max 40 MB)." }, { status: 413 });
  if (entries.some((f) => !ACCEPT.test(f.type) && !/\.(pdf|png|jpe?g|webp)$/i.test(f.name))) {
    return NextResponse.json({ error: "Använd PDF, PNG, JPG eller WebP." }, { status: 400 });
  }

  try {
    const files: BrandbookFile[] = await Promise.all(entries.map(async (f) => ({ name: f.name, type: f.type, data: Buffer.from(await f.arrayBuffer()) })));
    const a = await readBrandbook(files);
    return NextResponse.json({ host: a.host, name: a.brandName, color: a.brandColor, note: a.logoNote, tagline: a.tagline });
  } catch (err) {
    console.error("brandbook", errorMessage(err));
    return NextResponse.json({ error: "Kunde inte läsa brandbooken. Prova en PDF eller bilder av sidorna." }, { status: 500 });
  }
}
