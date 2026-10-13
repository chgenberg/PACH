"use client";

import { useEffect, useState } from "react";
import { fmtDay } from "@/lib/delivery";
import { LEVEL_LABEL, type Level, type Schedule } from "@/lib/schedule";

/** Every order's critical path from the server, refreshed every minute and when the page changes. */
export function useSchedules(dep: unknown = null) {
  const [schedules, setSchedules] = useState<Record<string, Schedule> | null>(null);
  useEffect(() => {
    let live = true;
    const load = () =>
      fetch("/api/dashboard/schedule", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => live && setSchedules(j.schedules ?? {}))
        .catch(() => {});
    void load();
    const t = setInterval(load, 60_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [dep]);
  return schedules;
}

export const isAlert = (l: Level) => l === "bradskande" || l === "kritisk";

export function LevelBadge({ level, title }: { level: Level; title?: string }) {
  return (
    <i className={`lv lv-${level}`} title={title}>
      {LEVEL_LABEL[level]}
    </i>
  );
}

const dueText = (left: number) => (left > 1 ? `${left} arbetsdagar kvar` : left === 1 ? "i morgon" : left === 0 ? "i dag" : `${-left} ${left === -1 ? "arbetsdag" : "arbetsdagar"} sent`);

/** The order's milestones in the drawer: done, or how much time is left and how serious it is. */
export function ScheduleBlock({ schedule }: { schedule: Schedule }) {
  return (
    <div className={`drawer-block sch sch-${schedule.level}`}>
      <p className="drawer-label">
        Tidsplan <LevelBadge level={schedule.level} />
      </p>
      <p className="sch-text">{schedule.text}</p>
      <ol className="sch-list">
        {schedule.milestones.map((m) => (
          <li key={m.key} className={m.done ? "is-done" : `is-${m.level}`}>
            <span className="sch-dot" aria-hidden />
            <div>
              <b>{m.label}</b>
              <small>
                {m.done ? "Klart" : `Senast ${fmtDay(m.due)} · ${dueText(m.left)}`}
                {!m.done && m.who.length && m.key !== "approve" ? ` · ${m.who.join(", ")}` : ""}
              </small>
            </div>
          </li>
        ))}
      </ol>
      <p className="drawer-note">Räknat baklänges från {fmtDay(schedule.eventDate)} med leverantörernas ledtider, korrektur och frakt. Helger och svenska helgdagar räknas inte som arbetsdagar.</p>
    </div>
  );
}
