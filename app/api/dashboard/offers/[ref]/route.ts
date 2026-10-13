import { NextResponse } from "next/server";
import { type OfferInput, updateOffer } from "@/lib/offers";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const body = (await req.json().catch(() => null)) as OfferInput | null;
  if (!body) return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  const res = await updateOffer((await params).ref, body);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.error.includes("hittades") ? 404 : 400 });
  return NextResponse.json(res);
}
