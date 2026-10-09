import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * MOCK – skickar inget ännu.
 *
 * När ett Resend-konto är uppkopplat kopplas offert-PDF:en och mottagaren in här
 * (t.ex. resend.emails.send({ attachments: [{ filename, content }] })). Tills dess
 * bekräftar vi bara att "offerten är skickad" så att flödet går att testa fullt ut.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const company = typeof body?.company === "string" ? body.company : "";
  // Avsiktligt ingen utskick här – endast mock-bekräftelse.
  return NextResponse.json({ ok: true, mocked: true, company });
}
