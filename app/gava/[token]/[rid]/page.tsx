import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GiftPicker } from "@/components/GiftPicker";
import { getCampaign, publicCampaign } from "@/lib/campaigns";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "En gåva till dig – PACH", robots: { index: false, follow: false } };

export default async function GiftPage({ params }: { params: Promise<{ token: string; rid: string }> }) {
  const { token, rid } = await params;
  const c = await getCampaign(token);
  const r = c?.recipients.find((x) => x.id === rid);
  if (!c || c.kind !== "gift" || !r) notFound();
  return <GiftPicker gift={publicCampaign(c)} rid={rid} firstName={r.name.split(" ")[0]} chosen={Boolean(r.choice)} />;
}
