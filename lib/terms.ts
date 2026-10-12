import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** Quote terms set under Inställningar in the dashboard; used on every quote PDF. */
export type QuoteTerms = { validDays: number; paymentDays: number; vatPct: number };

export const DEFAULT_TERMS: QuoteTerms = { validDays: 30, paymentDays: 30, vatPct: 25 };

const FILE = path.join(process.cwd(), ".data", "terms.json");
const clamp = (n: unknown, lo: number, hi: number, fallback: number) => (typeof n === "number" && Number.isFinite(n) ? Math.round(Math.min(hi, Math.max(lo, n))) : fallback);

export function cleanTerms(raw: unknown): QuoteTerms {
  const t = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    validDays: clamp(t.validDays, 1, 365, DEFAULT_TERMS.validDays),
    paymentDays: clamp(t.paymentDays, 0, 120, DEFAULT_TERMS.paymentDays),
    vatPct: clamp(t.vatPct, 0, 50, DEFAULT_TERMS.vatPct),
  };
}

export async function readTerms(): Promise<QuoteTerms> {
  return readFile(FILE, "utf8")
    .then((s) => cleanTerms(JSON.parse(s)))
    .catch(() => DEFAULT_TERMS);
}

export async function writeTerms(raw: unknown): Promise<QuoteTerms> {
  const terms = cleanTerms(raw);
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(terms));
  return terms;
}
