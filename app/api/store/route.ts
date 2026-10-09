import { NextResponse } from "next/server";
import { createStoreDirect } from "@/lib/campaigns";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Parameters<typeof createStoreDirect>[0];
  const store = await createStoreDirect(body);
  if ("error" in store) return NextResponse.json({ error: store.error }, { status: 400 });
  return NextResponse.json({ store: `/butik/${store.token}`, admin: `/butik/admin/${store.adminKey}` });
}
