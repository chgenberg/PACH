"use client";

import { useEffect, useState } from "react";
import { fmtDay, orderByDate, subWorkdays } from "@/lib/delivery";

const DAY = 86_400_000;
const at = (iso: string) => new Date(`${iso}T12:00:00Z`).getTime();

/** Days to the event, the last day to approve the order, and an optional reminder before that day. */
export function Countdown({ eventDate, slowestDays, brand, host, remind = true }: { eventDate: string; slowestDays: number; brand?: string; host?: string; remind?: boolean }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- today's date must come from the browser
    setNow(Date.now());
  }, []);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  if (!now) return null;
  const orderBy = orderByDate(eventDate, slowestDays);
  const remindOn = subWorkdays(new Date(`${orderBy}T12:00:00Z`), 3).toISOString().slice(0, 10);
  const toEvent = Math.ceil((at(eventDate) - now) / DAY);
  const toOrder = Math.ceil((at(orderBy) - now) / DAY);
  if (toEvent < 0) return null;
  const tone = toOrder < 0 ? "late" : toOrder <= 3 ? "soon" : "ok";

  const save = async () => {
    setState("busy");
    const res = await fetch("/api/reminder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, eventDate, orderBy, remindOn, brand, host }) }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok) {
      setState("done");
      setMsg(`Vi påminner ${email} ${fmtDay(remindOn)}.`);
    } else {
      setState("error");
      setMsg(j.error || "Kunde inte spara påminnelsen.");
    }
  };

  return (
    <div className={`countdown is-${tone}`}>
      <div className="countdown-num">
        <b>{toEvent}</b>
        <small>{toEvent === 1 ? "dag" : "dagar"} kvar</small>
      </div>
      <div className="countdown-text">
        <b>{tone === "late" ? "Det blir tight – vanlig leverans hinner inte" : `Godkänn senast ${fmtDay(orderBy)}`}</b>
        <span>
          {tone === "late"
            ? `Eventet är ${fmtDay(eventDate)} – byt till en snabbare märkmetod eller ring oss, så hittar vi en väg.`
            : `${toOrder === 0 ? "Det är i dag" : `Om ${toOrder} ${toOrder === 1 ? "dag" : "dagar"}`} – då hinner allt fram till ${fmtDay(eventDate)}.`}
        </span>
      </div>
      {remind && tone !== "late" ? (
        state === "done" ? (
          <p className="countdown-ok">✓ {msg}</p>
        ) : (
          <form
            className="countdown-form"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="din@epost.se" aria-label="E-post för påminnelse" required />
            <button type="submit" disabled={state === "busy"}>
              {state === "busy" ? "…" : "Påminn mig"}
            </button>
            {state === "error" ? <small>{msg}</small> : null}
          </form>
        )
      ) : null}
    </div>
  );
}
