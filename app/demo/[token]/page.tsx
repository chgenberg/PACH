import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DemoStart } from "@/components/DemoStart";
import { getDemo, recordOpen } from "@/lib/demos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Er merch – PACH", robots: { index: false, follow: false } };

export default async function DemoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const demo = await getDemo(token);
  if (!demo) notFound();
  await recordOpen(demo);
  return <DemoStart host={demo.host} brand={demo.brand} color={demo.color} event={demo.event} contact={demo.contact} />;
}
