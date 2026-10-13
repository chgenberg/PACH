import { NextResponse } from "next/server";
import { readTemplates } from "@/lib/offerSettings";
import { sanitizePresentation } from "@/lib/offerTemplates";
import { getQuote } from "@/lib/quotes";
import { publicView } from "@/lib/share";

export const runtime = "nodejs";

/** The customer's web view with an unsent template – for the preview on the send page. */
export async function POST(req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const quote = await getQuote((await params).ref);
  if (!quote) return NextResponse.json({ error: "Offerten hittades inte" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { presentation?: unknown };
  const presentation = sanitizePresentation(body.presentation, await readTemplates());
  return NextResponse.json({ quote: await publicView(quote, presentation) }, { headers: { "Cache-Control": "no-store" } });
}
