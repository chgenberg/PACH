"use client";

import Image from "next/image";
import { useState } from "react";
import type { PublicCollect } from "@/lib/collect";

export function CollectForm({ token, data }: { token: string; data: PublicCollect }) {
  const [name, setName] = useState("");
  const [print, setPrint] = useState("");
  const [printTouched, setPrintTouched] = useState(false);
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const who = data.brand || data.company;

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/collect/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, sizes, print: data.namePrint ? print : undefined }),
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

  return (
    <div className="collect">
      <header className="collect-head">
        <span className="collect-mark">PACH</span>
      </header>
      {done ? (
        <div className="offer-thanks">
          <div className="offer-thanks-mark" aria-hidden>
            ✓
          </div>
          <h1>Tack, {name.split(" ")[0]}!</h1>
          <p className="lede">Din storlek är sparad. Har du valt fel? Fyll i igen med samma namn så ersätts svaret.</p>
        </div>
      ) : data.closed ? (
        <div className="offer-thanks">
          <h1>Insamlingen är stängd</h1>
          <p className="lede">Kontakta den som skickade länken om du behöver ändra något.</p>
        </div>
      ) : (
        <form
          className="collect-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <p className="kicker">{who}</p>
          <h1>Välj din storlek</h1>
          <p className="lede">Det tar tio sekunder. Vi beställer exakt det som behövs – inga gissningar, inga överblivna kartonger.</p>

          <label className="collect-field">
            <span>Ditt namn</span>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!printTouched) setPrint(e.target.value.split(" ")[0] ?? "");
              }}
              placeholder="Förnamn Efternamn"
              autoComplete="name"
              required
            />
          </label>

          {data.products.map((p) => (
            <div key={p.productId} className="collect-product">
              <Image src={p.image} alt={p.name} width={120} height={120} unoptimized={/^(data:|\/api\/)/.test(p.image)} />
              <div>
                <b>{p.name}</b>
                <div className="collect-sizes" role="radiogroup" aria-label={`Storlek ${p.name}`}>
                  {p.sizes.map((s) => (
                    <button key={s} type="button" role="radio" aria-checked={sizes[p.productId] === s} onClick={() => setSizes((x) => ({ ...x, [p.productId]: s }))}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {data.namePrint ? (
            <label className="collect-field">
              <span>Namn på plagget</span>
              <input
                value={print}
                onChange={(e) => {
                  setPrint(e.target.value);
                  setPrintTouched(true);
                }}
                placeholder="Det som trycks, t.ex. ditt förnamn"
                maxLength={30}
              />
            </label>
          ) : null}

          {error ? <p className="brandbar-err">{error}</p> : null}
          <button type="submit" className="offer-submit" disabled={busy || !name.trim() || !Object.keys(sizes).length}>
            {busy ? "Sparar…" : "Spara min storlek"}
          </button>
          <p className="drawer-note">{data.answers} kollegor har redan svarat.</p>
        </form>
      )}
    </div>
  );
}
