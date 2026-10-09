import { quotePdf } from "@/lib/quotePdf";
import { getQuote } from "@/lib/quotes";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(_req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const quote = await getQuote((await params).ref);
  if (!quote) return new Response("Hittades inte", { status: 404 });
  const pdf = await quotePdf({ ...quote, reference: quote.ref });
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="Offert-${quote.ref}.pdf"`, "Cache-Control": "no-store" },
  });
}
