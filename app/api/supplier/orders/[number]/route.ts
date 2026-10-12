import { NextResponse } from "next/server";
import { applyOrderAction, getOrder, type OrderAction, orderProofs } from "@/lib/supplier";

export const runtime = "nodejs";

const NUMBER = /^NWG-\d{6}-\d{4}$/;

export async function GET(_req: Request, { params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const order = NUMBER.test(number) ? await getOrder(number) : null;
  if (!order) return NextResponse.json({ error: "Ordern hittades inte" }, { status: 404 });
  return NextResponse.json({ order, proofs: await orderProofs(order) });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  if (!NUMBER.test(number)) return NextResponse.json({ error: "Ordern hittades inte" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as OrderAction | null;
  if (!body || typeof body.action !== "string") return NextResponse.json({ error: "Saknar åtgärd" }, { status: 400 });
  const { order, error } = await applyOrderAction(number, body);
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ order });
}
