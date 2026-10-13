import { NextResponse } from "next/server";
import { applyTemplateAction, readSeller, readTemplates, type TemplateAction, writeSeller } from "@/lib/offerSettings";

export const runtime = "nodejs";

export async function GET() {
  const [seller, templates] = await Promise.all([readSeller(), readTemplates()]);
  return NextResponse.json({ seller, templates }, { headers: { "Cache-Control": "no-store" } });
}

/** { seller } saves the profile; { template: TemplateAction } saves, copies, deletes or resets a template. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { seller?: unknown; template?: TemplateAction };
  if (body.seller) return NextResponse.json({ seller: await writeSeller(body.seller) });
  if (body.template && ["save", "copy", "delete", "reset"].includes(body.template.action)) {
    const res = await applyTemplateAction(body.template);
    if (res.error) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json(res);
  }
  return NextResponse.json({ error: "Okänd åtgärd" }, { status: 400 });
}
