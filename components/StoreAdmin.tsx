"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { familyById } from "@/lib/catalog";
import { sek } from "@/lib/pricing";

type Order = { id: string; at: string; name: string; email: string; total: number; items: { productId: string; size: string; qty: number }[] };
type Total = { productId: string; name: string; total: number; sizes: Record<string, number> };

const day = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "short" });

export function StoreAdmin(props: {
  adminKey: string;
  title: string;
  storePath: string;
  budget: number;
  sentRef: string | null;
  spent: number;
  orders: Order[];
  totals: Total[];
  estimate: number;
  productCount: number;
}) {
  const [copied, setCopied] = useState(false);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ref, setRef] = useState(props.sentRef);
  const [origin, setOrigin] = useState("");
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the origin is only known in the browser
  useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}${props.storePath}`;
  const people = props.orders.length;

  const send = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/store/admin/${props.adminKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Något gick fel.");
      setRef(j.ref);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Något gick fel.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="collect store-admin">
      <header className="store-hero">
        <p className="kicker">Butiksadmin · bara för dig</p>
        <h1>{props.title}</h1>
        <p className="lede">Spara den här sidan – här ser du vad personalen har valt. Butikslänken nedan skickar du till alla anställda.</p>
      </header>

      <div className="sa-wrap">
        <section className="sa-link">
          <div>
            <b>Butikslänk till personalen</b>
            <code>{url.replace(/^https?:\/\//, "")}</code>
          </div>
          <button
            type="button"
            className="offer-submit"
            onClick={() => {
              void navigator.clipboard?.writeText(url).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            }}
          >
            {copied ? "Kopierad ✓" : "Kopiera länk"}
          </button>
          <Link href={props.storePath} target="_blank" className="cz-link">
            Öppna butiken
          </Link>
        </section>

        <div className="kpis sa-kpis">
          <div>
            <span>Har beställt</span>
            <strong>{people}</strong>
          </div>
          <div>
            <span>Budget per person</span>
            <strong>{sek(props.budget)}</strong>
          </div>
          <div>
            <span>Personalens val</span>
            <strong>{sek(props.spent)}</strong>
          </div>
          <div>
            <span>Beräknad order inkl. tryckstart</span>
            <strong>{sek(props.estimate)}</strong>
          </div>

        </div>

        <section className="sa-block">
          <h2>Att beställa</h2>
          {props.totals.length ? (
            <ul className="sa-totals">
              {props.totals.map((t) => (
                <li key={t.productId}>
                  <span>
                    <b>{t.name}</b>
                    <small>{Object.entries(t.sizes).map(([s, n]) => `${s} ${n}`).join(" · ")}</small>
                  </span>
                  <strong>{t.total} st</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="drawer-note">Inga beställningar än – skicka butikslänken till personalen.</p>
          )}
        </section>

        <section className="sa-block">
          <h2>Beställningar</h2>
          {props.orders.length ? (
            <ul className="sa-orders">
              {props.orders.map((o) => (
                <li key={o.id}>
                  <span>
                    <b>{o.name}</b>
                    <small>
                      {o.items.map((i) => `${familyById(i.productId)?.name} ${i.size}${i.qty > 1 ? ` ×${i.qty}` : ""}`).join(", ")}
                    </small>
                  </span>
                  <em>
                    {sek(o.total)} · {day(o.at)}
                  </em>
                </li>
              ))}
            </ul>
          ) : (
            <p className="drawer-note">Här dyker varje anställds val upp.</p>
          )}
          {props.orders.length ? (
            <a className="cz-link" href={`/api/store/admin/${props.adminKey}`}>
              Ladda ner som CSV
            </a>
          ) : null}
        </section>

        <section className="sa-block sa-send">
          {ref ? (
            <>
              <h2>Skickad till PACH ✓</h2>
              <p className="drawer-note">Butiken är stängd och beställningen ligger hos oss som offert {ref}, med allas storlekar. Vi hör av oss med korrektur.</p>
            </>
          ) : (
            <>
              <h2>Klar? Skicka beställningen</h2>
              <p className="drawer-note">
                Butiken stängs och allt skickas till PACH som en samlad beställning med allas storlekar. Beräknad ordersumma är {sek(props.estimate)} exkl. moms – i den ingår en
                tryckstart per produkt, som väger tyngre när få har valt samma plagg. Vi återkommer med korrektur innan tryck.
              </p>
              <div className="sa-send-row">
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ditt telefonnummer" inputMode="tel" />
                <button type="button" className="offer-submit" disabled={busy || !props.orders.length} onClick={() => void send()}>
                  {busy ? "Skickar…" : `Skicka ${props.totals.reduce((s, t) => s + t.total, 0)} plagg till PACH`}
                </button>
              </div>
              {error ? <p className="brandbar-err">{error}</p> : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
