import { NextResponse } from "next/server";
import { requestLogin } from "@/lib/customers";

export const runtime = "nodejs";

/** MOCK e-mail: the demo returns the login link instead of sending it. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: unknown };
  const res = await requestLogin(body.email);
  if (res.error) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ path: res.path, mocked: true });
}
