import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomerPortal } from "@/components/CustomerPortal";
import { portalView } from "@/lib/customers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Era offerter och ordrar – PACH", robots: { index: false, follow: false } };

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const portal = await portalView(token);
  if (!portal) notFound();
  return <CustomerPortal token={token} initial={portal} />;
}
