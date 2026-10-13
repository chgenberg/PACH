/** Purchase orders to suppliers – client-safe statuses, labels and the roll-up shown on each order. */

export const PO_STATUSES = ["draft", "sent", "confirmed", "proof", "proofOk", "production", "shipped", "delivered"] as const;
export type PoStatus = (typeof PO_STATUSES)[number];

export const PO_LABEL: Record<PoStatus, string> = {
  draft: "Utkast",
  sent: "Skickad",
  confirmed: "Bekräftad",
  proof: "Korrektur väntar",
  proofOk: "Korrektur godkänd",
  production: "I produktion",
  shipped: "Skickad från leverantör",
  delivered: "Levererad",
};

/** What PACH presses when the supplier answers by e-mail. */
export const PO_NEXT_LABEL: Partial<Record<PoStatus, string>> = {
  sent: "Leverantören har bekräftat",
  confirmed: "Korrektur mottaget",
  proof: "Godkänn korrekturet",
  proofOk: "Markera i produktion",
  production: "Markera skickad",
  shipped: "Markera levererad",
};

export type PoEvent = { at: string; text: string; by: "pach" | "leverantör"; status?: PoStatus };
export type PoCheck = { tone: "warn" | "info" | "ok"; text: string };
export type PoEmail = { to: string; subject: string; body: string; attachments: string[] };
export type PoIssue = { productId: string; name: string; label: string; note: string; replacement?: string; date?: string };

export type PoView = {
  number: string;
  supplierId: string;
  supplier: string;
  short: string;
  mark: string;
  channel: "portal" | "email";
  status: PoStatus;
  history: PoEvent[];
  lines: { productId: string; name: string; qty: number; color: string; method: string; leadDays: number }[];
  units: number;
  value: number;
  checks: PoCheck[];
  shipBy: string;
  arrives: string;
  proof: { kind: "none" | "email" | "portal"; days: number };
  email: PoEmail | null;
  tracking: string | null;
  portalHref: string | null;
  supplierNumber: string | null;
  issues: PoIssue[];
  proposedDate: string | null;
  next: { status: PoStatus; label: string } | null;
};

const rank = (s: PoStatus) => PO_STATUSES.indexOf(s);
export const atLeast = (s: PoStatus, min: PoStatus) => rank(s) >= rank(min);

/** "3 inköpsordrar – 3 skickade, 2 bekräftade, 1 väntar på korrektur". */
export function rollup(pos: { status: PoStatus }[]): string {
  if (!pos.length) return "Inga inköpsordrar";
  const n = pos.length;
  const count = (fn: (s: PoStatus) => boolean) => pos.filter((p) => fn(p.status)).length;
  const parts: string[] = [];
  const drafts = count((s) => s === "draft");
  const sent = n - drafts;
  if (drafts) parts.push(`${drafts} ${drafts === 1 ? "utkast" : "utkast"}`);
  if (sent) parts.push(`${sent} ${sent === 1 ? "skickad" : "skickade"}`);
  const confirmed = count((s) => atLeast(s, "confirmed"));
  if (confirmed) parts.push(`${confirmed} ${confirmed === 1 ? "bekräftad" : "bekräftade"}`);
  const proof = count((s) => s === "proof");
  if (proof) parts.push(`${proof} väntar på korrektur`);
  const prod = count((s) => s === "production");
  if (prod) parts.push(`${prod} i produktion`);
  const shipped = count((s) => s === "shipped");
  if (shipped) parts.push(`${shipped} på väg`);
  const delivered = count((s) => s === "delivered");
  if (delivered) parts.push(`${delivered} ${delivered === 1 ? "levererad" : "levererade"}`);
  return `${n} ${n === 1 ? "inköpsorder" : "inköpsordrar"} – ${parts.join(", ")}`;
}
