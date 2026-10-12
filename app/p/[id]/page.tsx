import { notFound } from "next/navigation";
import { ProductPage } from "@/components/ProductPage";
import { families, familyById } from "@/lib/catalog";

export function generateStaticParams() {
  return families.map((f) => ({ id: f.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const family = familyById((await params).id);
  return { title: family ? `${family.name} – PACH` : "PACH" };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const family = familyById((await params).id);
  if (!family) notFound();
  return <ProductPage productId={family.id} />;
}