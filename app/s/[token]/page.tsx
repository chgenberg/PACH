import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CollectForm } from "@/components/CollectForm";
import { getCollect } from "@/lib/collect";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Välj din storlek – PACH", robots: { index: false, follow: false } };

export default async function CollectPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getCollect(token);
  if (!data) notFound();
  return <CollectForm token={token} data={data} />;
}
