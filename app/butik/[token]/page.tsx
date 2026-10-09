import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CompanyStore } from "@/components/CompanyStore";
import { getCampaign, publicCampaign } from "@/lib/campaigns";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Företagsbutik – PACH", robots: { index: false, follow: false } };

export default async function StorePage({ params }: { params: Promise<{ token: string }> }) {
  const c = await getCampaign((await params).token);
  if (!c || c.kind !== "store") notFound();
  return <CompanyStore store={publicCampaign(c)} />;
}
