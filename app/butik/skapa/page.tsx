import type { Metadata } from "next";
import { StoreBuilder } from "@/components/StoreBuilder";

export const metadata: Metadata = {
  title: "Personalbutik – PACH",
  description: "Låt personalen välja sina profilkläder själva. Ni bestämmer sortiment och budget.",
};

export default function CreateStorePage() {
  return <StoreBuilder />;
}
