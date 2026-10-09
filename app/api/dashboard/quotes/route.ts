import { NextResponse } from "next/server";
import { listQuotes } from "@/lib/quotes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ quotes: await listQuotes() });
}
