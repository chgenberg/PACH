import { NextResponse } from "next/server";
import { deleteKalkyl, getKalkyl, isKalkylId, listKalkyler, sanitizeKalkyl, saveKalkyl } from "@/lib/kalkyler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const find = async (ctx: Ctx) => {
  const { id } = await ctx.params;
  return isKalkylId(id) ? getKalkyl(id) : null;
};

export async function GET(_req: Request, ctx: Ctx) {
  const k = await find(ctx);
  if (!k) return NextResponse.json({ error: "Kalkylen hittades inte" }, { status: 404 });
  const summary = (await listKalkyler()).find((s) => s.id === k.id);
  return NextResponse.json({ kalkyl: k, usedIn: summary?.usedIn ?? [] });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const base = await find(ctx);
  if (!base) return NextResponse.json({ error: "Kalkylen hittades inte" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  const k = sanitizeKalkyl(body, base);
  if ("error" in k) return NextResponse.json(k, { status: 400 });
  return NextResponse.json({ kalkyl: await saveKalkyl(k) });
}

/** Kalkyler that an offer uses are archived instead of deleted, so the offer keeps its link. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const k = await find(ctx);
  if (!k) return NextResponse.json({ error: "Kalkylen hittades inte" }, { status: 404 });
  const used = (await listKalkyler()).find((s) => s.id === k.id)?.usedIn.length;
  if (used) await saveKalkyl({ ...k, archived: true, updatedAt: new Date().toISOString() });
  else await deleteKalkyl(k.id);
  return NextResponse.json({ ok: true, archived: Boolean(used) });
}
