import { NextResponse } from "next/server";
import { buildPurchaseOrders, purchaseOrderZip } from "@/lib/purchaseOrders";
import { getQuote, saveQuote } from "@/lib/quotes";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Purchase orders per supplier with print files. ?format=json gives the summary for the dashboard. */
export async function GET(req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const quote = await getQuote((await params).ref);
  if (!quote) return NextResponse.json({ error: "Offerten hittades inte" }, { status: 404 });
  if (quote.status !== "godkand" && quote.status !== "fakturerad") {
    return NextResponse.json({ error: "Offerten måste vara godkänd innan inköpsordrar skapas." }, { status: 400 });
  }

  if (new URL(req.url).searchParams.get("format") === "json") {
    const { orders, files } = await buildPurchaseOrders(quote);
    return NextResponse.json({ orders, files: Object.keys(files).sort() });
  }

  const { zip } = await purchaseOrderZip(quote);
  if (!quote.order) {
    await saveQuote({ ...quote, order: { stage: "bekraftad", history: [{ stage: "bekraftad", at: new Date().toISOString(), note: "Inköpsordrar skickade till leverantör" }] } });
  }
  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="Inkopsordrar-${quote.ref}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
