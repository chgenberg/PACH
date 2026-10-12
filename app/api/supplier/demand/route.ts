import { NextResponse } from "next/server";
import { demand } from "@/lib/supplier";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ demand: await demand() });
}
