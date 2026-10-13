"use client";

import { useState } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export function PortalLogin({ expired }: { expired: boolean }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ path: string | null } | null>(null);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/kund/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Något gick fel.");
      setDone({ path: j.path });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Något gick fel.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="shop">
      <SiteHeader />
      <div className="cat kd-login">
        <p className="kicker">För kunder</p>
        <h1>Era offerter och ordrar</h1>
        <p className="lede">Skriv e-postadressen som offerterna skickats till, så får du en inloggningslänk. Där ser du aktuella offerter, tidigare ordrar och kan beställa samma igen.</p>
        {expired ? <p className="kp-warn">Länken har gått ut eller redan använts. Be om en ny nedan.</p> : null}
        {done ? (
          <div className="kd-sent">
            <b>Kolla din inkorg.</b>
            <p>Om adressen finns hos oss har vi skickat en inloggningslänk som gäller i 30 minuter.</p>
            {done.path ? (
              <p className="kd-demo">
                Demo – e-posten är simulerad. Här är länken som skickas: <a href={done.path}>Logga in</a>
              </p>
            ) : (
              <p className="kd-demo">Demo: adressen finns inte bland kundkontakterna. Prova lisa@bryggeriet.se.</p>
            )}
          </div>
        ) : (
          <form
            className="kd-form"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="namn@foretaget.se" autoComplete="email" aria-label="E-post" required />
            <button type="submit" className="share-approve-btn" disabled={busy}>
              {busy ? "Skickar…" : "Skicka inloggningslänk"}
            </button>
          </form>
        )}
        {error ? <p className="brandbar-err">{error}</p> : null}
      </div>
      <SiteFooter />
    </div>
  );
}
