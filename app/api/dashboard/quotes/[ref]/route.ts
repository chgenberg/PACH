import { NextResponse } from "next/server";
import { getQuote, listQuotes, QUOTE_STATUSES, type QuoteStatus, saveQuote, view } from "@/lib/quotes";

export const runtime = "nodejs";

type Patch = { status?: QuoteStatus; approved?: boolean; kost?: { productId: string; pct: number }; invoice?: boolean };

async function nextInvoiceNumber() {
  const used = (await listQuotes()).map((q) => Number(q.invoice.invoiceNumber?.slice(2) ?? 0));
  return `F-${Math.max(10420, ...used) + 1}`;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const quote = await getQuote((await params).ref);
  if (!quote) return NextResponse.json({ error: "Offerten hittades inte" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as Patch;
  const next = { ...quote, invoice: { ...quote.invoice, kost: { ...quote.invoice.kost } } };

  if (body.status && (QUOTE_STATUSES as readonly string[]).includes(body.status)) next.status = body.status;
  if (typeof body.approved === "boolean" && !next.invoice.invoiceNumber) next.invoice.approved = body.approved;
  if (body.kost && typeof body.kost.pct === "number" && quote.lines.some((l) => l.productId === body.kost!.productId)) {
    next.invoice.kost[body.kost.productId] = Math.min(100, Math.max(0, Math.round(body.kost.pct)));
  }
  if (body.invoice) {
    if (!next.invoice.approved) return NextResponse.json({ error: "Underlaget måste vara Z-godkänt innan det faktureras." }, { status: 400 });
    if (!next.invoice.invoiceNumber) {
      // Mock av Fortnox: ett ej bokfört fakturautkast med nästa nummer.
      next.invoice.invoiceNumber = await nextInvoiceNumber();
      next.invoice.invoicedAt = new Date().toISOString();
      next.status = "fakturerad";
    }
  }
  return NextResponse.json({ quote: view(await saveQuote(next)) });
}
