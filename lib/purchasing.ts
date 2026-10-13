import { readFile } from "node:fs/promises";
import path from "node:path";
import { familyById } from "@/lib/catalog";
import { BASE_COLOR, colorName } from "@/lib/colors";
import { type CostTable, DEFAULT_PRICING, economics } from "@/lib/costing";
import { costTable } from "@/lib/costs";
import { addWorkdays, fmtDay } from "@/lib/delivery";
import { METHOD_INFO, methodsFor, placementRows } from "@/lib/marking";
import { readSeller } from "@/lib/offerSettings";
import { type PoRecord, poNumber, readPoStore, writePoStore } from "@/lib/poStore";
import { sek } from "@/lib/pricing";
import { skuRows } from "@/lib/purchaseOrders";
import { type PoCheck, type PoEmail, type PoStatus, type PoView, atLeast, PO_LABEL, PO_NEXT_LABEL, PO_STATUSES } from "@/lib/purchasingTypes";
import { leadDaysFor } from "@/lib/schedule";
import { getQuote, ORDER_STAGES, type OrderStage, saveQuote, seededOrder, type StoredQuote } from "@/lib/quotes";
import { listOrders, type SupplierOrder, type SupplierStage, ISSUE_LABEL, SUPPLIER } from "@/lib/supplier";
import { profileById, type SupplierProfile } from "@/lib/supplierProfiles";

/**
 * One purchase order per supplier on every approved order. NWG gets it in its portal and reports
 * progress there; the others get a (simulated) e-mail and PACH records their answers.
 */

const iso = (d: Date) => d.toISOString().slice(0, 10);
const isOrder = (q: StoredQuote) => q.status === "godkand" || q.status === "fakturerad";

const FROM_NWG: Record<SupplierStage, PoStatus> = { ny: "sent", bekraftad: "confirmed", "i-tryck": "production", packad: "production", skickad: "shipped", levererad: "delivered" };
const FROM_ORDER: Record<OrderStage, PoStatus> = { bekraftad: "confirmed", korrektur: "confirmed", "i-tryck": "production", kontroll: "production", skickad: "shipped", levererad: "delivered" };
const TO_ORDER: Partial<Record<PoStatus, OrderStage>> = { production: "i-tryck", shipped: "skickad", delivered: "levererad" };

type Legacy = { poSent?: Record<string, string>; poConfirmed?: Record<string, string> };

export type PoContext = { table: CostTable; nwg: SupplierOrder[]; store: Record<string, PoRecord>; sellerName: string; legacy: Legacy };

export async function poContext(): Promise<PoContext> {
  const [table, nwg, store, seller, legacy] = await Promise.all([
    costTable(),
    listOrders(),
    readPoStore(),
    readSeller(),
    readFile(path.join(process.cwd(), ".data", "supplier-admin.json"), "utf8")
      .then((s) => JSON.parse(s) as Legacy)
      .catch(() => ({}) as Legacy),
  ]);
  return { table, nwg, store, sellerName: seller.name || "PACH", legacy };
}

/** Before a record exists: demo orders are as far as the order itself, older e-mail orders as far as PACH marked them. */
function derived(q: StoredQuote, supplierId: string, ctx: PoContext): PoRecord {
  const key = `${q.ref}:${supplierId}`;
  if (ctx.legacy.poConfirmed?.[key]) return { status: "confirmed", sentAt: ctx.legacy.poSent?.[key], history: [{ at: ctx.legacy.poConfirmed[key], text: "Ordern bekräftad", by: "leverantör", status: "confirmed" }] };
  if (ctx.legacy.poSent?.[key]) return { status: "sent", sentAt: ctx.legacy.poSent[key], history: [{ at: ctx.legacy.poSent[key], text: "Inköpsorder skickad", by: "pach", status: "sent" }] };
  if (seededOrder(q.ref)) {
    const status = q.order ? FROM_ORDER[q.order.stage] : q.status === "fakturerad" ? "delivered" : "draft";
    const at = q.order?.history[0]?.at ?? q.createdAt;
    return { status, sentAt: status === "draft" ? undefined : at, history: status === "draft" ? [] : [{ at, text: "Inköpsorder skickad", by: "pach", status: "sent" }] };
  }
  return { status: "draft", history: [] };
}

const nextOf = (s: PoStatus, proof: SupplierProfile["rules"]["proof"]): PoStatus | null => {
  if (s === "draft" || s === "delivered") return null;
  if (s === "confirmed") return proof.kind === "none" ? "production" : "proof";
  return PO_STATUSES[PO_STATUSES.indexOf(s) + 1] ?? null;
};

function emailFor(q: StoredQuote, number: string, profile: SupplierProfile, lines: PoView["lines"], shipBy: string, attachments: string[], sellerName: string): PoEmail {
  const first = profile.contact.name.split(" ")[0];
  const rows = lines.map((l) => `– ${l.qty} st ${l.name}, ${l.color} · ${l.method}`).join("\n");
  const proof = profile.rules.proof.kind === "email" ? "\nSkicka korrektur till oss innan tryck – vi svarar samma dag.\n" : "";
  return {
    to: profile.contact.email,
    subject: `Inköpsorder ${number} – ${q.company}`,
    body: `Hej ${first}!\n\nHär kommer inköpsorder ${number} för ${q.company}:\n${rows}\n\nÖnskat utskick senast ${fmtDay(shipBy)} med ${profile.rules.carrier}.${proof}\nArtiklar, märkning och tryckfiler i 300 dpi finns i bilagorna.\n\nVänliga hälsningar\n${sellerName}\nPACH`,
    attachments,
  };
}

/** Every supplier's purchase order on one approved order, checked against that supplier's terms. */
export async function purchaseOrdersFor(q: StoredQuote, given?: PoContext): Promise<PoView[]> {
  if (!isOrder(q)) return [];
  const ctx = given ?? (await poContext());
  const groups = new Map<string, StoredQuote["lines"]>();
  for (const l of q.lines) {
    const supplierId = ctx.table.products[l.productId]?.supplierId;
    if (supplierId) groups.set(supplierId, [...(groups.get(supplierId) ?? []), l]);
  }

  const out: PoView[] = [];
  for (const [supplierId, lines] of groups) {
    const profile = profileById(supplierId);
    if (!profile) continue;
    const number = poNumber(q.ref, profile.short);
    const portal = profile.integration === "portal";
    const nwgOrder = portal ? (ctx.nwg.find((o) => o.ref === q.ref && o.source === "pach") ?? null) : null;
    const record = ctx.store[number] ?? derived(q, supplierId, ctx);
    const status: PoStatus = nwgOrder ? FROM_NWG[nwgOrder.state.stage] : record.status;

    const checks: PoCheck[] = [];
    let value = 0;
    let lead = 0;
    let files = 0;
    const rows: PoView["lines"] = [];
    for (const l of lines) {
      const f = familyById(l.productId);
      if (!f) continue;
      const method = l.design?.method ?? methodsFor(f)[0];
      const leadDays = leadDaysFor(l, f, profile.rules);
      lead = Math.max(lead, leadDays);
      value += l.cost ? (l.cost.unit + l.cost.printUnit) * l.qty + l.cost.setup : economics(f, l.qty, l.design, ctx.table, DEFAULT_PRICING).cost.total;
      files += l.design ? 1 + (l.design.extra?.length ?? 0) + (l.design.names ? 1 : 0) : 0;
      const marking = l.design ? placementRows(f, l.design).map((p) => `${p.method} ${p.colors.toLowerCase()}`).join(" + ") : `${METHOD_INFO[method].label} enligt korrektur`;
      rows.push({ productId: f.id, name: f.name, qty: l.qty, color: colorName((l.color ?? BASE_COLOR).toUpperCase()), method: marking, leadDays });
      const moq = ctx.table.products[f.id]?.moq ?? 1;
      if (l.qty < moq) checks.push({ tone: "warn", text: `${f.name}: minsta antal ${moq} st – beställt ${l.qty} st` });
      for (const r of skuRows(q, l, f)) if (r.note) checks.push({ tone: "warn", text: `${f.name}: ${r.note.charAt(0).toLowerCase()}${r.note.slice(1)}${r.size === "Ej angiven" ? ` (${r.qty} st)` : ""}` });
    }
    value = Math.round(value);
    if (value < profile.terms.minOrder) checks.push({ tone: "warn", text: `Under minsta ordervärde ${sek(profile.terms.minOrder)} (${sek(value)})` });
    const freight = profile.rules.freeFreightFrom !== null && value >= profile.rules.freeFreightFrom ? 0 : profile.rules.freight;
    checks.push(
      freight
        ? { tone: "info", text: profile.rules.freeFreightFrom === null ? `Fast frakt ${sek(freight)} med ${profile.rules.carrier}` : `Frakt ${sek(freight)} tillkommer – fritt över ${sek(profile.rules.freeFreightFrom)}` }
        : { tone: "ok", text: `Fri frakt med ${profile.rules.carrier}` },
    );

    const start = record.sentAt && status !== "draft" ? new Date(record.sentAt) : new Date();
    const shipBy = nwgOrder?.state.proposedDate ?? iso(addWorkdays(start, profile.rules.proof.days + lead));
    const arrives = iso(addWorkdays(new Date(`${shipBy}T12:00:00Z`), profile.rules.shipDays));
    if (!atLeast(status, "delivered")) {
      if (q.eventDate && arrives > q.eventDate) checks.push({ tone: "warn", text: `Hinner inte: framme ca ${fmtDay(arrives)}, kunden behöver varorna ${fmtDay(q.eventDate)}` });
      else checks.push({ tone: q.eventDate ? "ok" : "info", text: `Framme ca ${fmtDay(arrives)}${q.eventDate ? ` – i tid till ${fmtDay(q.eventDate)}` : ""} (${profile.rules.proof.days ? `${profile.rules.proof.days} d korrektur + ` : ""}${lead} d produktion + ${profile.rules.shipDays} d frakt)` });
    }

    const attachments = [`${number}.pdf`, ...(files ? [`tryckfiler-${number}.zip (${files} ${files === 1 ? "fil" : "filer"})`] : []), "artiklar.csv"];
    const history = [...record.history];
    if (nwgOrder) for (const h of nwgOrder.state.history) history.push({ at: h.at, text: h.text, by: "leverantör" });
    history.sort((a, b) => a.at.localeCompare(b.at));
    const next = portal ? null : nextOf(status, profile.rules.proof);

    out.push({
      number,
      supplierId,
      supplier: profile.name,
      short: profile.short,
      mark: profile.mark,
      channel: portal ? "portal" : "email",
      status,
      history,
      lines: rows,
      units: rows.reduce((s, r) => s + r.qty, 0),
      value,
      checks,
      shipBy,
      arrives,
      proof: { kind: profile.rules.proof.kind, days: profile.rules.proof.days },
      email: portal ? null : (record.email ?? emailFor(q, number, profile, rows, shipBy, attachments, ctx.sellerName)),
      tracking: nwgOrder?.state.tracking ?? record.tracking ?? null,
      portalHref: nwgOrder ? `/leverantor/ordrar?open=${nwgOrder.number}` : null,
      supplierNumber: nwgOrder?.number ?? null,
      issues: nwgOrder
        ? Object.entries(nwgOrder.state.issues)
            .filter(([, i]) => !i.resolved)
            .map(([productId, i]) => ({ productId, name: rows.find((r) => r.productId === productId)?.name ?? productId, label: ISSUE_LABEL[i.kind], note: i.note, replacement: i.replacement, date: i.date }))
        : [],
      proposedDate: nwgOrder?.state.proposedDate ?? null,
      next: next ? { status: next, label: PO_NEXT_LABEL[status] ?? PO_LABEL[next] } : null,
    });
  }
  return out;
}

export type PoAction = { action: "send" | "advance" | "sendAll"; number?: string; tracking?: string };

/** Send (simulated e-mail or NWG portal), or record the e-mail supplier's next answer. */
export async function applyPoAction(ref: string, a: PoAction): Promise<{ orders?: PoView[]; error?: string }> {
  const q = await getQuote(ref);
  if (!q || !isOrder(q)) return { error: "Ordern är inte godkänd än" };
  const ctx = await poContext();
  const pos = await purchaseOrdersFor(q, ctx);
  const targets = a.action === "sendAll" ? pos.filter((p) => p.status === "draft") : pos.filter((p) => p.number === a.number);
  if (!targets.length) return { error: a.action === "sendAll" ? "Alla inköpsordrar är redan skickade" : "Inköpsordern finns inte" };
  const at = new Date().toISOString();
  const store = ctx.store;

  for (const po of targets) {
    const record: PoRecord = store[po.number] ?? { status: po.status, history: [...po.history.filter((h) => h.by === "pach")] };
    if (a.action === "send" || a.action === "sendAll") {
      if (po.status !== "draft") return { error: `${po.number} är redan skickad` };
      record.status = "sent";
      record.sentAt = at;
      if (po.channel === "email" && po.email) {
        record.email = po.email;
        record.history.push({ at, text: `Inköpsorder skickad till ${po.email.to} med ${po.email.attachments.length} bilagor`, by: "pach", status: "sent" });
      } else {
        record.history.push({ at, text: `Skickad till ${SUPPLIER.name}s leverantörsportal`, by: "pach", status: "sent" });
      }
    } else {
      if (po.channel === "portal") return { error: `${po.supplier} uppdaterar ordern i sin portal` };
      if (!po.next) return { error: po.status === "draft" ? "Skicka inköpsordern först" : "Inköpsordern är levererad" };
      const profile = profileById(po.supplierId)!;
      const tracking = typeof a.tracking === "string" ? a.tracking.replace(/\s+/g, " ").trim().slice(0, 60) : "";
      const text: Record<PoStatus, string> = {
        draft: "",
        sent: "",
        confirmed: "Ordern bekräftad per e-post",
        proof: "Korrektur mottaget – väntar på godkännande",
        proofOk: "Korrekturet godkänt av PACH",
        production: "I produktion",
        shipped: `Skickad med ${profile.rules.carrier}${tracking ? ` · ${tracking}` : ""}`,
        delivered: "Levererad",
      };
      record.status = po.next.status;
      if (tracking) record.tracking = tracking;
      record.history.push({ at, text: text[po.next.status], by: po.next.status === "proofOk" ? "pach" : "leverantör", status: po.next.status });
    }
    store[po.number] = record;
  }
  await writePoStore(store);
  await syncOrderStage(ref);
  return { orders: await purchaseOrdersFor((await getQuote(ref))!) };
}

/** The customer's order moves on when every purchase order has reached that step – never backwards. */
export async function syncOrderStage(ref: string, note?: string) {
  const q = await getQuote(ref);
  if (!q || !isOrder(q)) return;
  const pos = await purchaseOrdersFor(q);
  if (!pos.length) return;
  const slowest = pos.reduce((min, p) => (PO_STATUSES.indexOf(p.status) < PO_STATUSES.indexOf(min) ? p.status : min), "delivered" as PoStatus);
  const target = TO_ORDER[slowest];
  if (!target) return;
  const current = q.order ? ORDER_STAGES.indexOf(q.order.stage) : -1;
  if (ORDER_STAGES.indexOf(target) <= current) return;
  const tracking = [...new Set(pos.map((p) => p.tracking).filter(Boolean))].join(" · ") || q.order?.tracking;
  const text = note ?? (pos.length > 1 ? `Alla ${pos.length} leverantörer: ${PO_LABEL[slowest].toLowerCase()}` : PO_LABEL[slowest]);
  await saveQuote({ ...q, order: { stage: target, history: [...(q.order?.history ?? []), { stage: target, at: new Date().toISOString(), note: text }], ...(tracking ? { tracking } : {}) } });
}
