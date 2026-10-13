"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CustomerMark } from "@/components/dashboard/CustomerMark";
import { fmtDate, STATUS_LABEL } from "@/components/dashboard/useQuotes";
import { useReorder } from "@/components/dashboard/useReorder";
import { familyById } from "@/lib/catalog";
import type { CustomerDetail } from "@/lib/customers";
import { sek } from "@/lib/pricing";

export default function CustomerPage() {
  const { key } = useParams<{ key: string }>();
  const router = useRouter();
  const [c, setC] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [login, setLogin] = useState<{ email: string; path: string } | null>(null);
  const [add, setAdd] = useState({ name: "", email: "", role: "" });
  const [copied, setCopied] = useState(false);
  const reorder = useReorder();

  const load = useCallback(() => {
    fetch(`/api/dashboard/customers/${key}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => setC(j.customer))
      .catch(() => setError("Kunden hittades inte."));
  }, [key]);
  useEffect(() => {
    load();
  }, [load]);

  const post = async (body: Record<string, unknown>) => {
    setMsg("");
    const res = await fetch(`/api/dashboard/customers/${key}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(j.error || "Något gick fel.");
      return null;
    }
    if (j.customer) setC(j.customer);
    return j;
  };

  if (error) {
    return (
      <div className="dash-page">
        <p className="table-empty">
          {error} <Link href="/dashboard/kunder">Till kunderna</Link>
        </p>
      </div>
    );
  }
  if (!c) return <div className="dash-page"><p className="table-empty">Hämtar kunden…</p></div>;

  const portal = `${typeof window === "undefined" ? "" : window.location.origin}${c.portalPath}`;

  return (
    <div className="dash-page kd-customer">
      <div className="dash-head">
        <div className="kd-cell-name">
          <CustomerMark name={c.name} host={c.host} size={56} />
          <div>
            <p className="drawer-note kp-crumb">
              <Link href="/dashboard/kunder">Kunder</Link> / {c.name}
            </p>
            <h1>{c.name}</h1>
            <p>{c.host ?? "Utan webbadress – kopplad på företagsnamnet"}</p>
          </div>
        </div>
        <div className="kp-head-actions">
          <button
            type="button"
            className="dash-btn ghost"
            onClick={() => {
              void navigator.clipboard?.writeText(portal).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              });
            }}
          >
            {copied ? "Kopierad ✓" : "Kopiera portallänk"}
          </button>
          <a className="dash-btn" href={c.portalPath} target="_blank" rel="noreferrer">
            Öppna kundens portal
          </a>
        </div>
      </div>

      <div className="kpis">
        <div><span>Offerter</span><strong>{c.quotes}</strong></div>
        <div><span>Ordrar</span><strong>{c.orders}</strong></div>
        <div><span>Ordervärde exkl. moms</span><strong>{sek(c.ordered)}</strong></div>
        <div><span>Öppna offerter</span><strong>{c.open}</strong></div>
      </div>

      {c.requests.length ? (
        <section className="card">
          <h2>Önskemål från kunden</h2>
          <ul className="kd-reqs">
            {c.requests.map((r) => (
              <li key={r.id} className={r.draftStatus === "skapad" ? "is-new" : ""}>
                <div>
                  <b>{r.lines.map((l) => `${l.qty} st ${familyById(l.productId)?.name ?? l.productId}`).join(" · ")}</b>
                  <small>
                    {fmtDate(r.at)} · {r.by.name}
                    {r.by.email ? ` (${r.by.email})` : ""} · samma som {r.fromRef}
                  </small>
                  {r.note ? <p>”{r.note}”</p> : null}
                </div>
                <span className="kd-status">{r.status}</span>
                {r.draftStatus === "skapad" ? (
                  <Link className="dash-btn" href={`/dashboard/offerter/bygg?ref=${r.draftRef}`}>
                    Öppna utkastet
                  </Link>
                ) : (
                  <Link className="dash-btn ghost" href={`/dashboard/offerter?open=${r.draftRef}`}>
                    Visa offerten
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card">
        <h2>Offerter och ordrar</h2>
        <ul className="kd-quotes">
          {c.quotesList.map((q) => {
            const isOrder = q.status === "godkand" || q.status === "fakturerad";
            return (
              <li key={q.ref}>
                <span className="thumbs">
                  {q.lines.slice(0, 3).map((l) => (
                    <Image key={l.productId} src={l.image || familyById(l.productId)?.image || ""} alt="" width={48} height={48} unoptimized={Boolean(l.image)} />
                  ))}
                </span>
                <span>
                  <b>
                    {q.ref}
                    {q.origin ? <em className="kd-origin">{q.origin.by === "kund" ? "Önskemål från kunden" : "Ombeställning"}</em> : null}
                  </b>
                  <small>
                    {fmtDate(q.createdAt)} · {q.priced.map((l) => `${l.qty} ${l.name}`).join(", ")}
                  </small>
                </span>
                <b className="r">{sek(q.total)}</b>
                <i className={`badge badge-${q.status}`}>{STATUS_LABEL[q.status]}</i>
                <span className="kd-quote-actions">
                  <Link href={`/dashboard/offerter?open=${q.ref}`}>Öppna</Link>
                  {isOrder ? (
                    <button type="button" disabled={reorder.busy === q.ref} onClick={() => void reorder.run(q.ref).then((ref) => ref && router.push(`/dashboard/offerter/bygg?ref=${ref}`))}>
                      {reorder.busy === q.ref ? "Skapar…" : "Ny offert från denna"}
                    </button>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
        {reorder.error ? <p className="brandbar-err">{reorder.error}</p> : null}
      </section>

      <section className="card">
        <h2>Kontakter</h2>
        <p className="drawer-note">Kontakterna kan logga in i portalen med en länk via e-post. Alla som fått en offert finns med automatiskt.</p>
        <ul className="kd-contacts">
          {c.contacts.map((x) => (
            <li key={x.email}>
              <span className="share-avatar">{x.name.slice(0, 1).toUpperCase()}</span>
              <span>
                <b>
                  {x.name}
                  {x.role ? <small> · {x.role}</small> : null}
                </b>
                <small>
                  {x.email}
                  {x.fromSend ? " · fick en offert" : ""}
                </small>
              </span>
              <button
                type="button"
                className="dash-btn ghost"
                onClick={() => void post({ login: x.email }).then((j) => j?.path && setLogin({ email: x.email, path: j.path }))}
              >
                Skicka inloggningslänk
              </button>
              {x.fromSend ? <span /> : (
                <button type="button" className="offer-remove" aria-label={`Ta bort ${x.name}`} onClick={() => void post({ remove: x.email })}>
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
        {login ? (
          <p className="kd-demo">
            Inloggningslänk till {login.email} – e-posten är simulerad i demon, så här är länken som skickas:{" "}
            <a href={login.path} target="_blank" rel="noreferrer">
              Logga in som kunden
            </a>
          </p>
        ) : null}
        <form
          className="fields kd-add"
          onSubmit={(e) => {
            e.preventDefault();
            void post({ add }).then((j) => j && setAdd({ name: "", email: "", role: "" }));
          }}
        >
          <label>
            Namn
            <input value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} placeholder="Anna Berg" />
          </label>
          <label>
            E-post
            <input type="email" value={add.email} onChange={(e) => setAdd({ ...add, email: e.target.value })} placeholder="anna@foretaget.se" />
          </label>
          <label>
            Roll
            <input value={add.role} onChange={(e) => setAdd({ ...add, role: e.target.value })} placeholder="Inköp" />
          </label>
          <button type="submit" className="dash-btn">
            Lägg till kontakt
          </button>
        </form>
        {msg ? <p className="brandbar-err">{msg}</p> : null}
      </section>
    </div>
  );
}
