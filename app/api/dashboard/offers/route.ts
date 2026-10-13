import { NextResponse } from "next/server";
import { createOffer, type OfferInput } from "@/lib/offers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as OfferInput | null;
  if (!body) return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  const res = await createOffer(body);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json(res);
}
