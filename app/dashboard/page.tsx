"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { activityOf, reminderTodos, SEEN_KEY, todosOf } from "@/components/dashboard/activity";
import { fmtDate, STATUS_LABEL, useQuotes } from "@/components/dashboard/useQuotes";
import { LevelBadge, useSchedules } from "@/components/dashboard/useSchedules";
import { LEVELS } from "@/lib/schedule";
import { fmtDay } from "@/lib/delivery";
import { sek } from "@/lib/pricing";

const KIND_LABEL = { skapad: "Ny offert", kommentar: "Kommentar", godkänt: "Godkänt", order: "Order" } as const;

const ago = (iso: string, now: number) => {
  const min = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "nyss";
  if (min < 60) return `${min} min sedan`;
  if (min < 24 * 60) return `${Math.round(min / 60)} tim sedan`;
  return fmtDate(iso);
};

export default function Overview() {
  const { quotes, error } = useQuotes({ poll: 20_000 });
  const [seen, setSeen] = useState("");
  const [now, setNow] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage and the clock are only read after mount
    setSeen(localStorage.getItem(SEEN_KEY) ?? "");
    setNow(Date.now());
    localStorage.setItem(SEEN_KEY, new Date().toISOString());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const [reminders, setReminders] = useState<{ email: string; brand: string; orderBy: string; remindOn: string }[]>([]);
  useEffect(() => {
    fetch("/api/reminder", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setReminders(j.reminders ?? []))
      .catch(() => {});
  }, []);
  const qs = useMemo(() => quotes ?? [], [quotes]);
  const schedules = useSchedules(quotes);
  /** Orders whose next step is due within a few working days, worst first. */
  const doNow = useMemo(
    () =>
      Object.values(schedules ?? {})
        .filter((s) => s.level !== "ok")
        .sort((a, b) => LEVELS.indexOf(b.level) - LEVELS.indexOf(a.level) || (a.next?.due ?? "").localeCompare(b.next?.due ?? ""))
        .map((s) => ({ s, company: qs.find((q) => q.ref === s.ref)?.company ?? s.ref })),
    [schedules, qs],
  );
  // Orders already under "Gör nu" are not repeated in the to-do list.
  const todos = useMemo(() => [...reminderTodos(reminders, now), ...todosOf(qs).filter((t) => !doNow.some((d) => d.s.ref === t.ref))].slice(0, 8), [qs, reminders, now, doNow]);
  const feed = useMemo(() => activityOf(qs).slice(0, 14), [qs]);

  const upcoming = useMemo(
    () =>
      qs
        .filter((q) => q.eventDate && new Date(q.eventDate).getTime() >= now - 86_400_000)
        .sort((a, b) => a.eventDate!.localeCompare(b.eventDate!))
        .slice(0, 5),
    [qs, now],
  );
  const kpi = useMemo(() => {
    const week = now - 7 * 86_400_000;
    const open = qs.filter((q) => q.status === "skapad" || q.status === "skickad");
    const won = qs.filter((q) => q.status === "godkand" || q.status === "fakturerad");
    return {
      newWeek: qs.filter((q) => new Date(q.createdAt).getTime() > week).length,
      open: open.length,
      openValue: open.reduce((s, q) => s + q.total, 0),
      won: won.length,
      rate: qs.length ? Math.round((won.length / qs.length) * 100) : 0,
    };
  }, [qs, now]);

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1>Översikt</h1>
          <p>Vad som hänt, vad som väntar och vilka event som närmar sig.</p>
        </div>
        <Link href="/" className="dash-btn">
          + Ny offert
        </Link>
      </div>

      <div className="kpis">
        <div>
          <span>Nya senaste veckan</span>
          <strong>{kpi.newWeek}</strong>
        </div>
        <div>
          <span>Väntar på kund</span>
          <strong>{kpi.open}</strong>
          <small>{sek(kpi.openValue)}</small>
        </div>
        <div>
          <span>Godkända</span>
          <strong>{kpi.won}</strong>
        </div>
        <div>
          <span>Andel som blir order</span>
          <strong>{kpi.rate} %</strong>
        </div>
      </div>

      {error ? <p className="brandbar-err">{error}</p> : null}

      <div className="ov-grid">
        <section className="card ov-todo">
          <h2>Gör nu</h2>
          {doNow.length ? (
            <ul className="ov-now">
              {doNow.map(({ s, company }) => (
                <li key={s.ref} className={`is-${s.level}`}>
                  <Link href={`/dashboard/offerter?open=${s.ref}`}>
                    <b>
                      {company} <LevelBadge level={s.level} />
                    </b>
                    <span>{s.text}</span>
                    <small>
                      {s.ref} · behövs {fmtDay(s.eventDate)}
                    </small>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          <h3 className="ov-sub">Att göra</h3>
          {quotes === null ? <p className="drawer-note">Hämtar…</p> : null}
          {quotes && todos.length === 0 ? <p className="drawer-note">Inget som väntar på dig just nu.</p> : null}
          <ul>
            {todos.map((t, i) => (
              <li key={`${t.ref}-${i}`} className={t.tone === "urgent" ? "is-urgent" : ""}>
                <Link href={t.ref ? `/dashboard/offerter?open=${t.ref}` : "/dashboard"}>
                  <b>{t.company}</b>
                  <span>{t.text}</span>
                  <small>{t.ref || "Påminnelse"}</small>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="card ov-events">
          <h2>Kommande event</h2>
          {quotes && upcoming.length === 0 ? <p className="drawer-note">Inga offerter med eventdatum.</p> : null}
          <ul>
            {upcoming.map((q) => {
              const days = Math.ceil((new Date(q.eventDate!).getTime() - now) / 86_400_000);
              return (
                <li key={q.ref}>
                  <span className={`ov-days${days <= 10 ? " is-soon" : ""}`}>
                    <b>{Math.max(0, days)}</b>
                    <small>dagar</small>
                  </span>
                  <Link href={`/dashboard/offerter?open=${q.ref}`}>
                    <b>{q.company}</b>
                    <span>
                      {fmtDay(q.eventDate!)} · <i className={`badge badge-${q.status}`}>{STATUS_LABEL[q.status]}</i>
                      {schedules?.[q.ref] ? <LevelBadge level={schedules[q.ref].level} title={schedules[q.ref].text} /> : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card ov-feed">
          <h2>Aktivitet</h2>
          <ol>
            {feed.map((a, i) => (
              <li key={`${a.ref}-${a.at}-${i}`} className={`ov-${a.kind}${seen && a.at > seen ? " is-new" : ""}`}>
                <span className="ov-dot" aria-hidden />
                <Link href={`/dashboard/offerter?open=${a.ref}`}>
                  <span className="ov-meta">
                    <b>{KIND_LABEL[a.kind]}</b> · {a.company} · {now ? ago(a.at, now) : fmtDate(a.at)}
                    {seen && a.at > seen ? <em>Ny</em> : null}
                  </span>
                  <span>{a.text}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
