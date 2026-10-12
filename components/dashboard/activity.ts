import { familyById } from "@/lib/catalog";
import { type QuoteView, STAGE_LABEL } from "@/lib/quoteTypes";

export type Activity = { at: string; ref: string; company: string; kind: "skapad" | "kommentar" | "godkänt" | "order"; text: string };

const nameOf = (id?: string) => (id ? (familyById(id)?.name ?? id) : "");

/** Everything that has happened on the quotes, newest first. */
export function activityOf(quotes: QuoteView[]): Activity[] {
  const out: Activity[] = [];
  for (const q of quotes) {
    const base = { ref: q.ref, company: q.company };
    out.push({ ...base, at: q.createdAt, kind: "skapad", text: `Offert skapad · ${q.lines.length} ${q.lines.length === 1 ? "produkt" : "produkter"}` });
    for (const c of q.share?.comments ?? []) {
      out.push({ ...base, at: c.at, kind: "kommentar", text: `${c.name}${c.productId ? ` om ${nameOf(c.productId)}` : ""}${c.pin ? " (på korrekturet)" : ""}: ”${c.text}”` });
    }
    const approvals = Object.entries(q.share?.approvals ?? {});
    const byAt = new Map<string, { name: string; ids: string[] }>();
    for (const [id, a] of approvals) {
      const k = `${a.at}|${a.name}`;
      byAt.set(k, { name: a.name, ids: [...(byAt.get(k)?.ids ?? []), id] });
    }
    for (const [k, v] of byAt) {
      const at = k.split("|")[0];
      out.push({ ...base, at, kind: "godkänt", text: v.ids.length === q.lines.length ? `${v.name} godkände offert och 3D-korrektur` : `${v.name} godkände ${v.ids.map(nameOf).join(", ")}` });
    }
    for (const h of q.order?.history ?? []) {
      if (h.stage === "bekraftad" || h.stage === "korrektur") continue;
      out.push({ ...base, at: h.at, kind: "order", text: `${STAGE_LABEL[h.stage]}${h.note ? ` – ${h.note}` : ""}` });
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

export type Todo = { ref: string; company: string; text: string; tone: "urgent" | "normal" };

const daysTo = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

/** What the seller should do next, most urgent first. */
export function todosOf(quotes: QuoteView[]): Todo[] {
  const out: Todo[] = [];
  for (const q of quotes) {
    const base = { ref: q.ref, company: q.company };
    const last = q.share?.comments.at(-1);
    if (last && !q.order && Date.now() - new Date(last.at).getTime() < 14 * 86_400_000) out.push({ ...base, tone: "normal", text: `Svara på kommentaren från ${last.name}` });
    if (q.order?.stage === "korrektur") out.push({ ...base, tone: "urgent", text: "Godkänd – skicka inköpsorder och sätt i tryck" });
    if (q.eventDate && !q.order && q.status !== "fakturerad") {
      const d = daysTo(q.eventDate);
      if (d >= 0 && d <= 21) out.push({ ...base, tone: d <= 10 ? "urgent" : "normal", text: `Eventet är om ${d} dagar och offerten är inte godkänd` });
    }
    if (q.status === "skapad" && !q.share && Date.now() - new Date(q.createdAt).getTime() > 2 * 86_400_000) out.push({ ...base, tone: "normal", text: "Skapad men inte skickad – följ upp" });
  }
  return out.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "urgent" ? -1 : 1));
}

/** Reminders customers asked for, as to-dos for the seller in the week before the deadline. */
export function reminderTodos(reminders: { email: string; brand: string; orderBy: string; remindOn: string }[], now: number): Todo[] {
  return reminders
    .filter((r) => new Date(`${r.orderBy}T23:59:00Z`).getTime() >= now && new Date(`${r.remindOn}T00:00:00Z`).getTime() - now < 7 * 86_400_000)
    .map((r) => ({ ref: "", company: r.brand || r.email, tone: "urgent" as const, text: `Påminn ${r.email} – sista beställningsdag ${r.orderBy}` }));
}

export const SEEN_KEY = "pach.dash.seen";
