import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { familyById, families } from "@/lib/catalog";
import { fmtDay } from "@/lib/delivery";
import { sek } from "@/lib/pricing";
import { listQuotes } from "@/lib/quotes";
import { applyPoAction, poContext, purchaseOrdersFor } from "@/lib/purchasing";
import { PO_LABEL, type PoView } from "@/lib/purchasingTypes";
import { acceptPrices, applyOrderAction, catalog, listOrders, priceList } from "@/lib/supplier";
import { type SupplierAction, type SupplierOrderRow, SUPPLIER_PROFILES, type SupplierView } from "@/lib/supplierProfiles";
import { ISSUE_LABEL, isNwg, SUPPLIER, SUPPLIER_STAGE_LABEL, SUPPLIER_STAGES } from "@/lib/supplierTypes";

/** What PACH has done towards its suppliers in the demo; stored next to the quotes and reset on deploy. */
type AdminState = {
  poSent: Record<string, string>;
  poConfirmed: Record<string, string>;
  contract: Record<string, string>;
  priceRequested: Record<string, string>;
  paid: Record<string, string>;
  acceptedDates: Record<string, string>;
  reminded: Record<string, string>;
  contentReviewed?: string;
};

const FILE = path.join(process.cwd(), ".data", "supplier-admin.json");
const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const empty = (): AdminState => ({ poSent: {}, poConfirmed: {}, contract: {}, priceRequested: {}, paid: {}, acceptedDates: {}, reminded: {} });

const readState = () =>
  readFile(FILE, "utf8")
    .then((s) => ({ ...empty(), ...(JSON.parse(s) as Partial<AdminState>) }))
    .catch(empty);

async function writeState(s: AdminState) {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(s, null, 2));
}

const supplierOf = (productId: string) => (isNwg(productId) ? SUPPLIER.id : (familyById(productId)?.supplierId ?? ""));
const ago = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / DAY);

export async function supplierViews(): Promise<SupplierView[]> {
  const [state, quotes, nwgOrders, prices, items, ctx] = await Promise.all([readState(), listQuotes(), listOrders(), priceList(), catalog(), poContext()]);
  const pos = new Map<string, PoView[]>();
  for (const q of quotes) if (q.status === "godkand" || q.status === "fakturerad") pos.set(q.ref, await purchaseOrdersFor(q, ctx));
  const now = Date.now();
  const today = iso(new Date());

  return SUPPLIER_PROFILES.map((profile) => {
    const contractUntil = state.contract[profile.id] ?? iso(new Date(now + profile.terms.contractDays * DAY));
    const priceListDate = profile.id === SUPPLIER.id && prices.sentAt ? prices.sentAt.slice(0, 10) : iso(new Date(now - profile.terms.priceListAge * DAY));
    const products = families.filter((f) => supplierOf(f.id) === profile.id).map((f) => ({ id: f.id, name: f.name, image: f.image }));
    const actions: SupplierAction[] = [];
    let orders: SupplierOrderRow[] = [];

    if (profile.integration === "portal") {
      orders = nwgOrders.map((o) => ({
        key: o.number,
        ref: o.ref,
        customer: o.customer,
        date: o.createdAt,
        units: o.units,
        value: o.value,
        status: SUPPLIER_STAGE_LABEL[o.state.stage],
        href: `/leverantor/ordrar?open=${o.number}`,
      }));
      for (const q of quotes) {
        const po = (pos.get(q.ref) ?? []).find((p) => p.supplierId === profile.id && p.status === "draft");
        if (!po) continue;
        actions.push({
          id: `po-${po.number}`,
          tone: "urgent",
          title: `Skicka inköpsorder till NWG – ${q.company}`,
          detail: `${po.lines.map((l) => `${l.name} ${l.qty} st`).join(", ")}. NWG får ordern direkt i sin portal.`,
          cta: { label: "Skicka till portalen", kind: "po-send", payload: { ref: q.ref, number: po.number } },
          secondary: { label: "Öppna ordern", href: `/dashboard/offerter?open=${q.ref}` },
        });
      }
      for (const o of nwgOrders) {
        const portal = `/leverantor/ordrar?open=${o.number}`;
        const open = SUPPLIER_STAGES.indexOf(o.state.stage) < SUPPLIER_STAGES.indexOf("skickad");
        for (const [productId, issue] of Object.entries(o.state.issues)) {
          if (issue.resolved) continue;
          const name = o.lines.find((l) => l.productId === productId)?.name ?? productId;
          actions.push({
            id: `issue-${o.number}-${productId}`,
            tone: "urgent",
            title: `Svara på flagga: ${name} till ${o.customer}`,
            detail: `${ISSUE_LABEL[issue.kind]} – ${issue.note}${issue.replacement ? ` Ersättare: ${issue.replacement}.` : ""}`,
            cta: { label: "Markera löst", kind: "nwg-resolve", payload: { number: o.number, productId } },
            secondary: { label: "Öppna ordern", href: portal },
          });
        }
        if (open && o.state.proposedDate && state.acceptedDates[o.number] !== o.state.proposedDate) {
          actions.push({
            id: `date-${o.number}`,
            tone: "urgent",
            title: `Nytt utskicksdatum för ${o.customer}`,
            detail: `NWG klarar att skicka ${fmtDay(o.state.proposedDate)}${o.needBy ? ` – kunden behöver varorna ${fmtDay(o.needBy)}` : ""}. Godkänn eller hör av dig till kunden.`,
            cta: { label: "Godkänn datumet", kind: "nwg-accept-date", payload: { number: o.number, date: o.state.proposedDate } },
            secondary: { label: "Öppna ordern", href: portal },
          });
        }
        if (o.short && o.state.stage === "ny" && !Object.keys(o.state.issues).length) {
          actions.push({
            id: `short-${o.number}`,
            tone: "normal",
            title: `Lagerbrist hos NWG för ${o.customer}`,
            detail: "Lagret räcker inte för alla rader. Förbered kunden på en ersättare eller delleverans.",
            secondary: { label: "Se raderna", href: portal },
          });
        }
        if (o.state.invoice && !state.paid[o.state.invoice.number]) {
          const due = o.state.invoice.due;
          actions.push({
            id: `pay-${o.state.invoice.number}`,
            tone: due <= iso(new Date(now + 7 * DAY)) ? "urgent" : "normal",
            title: `Betala faktura ${o.state.invoice.number}`,
            detail: `${sek(o.state.invoice.amount)} för ${o.customer} · förfaller ${fmtDay(due)}${due < today ? " – förfallen" : ""}.`,
            cta: { label: "Markera betald", kind: "pay", payload: { invoice: o.state.invoice.number } },
          });
        }
      }
      const waiting = nwgOrders
        .filter((o) => o.state.stage === "ny" && ago(o.createdAt) >= 1 && !(state.reminded[o.number] && ago(state.reminded[o.number]) < 1))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      if (waiting.length) {
        const oldest = ago(waiting[0].createdAt);
        actions.push({
          id: "nwg-unconfirmed",
          tone: oldest >= 3 ? "urgent" : "normal",
          title: `${waiting.length} ${waiting.length === 1 ? "order" : "ordrar"} obekräftade i mer än ett dygn`,
          detail: `${waiting.slice(0, 4).map((o) => `${o.customer} (${ago(o.createdAt)} d)`).join(", ")}${waiting.length > 4 ? ` och ${waiting.length - 4} till` : ""}.`,
          cta: { label: "Påminn NWG", kind: "remind", payload: { number: waiting.map((o) => o.number).join(",") } },
          secondary: { label: "Se ordrarna", href: "/leverantor/produktion" },
        });
      }
      if (prices.pending) {
        actions.push({
          id: "nwg-prices",
          tone: "urgent",
          title: "Ny prislista från NWG väntar på godkännande",
          detail: `Skickad ${prices.sentAt ? fmtDay(prices.sentAt.slice(0, 10)) : ""}. Godkänn så används de nya priserna i inköpen.`,
          cta: { label: "Godkänn prislistan", kind: "nwg-accept-prices" },
          secondary: { label: "Se priserna", href: "/leverantor/priser" },
        });
      }
      const uploads = items.flatMap((i) => i.content.uploads.map((u) => ({ ...u, name: i.name }))).filter((u) => !state.contentReviewed || u.at > state.contentReviewed);
      if (uploads.length) {
        actions.push({
          id: "nwg-content",
          tone: "normal",
          title: `${uploads.length} ${uploads.length === 1 ? "ny bild" : "nya bilder"} från NWG att granska`,
          detail: `Miljöbilder för ${[...new Set(uploads.map((u) => u.name))].slice(0, 3).join(", ")}.`,
          cta: { label: "Godkänn bilderna", kind: "nwg-review-content" },
          secondary: { label: "Visa", href: "/leverantor/innehall" },
        });
      }
    } else {
      for (const q of quotes) {
        const po = (pos.get(q.ref) ?? []).find((p) => p.supplierId === profile.id);
        if (!po) continue;
        const sentAt = po.history.find((h) => h.status === "sent")?.at;
        const approvedAt = Object.values(q.share?.approvals ?? {}).map((a) => a.at).sort().at(-1) ?? q.createdAt;
        orders.push({ key: po.number, ref: q.ref, customer: q.company, date: approvedAt, units: po.units, value: po.value, status: PO_LABEL[po.status], href: `/dashboard/offerter?open=${q.ref}` });
        const what = po.lines.map((l) => `${l.name} ${l.qty} st`).join(", ");
        const warns = po.checks.filter((c) => c.tone === "warn").map((c) => c.text);
        const extra = warns.length ? ` Obs: ${warns.join("; ")}.` : "";
        if (po.status === "draft") {
          actions.push({
            id: `po-${po.number}`,
            tone: "urgent",
            title: `Skicka inköpsorder – ${q.company}`,
            detail: `${what}. Godkänd ${fmtDay(approvedAt.slice(0, 10))}. Går som e-post med PDF och tryckfiler till ${profile.contact.email}.${extra}`,
            cta: { label: "Skicka inköpsorder", kind: "po-send", payload: { ref: q.ref, number: po.number } },
            secondary: { label: "Förhandsgranska", href: `/dashboard/offerter?open=${q.ref}` },
          });
        } else if (po.status === "sent" && po.next) {
          actions.push({
            id: `confirm-${po.number}`,
            tone: sentAt && ago(sentAt) >= 1 ? "urgent" : "normal",
            title: `Väntar på orderbekräftelse – ${q.company}`,
            detail: `Skickad ${sentAt ? fmtDay(sentAt.slice(0, 10)) : ""}. ${profile.note ?? ""}`.trim(),
            cta: { label: po.next.label, kind: "po-advance", payload: { ref: q.ref, number: po.number } },
          });
        } else if (po.status === "proof" && po.next) {
          actions.push({
            id: `proof-${po.number}`,
            tone: "urgent",
            title: `Korrektur väntar på godkännande – ${q.company}`,
            detail: `${profile.name} har skickat korrektur för ${what}. Produktionen startar när det är godkänt.`,
            cta: { label: po.next.label, kind: "po-advance", payload: { ref: q.ref, number: po.number } },
            secondary: { label: "Öppna ordern", href: `/dashboard/offerter?open=${q.ref}` },
          });
        }
      }
      orders.sort((a, b) => b.date.localeCompare(a.date));
    }

    const contractLeft = Math.ceil((new Date(`${contractUntil}T12:00:00Z`).getTime() - now) / DAY);
    if (contractLeft <= 60) {
      actions.push({
        id: `contract-${profile.id}`,
        tone: "urgent",
        title: `Avtalet löper ut ${fmtDay(contractUntil)}`,
        detail: `Om ${contractLeft} dagar. Förnya så att priser och villkor gäller även efter det.`,
        cta: { label: "Förnya 12 månader", kind: "renew" },
      });
    }
    const requested = state.priceRequested[profile.id];
    if (ago(priceListDate) > 180 && !(requested && ago(requested) < 30)) {
      actions.push({
        id: `pricelist-${profile.id}`,
        tone: "normal",
        title: `Prislistan är ${Math.round(ago(priceListDate) / 30)} månader gammal`,
        detail: `Senast uppdaterad ${fmtDay(priceListDate)}. Begär en ny så att offerterna räknas med rätt inköpspris.`,
        cta: { label: "Begär ny prislista", kind: "request-prices" },
      });
    }
    if (requested && ago(requested) < 30) {
      actions.push({ id: `pricelist-wait-${profile.id}`, tone: "info", title: "Ny prislista begärd", detail: `Begärd ${fmtDay(requested.slice(0, 10))} – väntar på svar.` });
    }

    const rank = { urgent: 0, normal: 1, info: 2 } as const;
    return {
      profile,
      contractUntil,
      priceListDate,
      products,
      openOrders: profile.integration === "portal" ? nwgOrders.filter((o) => SUPPLIER_STAGES.indexOf(o.state.stage) < SUPPLIER_STAGES.indexOf("skickad")).length : orders.filter((o) => o.status !== "Levererad").length,
      spend90: orders.filter((o) => now - new Date(o.date).getTime() < 90 * DAY).reduce((s, o) => s + o.value, 0),
      orders: orders.slice(0, 12),
      actions: actions.sort((a, b) => rank[a.tone] - rank[b.tone]),
    };
  });
}

export async function applySupplierAction(supplierId: string, kind: string, payload: Record<string, string> = {}): Promise<string> {
  const profile = SUPPLIER_PROFILES.find((p) => p.id === supplierId);
  if (!profile) return "Okänd leverantör.";
  const state = await readState();
  const at = new Date().toISOString();
  switch (kind) {
    case "nwg-resolve": {
      const res = await applyOrderAction(payload.number, { action: "resolve", productId: payload.productId });
      return res.error ?? "";
    }
    case "nwg-accept-date":
      if (!payload.number || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date ?? "")) return "Saknar datum.";
      state.acceptedDates[payload.number] = payload.date;
      break;
    case "remind":
      if (!payload.number) return "Saknar order.";
      for (const n of payload.number.split(",")) state.reminded[n] = at;
      break;
    case "nwg-accept-prices":
      await acceptPrices();
      return "";
    case "nwg-review-content":
      state.contentReviewed = at;
      break;
    case "pay":
      if (!payload.invoice) return "Saknar faktura.";
      state.paid[payload.invoice] = at;
      break;
    case "renew": {
      const cur = state.contract[supplierId] ?? iso(new Date(Date.now() + profile.terms.contractDays * DAY));
      const next = new Date(`${cur}T12:00:00Z`);
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      state.contract[supplierId] = iso(next);
      break;
    }
    case "request-prices":
      state.priceRequested[supplierId] = at;
      break;
    case "po-send":
    case "po-advance": {
      if (!payload.ref || !payload.number?.endsWith(`-${profile.short}`)) return "Okänd inköpsorder.";
      const res = await applyPoAction(payload.ref, { action: kind === "po-send" ? "send" : "advance", number: payload.number });
      return res.error ?? "";
    }
    default:
      return "Okänd åtgärd.";
  }
  await writeState(state);
  return "";
}
