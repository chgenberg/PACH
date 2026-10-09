"use client";

import Image from "next/image";
import { useState } from "react";
import type { PublicCampaign } from "@/lib/campaigns";

export function GiftPicker({ gift, rid, firstName, chosen }: { gift: PublicCampaign; rid: string; firstName: string; chosen: boolean }) {
  const [productId, setProductId] = useState(gift.products.length === 1 ? gift.products[0].productId : "");
  const [size, setSize] = useState("");
  const [addr, setAddr] = useState({ name: "", street: "", zip: "", city: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(chosen);
  const product = gift.products.find((p) => p.productId === productId);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/campaign/${gift.token}/gift`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rid, productId, size, address: addr }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Något gick fel.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Något gick fel.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="collect">
        <div className="offer-thanks">
          <div className="offer-thanks-mark" aria-hidden>
            🎁
          </div>
          <h1>Tack, {firstName}!</h1>
          <p className="lede">Din gåva från {gift.brand} är på väg. Vill du ändra något? Öppna länken igen och välj på nytt.</p>
          <button type="button" className="cz-link" onClick={() => setDone(false)}>
            Ändra mitt val
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="collect">
      <form
        className="collect-form gift"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <p className="kicker">{gift.brand}</p>
        <h1>Hej {firstName}, en gåva till dig</h1>
        <p className="lede">{gift.title}. Välj det du helst vill ha och var vi ska skicka det.</p>

        <div className="gift-grid">
          {gift.products.map((p) => (
            <button
              key={p.productId}
              type="button"
              className={`gift-card${productId === p.productId ? " is-on" : ""}`}
              onClick={() => {
                setProductId(p.productId);
                setSize(p.sizes.length ? "" : "One size");
              }}
            >
              <Image src={p.image} alt={p.name} width={300} height={300} unoptimized={/^(data:|\/api\/)/.test(p.image)} />
              <b>{p.name}</b>
              <small>{p.color}</small>
            </button>
          ))}
        </div>

        {product && product.sizes.length ? (
          <div className="collect-field">
            <span>Storlek</span>
            <div className="collect-sizes">
              {product.sizes.map((s) => (
                <button key={s} type="button" role="radio" aria-checked={size === s} onClick={() => setSize(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="gift-addr">
          <input value={addr.name} onChange={(e) => setAddr({ ...addr, name: e.target.value })} placeholder="Namn" autoComplete="name" />
          <input value={addr.street} onChange={(e) => setAddr({ ...addr, street: e.target.value })} placeholder="Gatuadress" autoComplete="street-address" />
          <input value={addr.zip} onChange={(e) => setAddr({ ...addr, zip: e.target.value })} placeholder="Postnummer" autoComplete="postal-code" inputMode="numeric" />
          <input value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} placeholder="Ort" autoComplete="address-level2" />
          <input value={addr.phone} onChange={(e) => setAddr({ ...addr, phone: e.target.value })} placeholder="Mobil för avisering (valfritt)" autoComplete="tel" inputMode="tel" />
        </div>

        {error ? <p className="brandbar-err">{error}</p> : null}
        <button type="submit" className="offer-submit" disabled={busy || !productId || (Boolean(product?.sizes.length) && !size)}>
          {busy ? "Skickar…" : "Skicka min gåva"}
        </button>
        <p className="drawer-note">Adressen används bara för att leverera gåvan.</p>
      </form>
    </div>
  );
}
