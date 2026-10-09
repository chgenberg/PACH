"use client";

import { useEffect, useState } from "react";
import { readLogoFile } from "@/components/readLogoFile";

export type ConfirmedBrand = { host: string; name: string; color: string };

type Brand = { host: string; name: string; color: string; palette: string[]; tagline: string; note: string; industry: string; logo: string };

/**
 * Step between address/brand book and the images: shows what the agents found – logo, name, colours
 * and tagline – so a wrong logo or colour is fixed before anything is generated.
 */
export function BrandConfirm({ host, onDone, onClose }: { host: string; onDone: (b: ConfirmedBrand) => void; onClose: () => void }) {
  const [brand, setBrand] = useState<Brand | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [color, setColor] = useState("#111111");
  const [tagline, setTagline] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);

  useEffect(() => {
    let live = true;
    fetch(`/api/brand?host=${encodeURIComponent(host)}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "Kunde inte läsa varumärket.");
        return json as Brand;
      })
      .then((b) => {
        if (!live) return;
        setBrand(b);
        setName(b.name);
        setColor(b.color || "#111111");
        setTagline(b.tagline);
      })
      .catch((err) => live && setError(err instanceof Error ? err.message : "Kunde inte läsa varumärket."));
    return () => {
      live = false;
    };
  }, [host]);

  useEffect(() => {
    if (brand || error) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [brand, error]);

  const dirty = brand && (name !== brand.name || color.toUpperCase() !== (brand.color || "").toUpperCase() || tagline !== brand.tagline || logo);

  const confirm = async () => {
    if (!brand) return;
    if (!dirty) return onDone({ host, name: brand.name, color: brand.color });
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/brand", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ host, name, color, tagline, logo: logo ?? undefined }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Kunde inte spara.");
      onDone({ host, name: json.name, color: json.color });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte spara.");
    } finally {
      setSaving(false);
    }
  };

  const elapsed = (now - start) / 1000;
  const progress = 0.95 * (1 - Math.exp(-elapsed / 14));
  const swatches = [...new Set([brand?.color, ...(brand?.palette ?? [])].filter((c): c is string => Boolean(c)).map((c) => c.toUpperCase()))].slice(0, 6);

  return (
    <div className="picker-veil" onClick={onClose}>
      <div className="picker bc" role="dialog" aria-modal="true" aria-labelledby="bc-title" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="picker-close" onClick={onClose} aria-label="Stäng">
          ×
        </button>
        {!brand ? (
          <div className="bc-loading">
            <span className="loader-spin" aria-hidden />
            <h2 id="bc-title">Agenten läser ert varumärke…</h2>
            <p className="lede">Vi hittar och granskar loggan, färgerna och sloganen så att allt blir rätt från början.</p>
            {error ? (
              <p className="brandbar-err">{error}</p>
            ) : (
              <div className="loader-bar">
                <div style={{ width: `${(progress * 100).toFixed(1)}%` }} />
              </div>
            )}
          </div>
        ) : (
          <>
            <p className="kicker">Steg 2 av 4</p>
            <h2 id="bc-title">Stämmer det här?</h2>
            <p className="lede">Så här tolkade vi ert varumärke. Rätta det som inte stämmer – allt vi skapar utgår från det här.</p>
            {brand.note ? <p className="bc-note">{brand.note}</p> : null}
            <div className="bc-grid">
              <div>
                <p className="drawer-label">Logga</p>
                <div className="bc-logos">
                  {/* eslint-disable-next-line @next/next/no-img-element -- same-origin logo endpoint or uploaded data URL */}
                  <span className="bc-tile light"><img src={logo ?? brand.logo} alt={`${name} logga på ljus bakgrund`} /></span>
                  {/* eslint-disable-next-line @next/next/no-img-element -- same-origin logo endpoint or uploaded data URL */}
                  <span className="bc-tile dark"><img src={logo ?? `${brand.logo}&variant=dark`} alt={`${name} logga på mörk bakgrund`} /></span>
                </div>
                <label className="file-btn">
                  {logo ? "Byt till en annan fil" : "Fel logga? Ladda upp rätt"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      try {
                        setLogo(await readLogoFile(f));
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Kunde inte läsa filen.");
                      }
                    }}
                  />
                </label>
              </div>
              <div className="bc-fields">
                <label>
                  Varumärke
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
                </label>
                <div>
                  <p className="drawer-label">Huvudfärg</p>
                  <div className="swatches">
                    {swatches.map((c) => (
                      <button key={c} type="button" className="swatch" title={c} aria-label={`Använd ${c}`} aria-pressed={color.toUpperCase() === c} style={{ background: c }} onClick={() => setColor(c)} />
                    ))}
                    <label className="swatch swatch-custom" title="Välj egen färg" style={swatches.includes(color.toUpperCase()) ? undefined : { background: color }}>
                      <input type="color" value={color.toLowerCase()} onChange={(e) => setColor(e.target.value.toUpperCase())} aria-label="Välj egen färg" />
                    </label>
                    <code className="bc-hex">{color.toUpperCase()}</code>
                  </div>
                </div>
                <label>
                  Slogan på väggen <small>(valfritt)</small>
                  <input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={36} placeholder="T.ex. ert claim" />
                </label>
                {brand.industry ? <p className="drawer-note">Bransch enligt agenten: {brand.industry}</p> : null}
              </div>
            </div>
            {error ? <p className="brandbar-err">{error}</p> : null}
            <div className="bc-foot">
              <button type="button" className="drawer-save" onClick={() => void confirm()} disabled={saving}>
                {saving ? "Sparar…" : dirty ? "Spara och välj tillfälle" : "Ser bra ut – välj tillfälle"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
