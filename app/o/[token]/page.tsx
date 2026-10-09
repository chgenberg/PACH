import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShareView } from "@/components/ShareView";
import { getShared } from "@/lib/share";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Offert för granskning – PACH", robots: { index: false, follow: false } };

export default async function SharedQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const quote = await getShared(token);
  if (!quote) notFound();
  return <ShareView token={token} initial={quote} />;
}
