import { NextResponse } from "next/server";
import { readTerms, writeTerms } from "@/lib/terms";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ terms: await readTerms() }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  return NextResponse.json({ terms: await writeTerms(body) });
}
