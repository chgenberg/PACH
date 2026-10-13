import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PoEmail, PoEvent, PoStatus } from "@/lib/purchasingTypes";

/**
 * What PACH has done with each purchase order. Kept apart from the supplier portal so both sides can read it
 * without importing each other. Demo: JSON on disk, reset on deploy.
 */

export type PoRecord = { status: PoStatus; history: PoEvent[]; sentAt?: string; email?: PoEmail; tracking?: string };

const FILE = path.join(process.cwd(), ".data", "purchase-orders.json");

export const poNumber = (ref: string, short: string) => `${ref.replace("PACH", "PO")}-${short}`;

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

/** The three-supplier demo order: the e-mail suppliers are at different steps. */
const SEED: Record<string, () => PoRecord> = {
  "PO-261009-5820-DPG": () => ({
    status: "proof",
    sentAt: daysAgo(3),
    history: [
      { at: daysAgo(3), text: "Inköpsorder skickad till order@demoprofilegoods.se", by: "pach", status: "sent" },
      { at: daysAgo(2.6), text: "Ordern bekräftad per e-post", by: "leverantör", status: "confirmed" },
      { at: daysAgo(1), text: "Korrektur på pennan mottaget – väntar på godkännande", by: "leverantör", status: "proof" },
    ],
  }),
  "PO-261009-5820-DTG": () => ({ status: "draft", history: [] }),
};

export async function readPoStore(): Promise<Record<string, PoRecord>> {
  const stored = await readFile(FILE, "utf8")
    .then((s) => JSON.parse(s) as Record<string, PoRecord>)
    .catch(() => ({}) as Record<string, PoRecord>);
  for (const [k, make] of Object.entries(SEED)) if (!stored[k]) stored[k] = make();
  return stored;
}

export async function writePoStore(store: Record<string, PoRecord>) {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(store, null, 2));
}
