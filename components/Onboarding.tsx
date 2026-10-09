"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { hostOk, normalizeHost } from "@/lib/host";

const OCCASIONS = [
  {
    id: "massa",
    label: "Mässa",
    line: "Monter, vägg och det som syns på håll",
    when: "När är mässan?",
    people: "besökare",
    audience: ["Under 500", "500–2 000", "2 000–10 000", "10 000+"],
  },
  {
    id: "konferens",
    label: "Konferens",
    line: "Scen, registrering och namnbrickor",
    when: "När är konferensen?",
    people: "deltagare",
    audience: ["Under 100", "100–300", "300–1 000", "1 000+"],
  },
  {
    id: "kickoff",
    label: "Kick-off",
    line: "Lokalen och laget",
    when: "När är kick-offen?",
    people: "deltagare",
    audience: ["Under 30", "30–100", "100–300", "300+"],
  },
  {
    id: "event",
    label: "Event",
    line: "Fotovägg, bar och mingel",
    when: "När är eventet?",
    people: "gäster",
    audience: ["Under 100", "100–300", "300–1 000", "1 000+"],
  },
] as const;

type OccasionId = (typeof OCCASIONS)[number]["id"];

type Draft = {
  occasion: OccasionId | null;
  host: string;
  date: string;
  size: number | null;
};

const EMPTY: Draft = { occasion: null, host: "", date: "", size: null };
const QUESTIONS = 4;

const occasionOf = (id: OccasionId | null) => OCCASIONS.find((item) => item.id === id) ?? null;

function isoInDays(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function speakDate(iso: string) {
  return new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${iso}T12:00:00`));
}

function todayIso() {
  return isoInDays(0);
}

export function Onboarding() {
  const stageRef = useRef<HTMLElement>(null);
  const hostRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const timer = useRef<number | null>(null);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<"forward" | "back">("forward");
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState("");
  const [returnTo, setReturnTo] = useState<number | null>(null);
  const [minDate, setMinDate] = useState("");

  const occasion = occasionOf(draft.occasion);
  const reviewing = step >= QUESTIONS;

  useEffect(() => {
    setMinDate(todayIso());
  }, []);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const move = (event: PointerEvent) => {
      const x = (event.clientX / window.innerWidth) * 100;
      const y = (event.clientY / window.innerHeight) * 100;
      node.style.setProperty("--x", `${x}%`);
      node.style.setProperty("--y", `${y}%`);
    };
    node.addEventListener("pointermove", move);
    return () => node.removeEventListener("pointermove", move);
  }, []);

  useEffect(() => {
    if (step === 1) hostRef.current?.focus();
    if (step === 2) dateRef.current?.focus();
  }, [step]);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const go = (next: number, direction: "forward" | "back" = "forward") => {
    if (timer.current) window.clearTimeout(timer.current);
    setDir(direction);
    setError("");
    setStep(next);
  };

  const soon = (fn: () => void) => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(fn, 240);
  };

  const fail = (message: string) => setError(message);

  const advance = () => {
    if (step === 0 && !draft.occasion) return fail("Välj ett tillfälle.");
    if (step === 1 && !hostOk(normalizeHost(draft.host))) return fail("Skriv en webbadress, till exempel volvo.com");
    if (step === 2 && (!draft.date || draft.date < (minDate || todayIso()))) return fail("Välj ett datum framåt i tiden.");
    if (step === 3 && draft.size === null) return fail("Välj en storlek.");
    if (step === 1) setDraft((current) => ({ ...current, host: normalizeHost(current.host) }));
    if (returnTo !== null && step < QUESTIONS) {
      const backTo = returnTo;
      setReturnTo(null);
      go(backTo);
      return;
    }
    go(Math.min(step + 1, QUESTIONS));
  };

  const back = () => {
    if (step === 0) return;
    setReturnTo(null);
    go(step - 1, "back");
  };

  const edit = (target: number) => {
    setReturnTo(QUESTIONS);
    go(target, "back");
  };

  const chooseOccasion = (id: OccasionId) => {
    setDraft((current) => ({ ...current, occasion: id }));
    setError("");
    const dest = returnTo ?? 1;
    soon(() => {
      setReturnTo(null);
      go(dest);
    });
  };

  const chooseSize = (index: number) => {
    setDraft((current) => ({ ...current, size: index }));
    setError("");
    const dest = returnTo ?? QUESTIONS;
    soon(() => {
      setReturnTo(null);
      go(dest);
    });
  };

  const reset = () => {
    setDraft(EMPTY);
    setReturnTo(null);
    go(0, "back");
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      back();
      return;
    }
    if (event.key === "Enter" && (event.target as HTMLElement).tagName !== "BUTTON") {
      event.preventDefault();
      if (!reviewing) advance();
    }
    if (step === 0 && ["1", "2", "3", "4"].includes(event.key) && (event.target as HTMLElement).tagName !== "INPUT") {
      const picked = OCCASIONS[Number(event.key) - 1];
      if (picked) chooseOccasion(picked.id);
    }
  };

  const copy = (() => {
    if (step === 0) return { kicker: "Tillfälle", title: "Vad ska profileras?", lede: "Ett val. Resten följer därifrån." };
    if (step === 1) return { kicker: occasion?.label ?? "Profil", title: "Var finns ni?", lede: "Där hämtar vi logotyp, färger och ton." };
    if (step === 2) return { kicker: "Tid", title: occasion?.when ?? "När är det?", lede: "Tidpunkten styr säsong och tempo." };
    if (step === 3) return { kicker: "Storlek", title: `Hur många ${occasion?.people ?? "personer"}?`, lede: "Antalet avgör hur mycket som följer med." };
    return { kicker: "Översikt", title: "Vi är redo.", lede: "Nästa steg läser in profilen från webben." };
  })();

  const ready =
    (step === 0 && draft.occasion !== null) ||
    (step === 1 && hostOk(normalizeHost(draft.host))) ||
    (step === 2 && Boolean(draft.date) && (!minDate || draft.date >= minDate)) ||
    (step === 3 && draft.size !== null);

  return (
    <main ref={stageRef} className="stage" onKeyDown={onKeyDown}>
      <section className="sheet" aria-labelledby={titleId}>
        <header className="sheet-top">
          <Image src="/PACH_logo.png" alt="PACH profile" width={2198} height={1069} priority className="mark" />
          <p className="sr-only" aria-live="polite">
            {copy.title}
          </p>
          <div className="meter" aria-hidden="true">
            {Array.from({ length: QUESTIONS }, (_, index) => (
              <i key={index} className={index < step ? "on" : index === step ? "on now" : ""} />
            ))}
          </div>
        </header>

        <div key={step} className={dir === "back" ? "sheet-body rise back" : "sheet-body rise"}>
          <p className="kicker">{copy.kicker}</p>
          <h1 id={titleId}>{copy.title}</h1>
          <p className="lede">{copy.lede}</p>

          {step === 0 && (
            <div className="grid" role="group" aria-label="Tillfälle">
              {OCCASIONS.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className="choice"
                  aria-pressed={draft.occasion === item.id}
                  onClick={() => chooseOccasion(item.id)}
                >
                  <span className="choice-no">0{index + 1}</span>
                  <span className="choice-name">{item.label}</span>
                  <span className="choice-line">{item.line}</span>
                </button>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="field">
              <label className="sr-only" htmlFor="host">
                Webbadress
              </label>
              <input
                id="host"
                ref={hostRef}
                className="url"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="foretag.se"
                value={draft.host}
                onChange={(event) => {
                  setDraft((current) => ({ ...current, host: event.target.value }));
                  setError("");
                }}
              />
            </div>
          )}

          {step === 2 && (
            <div className="field">
              <label className="sr-only" htmlFor="when">
                Datum
              </label>
              <input
                id="when"
                ref={dateRef}
                className="date"
                type="date"
                min={minDate || undefined}
                value={draft.date}
                onChange={(event) => {
                  setDraft((current) => ({ ...current, date: event.target.value }));
                  setError("");
                }}
              />
              {draft.date ? <p className="spoken">{speakDate(draft.date)}</p> : null}
              <div className="chips">
                {[
                  ["Om två veckor", 14],
                  ["Om en månad", 30],
                  ["Om tre månader", 90],
                ].map(([label, days]) => {
                  const iso = isoInDays(Number(days));
                  return (
                    <button
                      key={label}
                      type="button"
                      className="chip"
                      aria-pressed={draft.date === iso}
                      onClick={() => {
                        setDraft((current) => ({ ...current, date: iso }));
                        setError("");
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && occasion && (
            <div className="sizes" role="group" aria-label={`Antal ${occasion.people}`}>
              {occasion.audience.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  className="size"
                  aria-pressed={draft.size === index}
                  onClick={() => chooseSize(index)}
                >
                  <b>{label}</b>
                  <span>{occasion.people}</span>
                </button>
              ))}
            </div>
          )}

          {reviewing && occasion && draft.size !== null && (
            <div className="rows">
              <Summary label="Tillfälle" value={occasion.label} onEdit={() => edit(0)} />
              <Summary label="Webb" value={draft.host} onEdit={() => edit(1)} />
              <Summary label="Datum" value={draft.date ? speakDate(draft.date) : ""} onEdit={() => edit(2)} />
              <Summary label="Antal" value={`${occasion.audience[draft.size]} ${occasion.people}`} onEdit={() => edit(3)} />
            </div>
          )}

          {error ? (
            <p className="err" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="sheet-foot">
          {step === 0 ? (
            <span />
          ) : (
            <button type="button" className="back" onClick={back}>
              Tillbaka
            </button>
          )}
          {reviewing ? (
            <button type="button" className="back" onClick={reset}>
              Börja om
            </button>
          ) : (
            <button type="button" className="go" disabled={!ready} onClick={advance}>
              Fortsätt
              <Arrow />
            </button>
          )}
        </footer>
      </section>
    </main>
  );
}

function Summary({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <button type="button" className="row" onClick={onEdit}>
      <small>{label}</small>
      <strong>{value}</strong>
      <em>Ändra</em>
    </button>
  );
}

function Arrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
