import { readTemplates } from "@/lib/offerSettings";
import { sanitizePresentation } from "@/lib/offerTemplates";
import { quotePdf } from "@/lib/quotePdf";
import { getQuote } from "@/lib/quotes";

export const runtime = "nodejs";
export const maxDuration = 30;

/** ?send=<id> renders a stored send; ?p=<json presentation> renders the preview from the send page. */
export async function GET(req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const quote = await getQuote((await params).ref);
  if (!quote) return new Response("Hittades inte", { status: 404 });
  const url = new URL(req.url);
  const send = quote.sends?.find((s) => s.id === url.searchParams.get("send"));
  let presentation = send?.presentation;
  const raw = url.searchParams.get("p");
  if (!presentation && raw) {
    try {
      presentation = sanitizePresentation(JSON.parse(raw), await readTemplates());
    } catch {
      /* fall back to the default template */
    }
  }
  const pdf = await quotePdf({ ...quote, reference: quote.ref }, { presentation });
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="Offert-${quote.ref}.pdf"`, "Cache-Control": "no-store" },
  });
}
