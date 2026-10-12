import type { Metadata } from "next";
import { ModelOnly } from "@/components/ModelOnly";

export const metadata: Metadata = { title: "Denimskjorta i 3D – PACH", robots: { index: false } };

export default function ShirtModelPage() {
  return <ModelOnly url="/models/skjorta-denim-hq.glb" />;
}
