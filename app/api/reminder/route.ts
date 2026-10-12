import { NextResponse } from "next/server";
import { addReminder, listReminders } from "@/lib/reminders";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ reminders: await listReminders() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const res = await addReminder(body);
  if ("error" in res) return NextResponse.json(res, { status: 400 });
  return NextResponse.json({ reminder: res });
}
