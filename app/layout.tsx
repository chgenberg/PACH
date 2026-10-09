import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { CartProvider } from "@/components/CartProvider";
import { Stylist } from "@/components/Stylist";
import "./globals.css";

const sans = Nunito({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "PACH",
  description: "Profilprodukter med er logotyp. Börja med webbadressen.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sv" className={sans.variable}>
      <body className="antialiased">
        <CartProvider>
          {children}
          <Stylist />
        </CartProvider>
      </body>
    </html>
  );
}
