"use client";

import { useEffect, useState } from "react";
import { fmtDate } from "@/components/dashboard/useQuotes";
import type { Demo } from "@/lib/demos";
import { EVENTS, familiesForEvent } from "@/lib/events";
import { hostOk, normalizeHost } from "@/lib/host";

async function pool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) await worker(items[i++]);
  }));
}

const post = (url: string, body: object) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json().catch(() => ({})));

export default function SalesStudioPage() {
  const [site, setSite] = useState("");
  const [event, setEvent] = useState<string>(EVENTS[0].slug);
  const [contact, setContact] = useState("");
  const [step, setStep] = useState("");
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState("");
  const [demos, setDemos] = useState<Demo[] | null>(null);

  const load = () =>
    fetch("/api/dashboard/demos", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setDemos(j.demos ?? []))
      .catch(() => setDemos([]));
  useEffect(() => {
    void load();
  }, []);

  const copy = (url: string) => {
    void navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(url);
    setTimeout(() => setCopied(""), 1800);
  };

  const run = async () => {
    const host = normalizeHost(site);
    if (!hostOk(host)) return setError("Skriv prospektens webbadress, t.ex. volvo.com");
    setError("");
    setLink("");
    try {
      setStep("Läser webbplatsen och verifierar loggan…");
      setDone(0);
      setTotal(1);
      const profile = await post("/api/profile", { url: host });
      if (profile.error) throw new Error(profile.error);
      const brand = await fetch(`/api/brand?host=${encodeURIComponent(profile.host ?? host)}`).then((r) => r.json());
      const h = brand.host ?? profile.host ?? host;

      const ev = EVENTS.find((e) => e.slug === event)!;
      const items = familiesForEvent(ev.slug);
      const jobs = [{ url: "/api/scene", body: { event: ev.slug, host: h } }, ...ev.photos.map((_, index) => ({ url: "/api/photo", body: { event: ev.slug, index, host: h } })), ...items.map((f) => ({ url: "/api/generate", body: { productId: f.id, host: h } }))];
      setTotal(jobs.length);
      setStep(`Brandar ${ev.name.toLowerCase()} och ${items.length} produkter för ${brand.name ?? h}…`);
      let n = 0;
      await pool(jobs, 6, async (j) => {
        await post(j.url, j.body).catch(() => null);
        n += 1;
        setDone(n);
      });

      const res = await post("/api/dashboard/demos", { host: h, brand: brand.name ?? profile.name, color: brand.color ?? profile.color, event: ev.slug, contact });
      if (res.error) throw new Error(res.error);
      setLink(`${window.location.origin}/demo/${res.demo.token}`);
      setStep("");
      void load();
    } catch (err) {
      setStep("");
      setError(err instanceof Error ? err.message : "Något gick fel.");
    }
  };

  const busy = Boolean(step);

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1>Säljstudio</h1>
          <p>Branda allt i förväg och skicka en personlig länk innan första mötet – prospekten ser sin egen logga på allt direkt när den öppnar.</p>
        </div>
      </div>

      <form
        className="studio-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <label>
          Prospektens webbadress
          <input value={site} onChange={(e) => setSite(e.target.value)} placeholder="volvo.com" disabled={busy} />
        </label>
        <label>
          Tillfälle
          <select value={event} onChange={(e) => setEvent(e.target.value)} disabled={busy}>
            {EVENTS.map((e) => (
              <option key={e.slug} value={e.slug}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Kontaktperson (valfritt)
          <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Anna" disabled={busy} />
        </label>
        <button type="submit" className="dash-btn" disabled={busy}>
          {busy ? "Förbereder…" : "Skapa demolänk"}
        </button>
      </form>
      {error ? <p className="brandbar-err">{error}</p> : null}

      {busy || link ? (
        <div className="studio-progress">
          {busy ? (
            <>
              <p>{step}</p>
              <div className="studio-bar">
                <span style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }} />
              </div>
            </>
          ) : (
            <>
              <p>Klart – allt är genererat och laddar direkt för prospekten.</p>
              <div className="studio-link">
                <code>{link.replace(/^https?:\/\//, "")}</code>
                <button type="button" className="dash-btn" onClick={() => copy(link)}>
                  {copied === link ? "Kopierad ✓" : "Kopiera länk"}
                </button>
                <a href={link} target="_blank" rel="noreferrer">
                  Öppna som prospekten
                </a>
              </div>
            </>
          )}
        </div>
      ) : null}

      <div className="table">
        <div className="tr th">
          <span>Prospekt</span>
          <span>Tillfälle</span>
          <span>Kontakt</span>
          <span className="r">Öppnad</span>
          <span>Länk</span>
        </div>
        {demos === null ? <p className="table-empty">Hämtar…</p> : null}
        {demos && !demos.length ? <p className="table-empty">Inga demolänkar än.</p> : null}
        {demos?.map((d) => {
          const url = typeof window === "undefined" ? `/demo/${d.token}` : `${window.location.origin}/demo/${d.token}`;
          return (
            <div key={d.token} className="tr">
              <span>
                <b>{d.brand}</b>
                <small>
                  {d.host} · {fmtDate(d.createdAt)}
                </small>
              </span>
              <span>{EVENTS.find((e) => e.slug === d.event)?.name}</span>
              <span>{d.contact ?? "–"}</span>
              <span className="r">
                <b>{d.opens.length} ggr</b>
                {d.opens.length ? <small>senast {fmtDate(d.opens[d.opens.length - 1])}</small> : null}
              </span>
              <span>
                <button type="button" className="cz-link" onClick={() => copy(url)}>
                  {copied === url ? "Kopierad ✓" : "Kopiera"}
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
