import { NextResponse } from "next/server";
import { quotePdf, type QuoteInput } from "@/lib/quotePdf";

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
    const pdf = await quotePdf({
      company: body.company,
      phone: body.phone ?? "",
      brand: body.brand,
      host: body.host,
      lines: body.lines.map((l) => ({ productId: l.productId, qty: l.qty, image: l.image, color: l.color })),
    });
    const filename = `Offert-${body.company.trim().replace(/[^\w-]+/g, "_")}.pdf`;
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Kunde inte skapa PDF" }, { status: 500 });
  }
}
