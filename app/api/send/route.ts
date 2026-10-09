import { NextResponse } from "next/server";
import { getQuote, isRef, saveQuote } from "@/lib/quotes";

export const runtime = "nodejs";

/**
 * MOCK – skickar inget ännu.
 *
 * När ett Resend-konto är uppkopplat kopplas offert-PDF:en och mottagaren in här
 * (t.ex. resend.emails.send({ attachments: [{ filename, content }] })). Tills dess
 * markeras offerten bara som skickad så att flödet och dashboarden går att testa fullt ut.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const ref = isRef(body?.ref) ? body.ref : null;
  const quote = ref ? await getQuote(ref) : null;
  if (quote && quote.status === "skapad") await saveQuote({ ...quote, status: "skickad" });
  return NextResponse.json({ ok: true, mocked: true, ref });
}
