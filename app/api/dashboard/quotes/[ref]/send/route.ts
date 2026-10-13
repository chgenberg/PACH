import { NextResponse } from "next/server";
import { sendOffer, type SendInput } from "@/lib/share";

export const runtime = "nodejs";

/** MOCK e-mail: stores the send and returns its link. A real mailer plugs in here. */
export async function POST(req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const body = (await req.json().catch(() => ({}))) as SendInput;
  const res = await sendOffer((await params).ref, body);
  if (res.error) return NextResponse.json({ error: res.error }, { status: res.error === "Offerten hittades inte" ? 404 : 400 });
  return NextResponse.json({ send: res.send, path: `/o/${res.send!.token}`, mocked: true });
}
