import { NextResponse } from "next/server";
import { readProfile } from "@/lib/profile";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { url?: string };
  try {
    return NextResponse.json(await readProfile(String(body.url ?? "")));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Kunde inte läsa adressen." }, { status: 400 });
  }
}
