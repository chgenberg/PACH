"use client";

import { useState } from "react";
import { useOfferSettings } from "@/components/dashboard/useOfferSettings";
import type { TemplateAction } from "@/lib/offerSettings";
import { initials, LAYOUT_INFO, LAYOUTS, type OfferTemplate, type SellerProfile, SHOW_KEYS, SHOW_LABEL } from "@/lib/offerTemplates";

/** Square JPEG, small enough to travel inside the JSON and the PDF. */
function toAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const size = 256;
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const s = Math.min(im.width, im.height);
      c.getContext("2d")!.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.86));
    };
    im.onerror = () => reject(new Error("Kunde inte läsa bilden"));
    im.src = url;
  });
}

export function OfferSettingsCards() {
  const { data, error, post } = useOfferSettings();
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const draft = seller ?? data?.seller ?? null;
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [edit, setEdit] = useState<OfferTemplate | null>(null);
  const [tmsg, setTmsg] = useState("");

  const set = (v: Partial<SellerProfile>) => draft && setSeller({ ...draft, ...v });

  const act = async (template: TemplateAction, done: string) => {
    setTmsg("");
    try {
      const j = await post({ template });
      setTmsg(done);
      return j;
    } catch (err) {
      setTmsg(err instanceof Error ? err.message : "Kunde inte spara.");
      return null;
    }
  };

  return (
    <>
      <section className="card" id="profil">
        <h2>Din profil på offerterna</h2>
        <p className="drawer-note">Visas som kontaktperson i offertlänken och på pdf:en när mallen har Kontaktperson påslaget.</p>
        {draft ? (
          <div className="os-seller">
            <div className="os-photo">
              <span className="share-avatar">
                {/* eslint-disable-next-line @next/next/no-img-element -- uploaded profile photo (data URL) */}
                {draft.photo ? <img src={draft.photo} alt="Profilbild" /> : initials(draft.name)}
              </span>
              <label className="file-btn">
                {draft.photo ? "Byt bild" : "Ladda upp bild"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void toAvatar(f).then((photo) => set({ photo }), () => setMsg("Kunde inte läsa bilden."));
                  }}
                />
              </label>
              {draft.photo ? (
                <button type="button" className="offer-remove" onClick={() => set({ photo: undefined })}>
                  Ta bort bild
                </button>
              ) : null}
            </div>
            <div className="fields">
              <label>
                Namn
                <input value={draft.name} onChange={(e) => set({ name: e.target.value })} />
              </label>
              <label>
                Titel
                <input value={draft.title} onChange={(e) => set({ title: e.target.value })} />
              </label>
              <label>
                E-post
                <input type="email" value={draft.email} onChange={(e) => set({ email: e.target.value })} />
              </label>
              <label>
                Telefon
                <input value={draft.phone} onChange={(e) => set({ phone: e.target.value })} />
              </label>
            </div>
          </div>
        ) : (
          <p className="drawer-note">{error || "Hämtar…"}</p>
        )}
        <div className="os-foot">
          {msg ? <span className="drawer-note">{msg}</span> : <span />}
          <button
            type="button"
            className="dash-btn"
            disabled={!seller}
            onClick={() => {
              if (!seller) return;
              void post({ seller })
                .then(() => {
                  setSeller(null);
                  setMsg("Profilen är sparad.");
                })
                .catch((err: Error) => setMsg(err.message));
            }}
          >
            Spara profil
          </button>
        </div>
      </section>

      <section className="card" id="mallar">
        <h2>Offertmallar</h2>
        <p className="drawer-note">Mallen styr både offertlänken och pdf:en. När du skickar en offert kan du ändra kryssrutorna för just det utskicket.</p>
        <ul className="os-templates">
          {(data?.templates ?? []).map((t) => {
            const isOpen = open === t.id;
            const e = isOpen && edit ? edit : t;
            return (
              <li key={t.id} className={isOpen ? "is-open" : ""}>
                <div className="os-row">
                  <span className={`sd-thumb is-${t.layout}`} aria-hidden>
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                  <span>
                    <b>{t.name}</b>
                    <small>
                      {LAYOUT_INFO[t.layout].label}
                      {t.builtin ? " · grundmall" : " · egen mall"} · visar {SHOW_KEYS.filter((k) => t.show[k]).length} av {SHOW_KEYS.length} delar
                    </small>
                  </span>
                  <button
                    type="button"
                    className="dash-btn ghost"
                    onClick={() => {
                      setOpen(isOpen ? null : t.id);
                      setEdit(isOpen ? null : t);
                      setTmsg("");
                    }}
                  >
                    {isOpen ? "Stäng" : "Redigera"}
                  </button>
                  <button
                    type="button"
                    className="dash-btn ghost"
                    onClick={() =>
                      void act({ action: "copy", id: t.id }, "Kopian är skapad.").then((j) => {
                        const copy = j?.templates?.find((x) => x.id === j.id);
                        if (copy) {
                          setOpen(copy.id);
                          setEdit(copy);
                        }
                      })
                    }
                  >
                    Kopiera
                  </button>
                </div>
                {isOpen && edit ? (
                  <div className="os-edit">
                    <div className="fields">
                      <label>
                        Namn
                        <input value={e.name} onChange={(ev) => setEdit({ ...e, name: ev.target.value })} />
                      </label>
                      <label>
                        Upplägg
                        <select value={e.layout} onChange={(ev) => setEdit({ ...e, layout: ev.target.value as OfferTemplate["layout"] })}>
                          {LAYOUTS.map((l) => (
                            <option key={l} value={l}>
                              {LAYOUT_INFO[l].label} – {LAYOUT_INFO[l].blurb}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="wide">
                        Hälsning överst i offerten
                        <textarea rows={3} value={e.intro} onChange={(ev) => setEdit({ ...e, intro: ev.target.value })} />
                      </label>
                    </div>
                    <div className="sd-toggles">
                      {SHOW_KEYS.map((k) => {
                        const off = k === "unitPrices" && !e.show.prices;
                        return (
                          <label key={k} className={`toggle sd-toggle${off ? " is-locked" : ""}`}>
                            <input
                              type="checkbox"
                              checked={e.show[k] && !off}
                              disabled={off}
                              onChange={() => setEdit({ ...e, show: { ...e.show, [k]: !e.show[k], ...(k === "prices" && e.show.prices ? { unitPrices: false } : {}) } })}
                            />
                            <span />
                            <div>
                              {SHOW_LABEL[k].label}
                              <small>{SHOW_LABEL[k].hint}</small>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    <div className="os-foot">
                      {tmsg ? <span className="drawer-note">{tmsg}</span> : <span />}
                      {t.builtin ? (
                        <button type="button" className="dash-btn ghost" onClick={() => void act({ action: "reset", id: t.id }, "Mallen är återställd.").then((j) => j?.templates && setEdit(j.templates.find((x) => x.id === t.id) ?? null))}>
                          Återställ
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="dash-btn ghost"
                          onClick={() =>
                            void act({ action: "delete", id: t.id }, "Mallen är borttagen.").then((j) => {
                              if (j) {
                                setOpen(null);
                                setEdit(null);
                              }
                            })
                          }
                        >
                          Ta bort
                        </button>
                      )}
                      <button type="button" className="dash-btn" onClick={() => void act({ action: "save", template: e }, "Mallen är sparad.")}>
                        Spara mall
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
