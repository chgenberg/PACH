import { NextResponse } from "next/server";
import { consumeLogin } from "@/lib/customers";
import { PORTAL_COOKIE } from "@/lib/portalCookie";

export const runtime = "nodejs";

/** The e-mailed login link: remembers the customer on this device and opens their portal. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const portal = await consumeLogin((await params).token);
  if (!portal) return NextResponse.redirect(new URL("/kund?utgangen=1", req.url));
  const res = NextResponse.redirect(new URL(`/kund/${portal}`, req.url));
  res.cookies.set(PORTAL_COOKIE, portal, { httpOnly: true, sameSite: "lax", secure: new URL(req.url).protocol === "https:", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return res;
}
