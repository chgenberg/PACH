import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PortalLogin } from "@/components/PortalLogin";
import { isPortalToken, portalView } from "@/lib/customers";
import { PORTAL_COOKIE } from "@/lib/portalCookie";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Logga in – PACH", robots: { index: false, follow: false } };

export default async function PortalLoginPage({ searchParams }: { searchParams: Promise<{ utgangen?: string }> }) {
  const remembered = (await cookies()).get(PORTAL_COOKIE)?.value;
  if (isPortalToken(remembered) && (await portalView(remembered))) redirect(`/kund/${remembered}`);
  return <PortalLogin expired={(await searchParams).utgangen === "1"} />;
}
