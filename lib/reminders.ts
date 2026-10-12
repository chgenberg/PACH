import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** "Remind me before the order deadline" – stored for the seller; the demo sends no e-mail. */
export type Reminder = { id: string; at: string; email: string; brand: string; host: string; eventDate: string; orderBy: string; remindOn: string };

const FILE = path.join(process.cwd(), ".data", "reminders.json");
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function listReminders(): Promise<Reminder[]> {
  return readFile(FILE, "utf8")
    .then((s) => JSON.parse(s) as Reminder[])
    .catch(() => []);
}

export async function addReminder(raw: Record<string, unknown>): Promise<Reminder | { error: string }> {
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const email = str(raw.email, 120).toLowerCase();
  const eventDate = str(raw.eventDate, 10);
  const orderBy = str(raw.orderBy, 10);
  const remindOn = str(raw.remindOn, 10);
  if (!EMAIL.test(email)) return { error: "Skriv en giltig e-postadress" };
  if (![eventDate, orderBy, remindOn].every((d) => ISO.test(d))) return { error: "Datumet saknas" };
  const list = await listReminders();
  const r: Reminder = { id: randomBytes(6).toString("hex"), at: new Date().toISOString(), email, brand: str(raw.brand, 80), host: str(raw.host, 120), eventDate, orderBy, remindOn };
  const next = [...list.filter((x) => !(x.email === email && x.eventDate === eventDate)), r].slice(-500);
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(next));
  return r;
}
