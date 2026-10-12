"use client";

import { useState } from "react";
import { readLogoFile } from "@/components/readLogoFile";
import { fmtTime, useCatalog } from "@/components/supplier/useSupplier";

export default function ContentPage() {
  const { items, error, upload } = useCatalog();
  const [brand, setBrand] = useState("alla");
  const [onlyGaps, setOnlyGaps] = useState(false);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");

  const list = items ?? [];
  const brands = [...new Set(list.map((i) => i.brand))].sort();
  const scored = list.map((i) => ({ ...i, score: Math.round((i.content.checks.filter((c) => c.ok).length / i.content.checks.length) * 100) }));
  const shown = scored.filter((i) => (brand === "alla" || i.brand === brand) && (!onlyGaps || i.score < 100)).sort((a, b) => a.score - b.score);
  const avg = scored.length ? Math.round(scored.reduce((s, i) => s + i.score, 0) / scored.length) : 0;
  const missingModels = scored.filter((i) => !i.content.checks.find((c) => c.key === "model")?.ok).length;

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1>Innehåll</h1>
          <p>Bilder, 3D-modeller och texter som PACH visar på sajten. Kompletta produkter syns bättre och blir oftare beställda.</p>
        </div>
      </div>

      <div className="kpis">
        <div>
          <span>Komplett innehåll</span>
          <strong>{avg} %</strong>
        </div>
        <div>
          <span>Produkter</span>
          <strong>{list.length}</strong>
        </div>
        <div>
          <span>Med 3D-modell</span>
          <strong>{list.length - missingModels}</strong>
        </div>
        <div>
          <span>Saknar något</span>
          <strong>{scored.filter((i) => i.score < 100).length}</strong>
        </div>
      </div>

      <div className="sp-toolbar">
        <div className="seg">
          {["alla", ...brands].map((b) => (
            <button key={b} type="button" aria-pressed={brand === b} onClick={() => setBrand(b)}>
              {b === "alla" ? "Alla" : b}
            </button>
          ))}
        </div>
        <label className="sp-check">
          <input type="checkbox" checked={onlyGaps} onChange={(e) => setOnlyGaps(e.target.checked)} /> Bara det som saknar något
        </label>
      </div>

      {error || note ? <p className="brandbar-err">{error || note}</p> : null}

      <div className="sp-content">
        {shown.map((i) => (
          <article key={i.productId} className="card sp-content-card">
            <div className="sp-content-head">
              {/* eslint-disable-next-line @next/next/no-img-element -- catalogue image */}
              <img src={i.image} alt="" />
              <span>
                <b>{i.name}</b>
                <small>
                  {i.brand} · {i.category}
                </small>
              </span>
              <strong className={i.score === 100 ? "is-ok" : ""}>{i.score} %</strong>
            </div>
            <span className="sp-meter" aria-hidden>
              <i style={{ width: `${i.score}%` }} />
            </span>
            <ul className="sp-checks">
              {i.content.checks.map((c) => (
                <li key={c.key} className={c.ok ? "is-ok" : ""}>
                  {c.ok ? "✓" : "–"} {c.label}
                </li>
              ))}
            </ul>
            {i.content.uploads.length ? (
              <div className="sp-uploads">
                {i.content.uploads.slice(0, 4).map((u) => (
                  // eslint-disable-next-line @next/next/no-img-element -- uploaded content
                  <img key={u.at} src={u.image} alt="Uppladdad bild" title={`${fmtTime(u.at)} · granskas av PACH`} />
                ))}
                <small>Granskas av PACH</small>
              </div>
            ) : null}
            <label className="file-btn">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={busy === i.productId}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  setBusy(i.productId);
                  setNote("");
                  try {
                    await upload(i.productId, await readLogoFile(f), "Miljöbild");
                  } catch (err) {
                    setNote(err instanceof Error ? err.message : "Kunde inte ladda upp.");
                  } finally {
                    setBusy("");
                  }
                }}
              />
              {busy === i.productId ? "Laddar upp…" : "+ Ladda upp miljöbild"}
            </label>
          </article>
        ))}
      </div>
    </div>
  );
}
