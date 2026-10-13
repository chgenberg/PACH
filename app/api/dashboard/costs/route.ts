import { NextResponse } from "next/server";
import { costTable } from "@/lib/costs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await costTable());
}
