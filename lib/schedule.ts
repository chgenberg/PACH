import { type Family, familyById } from "@/lib/catalog";
import { fmtDay, subWorkdays, workdaysBetween } from "@/lib/delivery";
import { methodsFor } from "@/lib/marking";
import { atLeast, type PoStatus } from "@/lib/purchasingTypes";
import { ORDER_STAGES, type StoredLine, type StoredQuote } from "@/lib/quoteTypes";
import { profileById, type SupplierRules } from "@/lib/supplierProfiles";
import { isNwg, SUPPLIER } from "@/lib/supplierTypes";

/**
 * The order's critical path, counted backwards from the day the customer needs the goods:
 * customer approves → PACH sends the purchase orders → the supplier confirms and proofs → production → freight.
 * Working days skip weekends and Swedish holidays; every supplier has its own lead times.
 */

export const LEVELS = ["ok", "bevaka", "bradskande", "kritisk"] as const;
export type Level = (typeof LEVELS)[number];
export const LEVEL_LABEL: Record<Level, string> = { ok: "I tid", bevaka: "Bevaka", bradskande: "Brådskande", kritisk: "Kritisk" };

export type MilestoneKey = "approve" | "po" | "proof" | "ship" | "deliver";
export type Milestone = { key: MilestoneKey; label: string; due: string; done: boolean; left: number; level: Level | null; who: string[] };
export type Schedule = { ref: string; eventDate: string; level: Level; next: Milestone | null; text: string; milestones: Milestone[] };

/** From approval to purchase orders out of the door. */
const PACH_DAYS = 1;
/** For the supplier to confirm an order. */
const CONFIRM_DAYS = 1;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const back = (isoDate: string, days: number) => iso(subWorkdays(new Date(`${isoDate}T12:00:00Z`), days));

export const supplierOf = (productId: string) => (isNwg(productId) ? SUPPLIER.id : (familyById(productId)?.supplierId ?? ""));

/** Production days at this supplier for one line: the print method's lead time, plus a day for extra positions or names. */
export function leadDaysFor(line: Pick<StoredLine, "design">, f: Family, rules: SupplierRules) {
  const method = line.design?.method ?? methodsFor(f)[0];
  return rules.leadDays[method] + (line.design?.extra?.length ? 1 : 0) + (line.design?.names?.list.length ? 1 : 0);
}

export function levelOf(left: number): Level {
  if (left < 0) return "kritisk";
  if (left <= 1) return "bradskande";
  if (left <= 3) return "bevaka";
  return "ok";
}

const worst = (a: Level, b: Level) => (LEVELS.indexOf(b) > LEVELS.indexOf(a) ? b : a);
const names = (list: string[]) => (list.length <= 1 ? (list[0] ?? "") : `${list.slice(0, -1).join(", ")} och ${list.at(-1)}`);

type QuoteLike = Pick<StoredQuote, "ref" | "status" | "eventDate" | "lines" | "order">;

/** Null when there is nothing to plan: no date, already delivered or invoiced, or an offer whose date has passed. */
export function scheduleFor(q: QuoteLike, pos: { supplierId: string; status: PoStatus }[], today: string): Schedule | null {
  const D = q.eventDate;
  if (!D || q.status === "fakturerad" || q.order?.stage === "levererad") return null;
  const approved = q.status === "godkand";
  if (!approved && D < today) return null;

  type Leg = { id: string; name: string; poBy: string; prodBy: string; shipBy: string; proof: boolean };
  const legs: Leg[] = [];
  for (const id of new Set(q.lines.map((l) => supplierOf(l.productId)))) {
    const profile = profileById(id);
    if (!profile) continue;
    const r = profile.rules;
    const lead = Math.max(0, ...q.lines.filter((l) => supplierOf(l.productId) === id).map((l) => (familyById(l.productId) ? leadDaysFor(l, familyById(l.productId)!, r) : 0)));
    const shipBy = back(D, r.shipDays);
    const prodBy = back(shipBy, lead);
    legs.push({ id, name: profile.name, shipBy, prodBy, poBy: back(prodBy, r.proof.days + CONFIRM_DAYS), proof: r.proof.kind !== "none" });
  }
  if (!legs.length) return null;

  const statusOf = (id: string) => pos.find((p) => p.supplierId === id)?.status ?? "draft";
  const stage = q.order ? ORDER_STAGES.indexOf(q.order.stage) : -1;
  const inPrint = stage >= ORDER_STAGES.indexOf("i-tryck");
  const shipped = stage >= ORDER_STAGES.indexOf("skickad");
  const min = (xs: string[]) => xs.reduce((a, b) => (b < a ? b : a));
  const sortBy = (k: keyof Leg) => (a: Leg, b: Leg) => String(a[k]).localeCompare(String(b[k]));

  const unsent = legs.filter((l) => statusOf(l.id) === "draft").sort(sortBy("poBy"));
  const unready = legs.filter((l) => !atLeast(statusOf(l.id), l.proof ? "proofOk" : "confirmed")).sort(sortBy("prodBy"));
  const notShipped = legs.filter((l) => !atLeast(statusOf(l.id), "shipped")).sort(sortBy("shipBy"));
  const poBy = min(legs.map((l) => l.poBy));

  const raw: Omit<Milestone, "left" | "level">[] = [
    { key: "approve", label: "Kunden godkänner", due: back(poBy, PACH_DAYS), done: approved, who: [] },
    { key: "po", label: "Inköpsordrar skickas", due: poBy, done: approved && (inPrint || !unsent.length), who: unsent.map((l) => l.name) },
    {
      key: "proof",
      label: legs.some((l) => l.proof) ? "Korrektur klart, produktion startar" : "Produktion startar",
      due: min(legs.map((l) => l.prodBy)),
      done: approved && (inPrint || !unready.length),
      who: unready.map((l) => l.name),
    },
    { key: "ship", label: "Leverantörerna skickar", due: min(legs.map((l) => l.shipBy)), done: approved && (shipped || !notShipped.length), who: notShipped.map((l) => l.name) },
    { key: "deliver", label: "Framme hos kunden", due: D, done: false, who: [] },
  ];
  const milestones: Milestone[] = raw.map((m) => {
    const left = workdaysBetween(today, m.due);
    return { ...m, left, level: m.done ? null : levelOf(left) };
  });

  const pending = milestones.filter((m) => !m.done);
  const next = pending[0] ?? null;
  const level = pending.reduce<Level>((acc, m) => worst(acc, m.level!), "ok");
  return { ref: q.ref, eventDate: D, level, next, text: next ? textOf(next, D) : "Allt klart", milestones };
}

function textOf(m: Milestone, D: string): string {
  const day = fmtDay(m.due);
  const when = m.left > 1 ? `senast ${day} (${m.left} arbetsdagar kvar)` : m.left === 1 ? `senast i morgon, ${day}` : m.left === 0 ? "i dag" : "";
  if (m.left < 0) {
    const what: Record<MilestoneKey, string> = {
      approve: "Godkännandet",
      po: `Inköpsordern till ${names(m.who)}`,
      proof: `Korrekturet från ${names(m.who)}`,
      ship: `Utskicket från ${names(m.who)}`,
      deliver: "Leveransen",
    };
    return `${what[m.key]} skulle ha klarats ${day} – ${fmtDay(D)} går inte att hålla utan express eller nytt datum`;
  }
  switch (m.key) {
    case "approve":
      return `Kunden behöver godkänna ${when}`;
    case "po":
      return `Skicka inköpsorder till ${names(m.who)} ${when}`;
    case "proof":
      return `${names(m.who)} – korrektur och produktionsstart ${when}`;
    case "ship":
      return `${names(m.who)} måste skicka ${when}`;
    default:
      return `Framme hos kunden ${day}`;
  }
}
