import { NextResponse } from "next/server";
import { loadBrand } from "@/lib/brandLogo";
import { readProfile } from "@/lib/profile";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { url?: string };
  try {
    const profile = await readProfile(String(body.url ?? ""));
    // Start the site analysis (logo check, colours, art direction) while the customer picks an event.
    void loadBrand(profile.host).catch(() => undefined);
    return NextResponse.json(profile);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Kunde inte läsa adressen." }, { status: 400 });
  }
}
