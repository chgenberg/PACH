import type { Metadata } from "next";
import { DashboardNav } from "@/components/dashboard/DashboardNav";

export const metadata: Metadata = { title: "Dashboard – PACH (demo)", robots: { index: false } };

const FONT_CSS =
  "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;700&family=Lato:wght@400;700&family=Montserrat:wght@400;700;800&family=Oswald:wght@400;700&family=Playfair+Display:wght@400;700&family=Roboto+Condensed:wght@400;700&display=swap";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dash">
      <link rel="stylesheet" href={FONT_CSS} />
      <DashboardNav />
      <main className="dash-main">
        <p className="dash-banner">Demoläge – ingen inloggning krävs. Offerterna är exempel och nollställs vid uppdatering av sajten.</p>
        {children}
      </main>
    </div>
  );
}
