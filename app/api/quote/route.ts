import { NextResponse } from "next/server";
import { quotePdf, type QuoteInput } from "@/lib/quotePdf";
import { createQuote } from "@/lib/quotes";
import { familyById } from "@/lib/catalog";
import { sanitizeDesign } from "@/lib/marking";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  let body: QuoteInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }

  if (!body.company?.trim()) {
    return NextResponse.json({ error: "Fyll i företagsnamn." }, { status: 400 });
  }
  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    return NextResponse.json({ error: "Inga produkter valda." }, { status: 400 });
  }

  try {
    const lines = body.lines.map((l) => {
      const family = familyById(l.productId);
      return { productId: l.productId, qty: l.qty, image: l.image, color: l.color, design: family ? sanitizeDesign(family, l.design) : undefined };
    });
    const saved = await createQuote({ company: body.company.trim(), phone: body.phone ?? "", brand: body.brand, host: body.host, lines });
    const pdf = await quotePdf({ ...saved, reference: saved.ref });
    const filename = `Offert-${saved.ref}.pdf`;
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Quote-Ref": saved.ref,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Kunde inte skapa PDF" }, { status: 500 });
  }
}
