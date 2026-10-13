import { NextResponse } from "next/server";
import { isCustomerKey } from "@/lib/customerTypes";
import { getCustomer, requestLogin, updateContacts } from "@/lib/customers";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const key = (await params).key;
  const customer = isCustomerKey(key) ? await getCustomer(key) : null;
  if (!customer) return NextResponse.json({ error: "Kunden hittades inte" }, { status: 404 });
  return NextResponse.json({ customer }, { headers: { "Cache-Control": "no-store" } });
}

/** { add } / { remove } edits the contacts; { login: email } makes a login link (shown, since e-mail is simulated). */
export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const key = (await params).key;
  if (!isCustomerKey(key) || !(await getCustomer(key))) return NextResponse.json({ error: "Kunden hittades inte" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { add?: unknown; remove?: unknown; login?: unknown };
  if (body.login !== undefined) {
    const res = await requestLogin(body.login, key);
    if (res.error) return NextResponse.json({ error: res.error }, { status: 400 });
    if (!res.path) return NextResponse.json({ error: "Adressen finns inte bland kundens kontakter" }, { status: 400 });
    return NextResponse.json({ path: res.path, mocked: true });
  }
  const res = await updateContacts(key, body);
  if (res.error) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ customer: await getCustomer(key) });
}
