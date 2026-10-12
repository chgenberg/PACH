"use client";

import { useEffect, useState } from "react";
import { daysUntil, fmtDate, fmtTime } from "@/components/supplier/useSupplier";
import { sek } from "@/lib/pricing";
import {
  type IssueKind,
  ISSUE_KINDS,
  ISSUE_LABEL,
  NEXT_ACTION,
  type OrderAction,
  SUPPLIER_STAGE_LABEL,
  SUPPLIER_STAGES,
  type SupplierLine,
  type SupplierOrder,
} from "@/lib/supplierTypes";

export function StageBadge({ order }: { order: SupplierOrder }) {
  return <i className={`badge sp-badge sp-${order.state.stage}`}>{SUPPLIER_STAGE_LABEL[order.state.stage]}</i>;
}

/** Short warnings shown on rows and cards. */
export function OrderFlags({ order }: { order: SupplierOrder }) {
  const issues = Object.values(order.state.issues).filter((i) => !i.resolved).length;
  return (
    <>
      {order.late ? <em className="sp-flag is-late">Sen</em> : null}
      {order.short ? <em className="sp-flag is-short">Lager räcker inte</em> : null}
      {issues ? <em className="sp-flag">{issues} flagg{issues === 1 ? "a" : "or"}</em> : null}
    </>
  );
}

function IssueForm({ line, onSave }: { line: SupplierLine; onSave: (body: OrderAction) => Promise<string> }) {
  const [kind, setKind] = useState<IssueKind>(line.rows.some((r) => r.qty > r.available) ? "slut" : "tryck");
  const [note, setNote] = useState("");
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="sp-issue-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const err = await onSave({ action: "issue", productId: line.productId, kind, note, ...(kind === "slut" ? { replacement: extra } : kind === "datum" ? { date: extra } : {}) });
        setBusy(false);
        setError(err);
      }}
    >
      <div className="seg">
        {ISSUE_KINDS.map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
            {ISSUE_LABEL[k]}
          </button>
        ))}
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={kind === "slut" ? "T.ex. 25 st i L saknas, åter v. 44" : kind === "tryck" ? "T.ex. för fin text för brodyr i 9 cm – föreslår 11 cm" : "T.ex. tryckeriet är fullbokat till fredag"}
        required
      />
      {kind === "slut" ? <input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Ersättare (valfritt), t.ex. samma modell i svart" /> : null}
      {kind === "datum" ? <input type="date" value={extra} onChange={(e) => setExtra(e.target.value)} aria-label="Datum ni klarar" /> : null}
      <button type="submit" className="dash-btn" disabled={busy || !note.trim()}>
        {busy ? "Skickar…" : "Skicka till PACH"}
      </button>
      {error ? <p className="brandbar-err">{error}</p> : null}
    </form>
  );
}

function LineCard({ order, line, proofs, act }: { order: SupplierOrder; line: SupplierLine; proofs: { label: string; image: string }[]; act: (body: OrderAction) => Promise<string> }) {
  const [flagging, setFlagging] = useState(false);
  const issue = order.state.issues[line.productId];
  const open = SUPPLIER_STAGES.indexOf(order.state.stage) < SUPPLIER_STAGES.indexOf("skickad");
  return (
    <li className="sp-line">
      <div className="sp-line-head">
        {/* eslint-disable-next-line @next/next/no-img-element -- catalogue image */}
        <img src={line.image} alt="" />
        <div>
          <b>{line.name}</b>
          <small>
            {line.brand} · {line.color} · {line.qty} st
          </small>
        </div>
        <span className="r">
          <b>{sek(line.total)}</b>
          <small>
            {line.unit} + {line.printUnit} kr/st · start {line.printSetup} kr
          </small>
        </span>
      </div>

      <table className="sp-sizes">
        <thead>
          <tr>
            <th>Artikelnr</th>
            <th>Storlek</th>
            <th className="r">Antal</th>
            <th className="r">Tillgängligt</th>
          </tr>
        </thead>
        <tbody>
          {line.rows.map((r) => {
            const unset = r.size === "Ej angiven";
            const short = !unset && open && r.qty > r.available;
            return (
              <tr key={`${r.sku}-${r.size}`} className={short ? "is-short" : ""}>
                <td>{unset ? "—" : r.sku}</td>
                <td>{unset ? "Bekräftas av kund" : r.size}</td>
                <td className="r">{r.qty}</td>
                <td className="r">{unset ? "—" : short ? `${Math.max(0, r.available)} – saknas ${r.qty - Math.max(0, r.available)}` : r.available.toLocaleString("sv-SE")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ul className="sp-marking">
        {line.marking.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>

      {proofs.length ? (
        <div className="sp-proofs">
          {proofs.map((p) => (
            <a key={p.label} href={p.image} target="_blank" rel="noreferrer" title={p.label}>
              {/* eslint-disable-next-line @next/next/no-img-element -- proof data URL */}
              <img src={p.image} alt={p.label} />
            </a>
          ))}
          <small>Godkänd 3D-korrektur</small>
        </div>
      ) : null}

      {issue ? (
        <div className={`sp-issue${issue.resolved ? " is-resolved" : ""}`}>
          <b>
            {ISSUE_LABEL[issue.kind]}
            {issue.resolved ? " · löst" : ""}
          </b>
          <span>
            {issue.note}
            {issue.replacement ? ` · Ersättare: ${issue.replacement}` : ""}
            {issue.date ? ` · Klarar ${fmtDate(issue.date)}` : ""}
          </span>
          <small>{fmtTime(issue.at)}</small>
          {!issue.resolved ? (
            <button type="button" className="cz-link" onClick={() => void act({ action: "resolve", productId: line.productId })}>
              Markera löst
            </button>
          ) : null}
        </div>
      ) : open ? (
        flagging ? (
          <IssueForm line={line} onSave={async (b) => {
            const err = await act(b);
            if (!err) setFlagging(false);
            return err;
          }} />
        ) : (
          <button type="button" className="cz-link sp-flag-btn" onClick={() => setFlagging(true)}>
            Flagga ett problem med raden
          </button>
        )
      ) : null}
    </li>
  );
}

export function OrderDrawer({ order, onClose, act }: { order: SupplierOrder; onClose: () => void; act: (number: string, body: OrderAction) => Promise<string> }) {
  const [proofs, setProofs] = useState<Record<string, { label: string; image: string }[]>>({});
  const [tracking, setTracking] = useState("");
  const [carrier, setCarrier] = useState(order.state.carrier ?? "PostNord");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [proposing, setProposing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (order.source !== "pach") return;
    let live = true;
    fetch(`/api/supplier/orders/${order.number}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => live && setProofs(j.proofs ?? {}))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [order.number, order.source]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const run = async (body: OrderAction) => {
    setBusy(true);
    const err = await act(order.number, body);
    setBusy(false);
    setError(err);
    return err;
  };

  const current = SUPPLIER_STAGES.indexOf(order.state.stage);
  const next = SUPPLIER_STAGES[current + 1];
  const nextLabel = NEXT_ACTION[order.state.stage];
  const days = daysUntil(order.shipBy);
  const blocking = Object.values(order.state.issues).some((i) => !i.resolved && i.kind === "slut");

  return (
    <div className="drawer-wrap" role="dialog" aria-modal="true" aria-label={`Order ${order.number}`}>
      <button type="button" className="drawer-veil" aria-label="Stäng" onClick={onClose} />
      <aside className="drawer sp-drawer">
        <div className="drawer-head">
          <div>
            <h2>{order.customer}</h2>
            <p className="sp-sub">
              {order.number} · {order.units} st · {sek(order.value)} <StageBadge order={order} />
            </p>
          </div>
          <button type="button" className="drawer-x" onClick={onClose} aria-label="Stäng">
            ×
          </button>
        </div>

        <div className="drawer-block sp-dates">
          <div>
            <span>Ska skickas senast</span>
            <b className={order.late ? "is-late" : ""}>
              {fmtDate(order.shipBy)}
              {current < SUPPLIER_STAGES.indexOf("skickad") ? <small> · {days < 0 ? `${-days} dagar sen` : days === 0 ? "i dag" : `om ${days} dagar`}</small> : null}
            </b>
          </div>
          <div>
            <span>Kunden behöver</span>
            <b>{order.needBy ? fmtDate(order.needBy) : "Inget datum"}</b>
          </div>
          <div>
            <span>{order.source === "pach" ? "PACH-order" : "Exempelorder"}</span>
            <b>{order.ref}</b>
          </div>
        </div>

        {order.short || order.late || blocking ? (
          <div className="drawer-block">
            {order.short ? <p className="sp-warn">Lagret räcker inte för alla rader – flagga raden så att PACH kan föreslå en ersättare för kunden.</p> : null}
            {order.late ? <p className="sp-warn">Utskicksdatumet har passerat. Föreslå ett nytt datum så att PACH kan meddela kunden.</p> : null}
          </div>
        ) : null}

        <div className="drawer-block">
          <p className="drawer-label">Rader</p>
          <ul className="sp-lines">
            {order.lines.map((l) => (
              <LineCard key={l.productId} order={order} line={l} proofs={proofs[l.productId] ?? []} act={(b) => run(b)} />
            ))}
          </ul>
        </div>

        <div className="drawer-block">
          <p className="drawer-label">Förlopp</p>
          <ol className="track">
            {SUPPLIER_STAGES.map((s, i) => {
              const ev = [...order.state.history].reverse().find((h) => h.stage === s);
              return (
                <li key={s} className={i <= current ? "done" : i === current + 1 ? "next" : ""}>
                  <span className="track-dot" aria-hidden />
                  <div>
                    <b>{SUPPLIER_STAGE_LABEL[s]}</b>
                    {ev ? <small>{fmtTime(ev.at)} · {ev.text}</small> : i === 0 ? <small>{fmtTime(order.createdAt)}</small> : null}
                  </div>
                </li>
              );
            })}
          </ol>
          {order.state.tracking ? (
            <p className="drawer-note">
              {order.state.carrier ?? "Frakt"} · spårning <b>{order.state.tracking}</b>
            </p>
          ) : null}
          {order.state.proposedDate ? <p className="drawer-note">Ni har föreslagit utskick {fmtDate(order.state.proposedDate)}.</p> : null}
        </div>

        <div className="drawer-block">
          <p className="drawer-label">Händelser</p>
          <ul className="sp-log">
            {[...order.state.history].reverse().map((h, i) => (
              <li key={`${h.at}-${i}`}>
                <small>{fmtTime(h.at)}</small> {h.text}
              </li>
            ))}
          </ul>
        </div>

        <div className="drawer-foot sp-actions">
          {error ? <p className="brandbar-err">{error}</p> : null}
          {next ? (
            <>
              {next === "skickad" ? (
                <div className="sp-ship">
                  <select value={carrier} onChange={(e) => setCarrier(e.target.value)} aria-label="Fraktbolag">
                    {["PostNord", "DHL", "DB Schenker", "Bring", "UPS"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Spårningsnummer" />
                </div>
              ) : null}
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Kommentar till PACH (valfritt)" />
              <button
                type="button"
                className="drawer-save"
                disabled={busy || (next === "bekraftad" && blocking)}
                onClick={async () => {
                  const err = await run({ action: "advance", note: note || undefined, carrier: next === "skickad" ? carrier : undefined, tracking: tracking || undefined });
                  if (!err) {
                    setNote("");
                    setTracking("");
                  }
                }}
              >
                {busy ? "Sparar…" : nextLabel}
              </button>
            </>
          ) : (
            <p className="drawer-note">Levererad{order.state.invoice ? ` · fakturerad ${order.state.invoice.number}` : " · redo att faktureras under Avräkning"}.</p>
          )}
          <div className="sp-secondary">
            {next && current < SUPPLIER_STAGES.indexOf("skickad") ? (
              proposing ? (
                <span className="sp-propose">
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Nytt utskicksdatum" />
                  <button
                    type="button"
                    className="cz-link"
                    disabled={!date || busy}
                    onClick={async () => {
                      if (!(await run({ action: "propose", date }))) setProposing(false);
                    }}
                  >
                    Skicka förslag
                  </button>
                </span>
              ) : (
                <button type="button" className="cz-link" onClick={() => setProposing(true)}>
                  Föreslå nytt datum
                </button>
              )
            ) : null}
            {order.source === "pach" ? (
              <a className="cz-link" href={`/api/dashboard/quotes/${order.ref}/po`}>
                Ladda ner tryckfiler (ZIP)
              </a>
            ) : (
              <span className="drawer-note">Exempelorder – inga tryckfiler</span>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
