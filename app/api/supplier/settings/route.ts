import { NextResponse } from "next/server";
import { readSettings, saveSettings } from "@/lib/supplier";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ settings: await readSettings() });
}

export async function PUT(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Parameters<typeof saveSettings>[0];
  return NextResponse.json({ settings: await saveSettings(body ?? {}) });
}
