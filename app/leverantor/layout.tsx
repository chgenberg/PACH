import type { Metadata } from "next";
import { SupplierNav } from "@/components/supplier/SupplierNav";

export const metadata: Metadata = { title: "Leverantörsportal – New Wave Group (demo)", robots: { index: false } };

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dash sp">
      <SupplierNav />
      <main className="dash-main">
        <p className="dash-banner">
          Demoläge – du är inloggad som New Wave Group. Ordrarna kommer från PACH:s godkända offerter plus exempelordrar och nollställs vid uppdatering av sajten.
        </p>
        {children}
      </main>
    </div>
  );
}
