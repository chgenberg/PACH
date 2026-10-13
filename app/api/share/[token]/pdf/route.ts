import { quotePdf } from "@/lib/quotePdf";
import { sharedQuote } from "@/lib/share";

export const runtime = "nodejs";
export const maxDuration = 30;

/** The customer's PDF, in the template the seller sent – the same toggles as the web view. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const hit = await sharedQuote((await params).token);
  if (!hit) return new Response("Länken är inte giltig", { status: 404 });
  const { quote, send } = hit;
  const pdf = await quotePdf({ ...quote, phone: "", reference: quote.ref }, { presentation: send?.presentation });
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="Offert-${quote.ref}.pdf"`, "Cache-Control": "no-store" },
  });
}
