import { NextResponse } from "next/server";
import { hostOk, normalizeHost } from "@/lib/host";
import { errorMessage, hasOpenAIKey } from "@/lib/openai";
import { stylist, type StylistMessage } from "@/lib/stylist";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(req: Request) {
  if (!hasOpenAIKey()) return NextResponse.json({ error: "Stylisten är inte tillgänglig just nu" }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as { messages?: StylistMessage[]; host?: string };
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.text === "string" && m.text.trim())
    .slice(-12);
  if (!messages.length || messages[messages.length - 1].role !== "user") return NextResponse.json({ error: "Skriv vad ni behöver" }, { status: 400 });
  const host = body.host && hostOk(normalizeHost(body.host)) ? normalizeHost(body.host) : undefined;
  try {
    return NextResponse.json(await stylist(messages, host));
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
