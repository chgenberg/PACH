"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { StudioMark } from "@/components/StudioMark";
import { familyById } from "@/lib/catalog";
import { hostOk, normalizeHost } from "@/lib/host";
import type { Profile } from "@/lib/profile";
import { SHOPS } from "@/lib/shop";

export function HomeStudio() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);

  const apply = async (raw = url) => {
    const host = normalizeHost(raw);
    if (!hostOk(host)) {
      setError("Skriv en webbadress, till exempel volvo.com");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: host }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Kunde inte läsa adressen.");
      setProfile(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte läsa adressen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`shop${profile ? " branded" : ""}${busy ? " busy" : ""}`}>
      <header className="shop-bar">
        <Link href="/" className="shop-logo" aria-label="PACH">
          <Image src="/PACH_logo.png" alt="PACH profile" width={2198} height={1069} priority />
        </Link>
        <form
          className="shop-url"
          onSubmit={(event) => {
            event.preventDefault();
            void apply();
          }}
        >
          <label className="sr-only" htmlFor="site">
            Webbadress
          </label>
          <input
            id="site"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setError("");
            }}
            placeholder={profile ? profile.host : "företag.se"}
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <button type="submit" disabled={busy}>
            {busy ? "Läser…" : profile ? "Byt" : "Visa"}
          </button>
        </form>
      </header>

      {error ? (
        <p className="shop-err" role="alert">
          {error}
        </p>
      ) : (
        <p className="shop-lead">
          {profile
            ? `${profile.name} på produkterna. Välj en kategori.`
            : "Skriv webbadressen så hamnar logotypen på bilderna."}
        </p>
      )}

      <div className="mosaic">
        {SHOPS.map((shop) => {
          const hero = familyById(shop.hero);
          return (
            <Link key={shop.slug} href={`/kategori/${shop.slug}`} className={`tile tile-${shop.slug}`} style={{ background: shop.tone, color: shop.ink }}>
              {hero ? <Image className="tile-photo" src={hero.image} alt="" width={900} height={900} sizes="(max-width: 860px) 100vw, 45vw" priority={shop.slug === "massa-event"} /> : null}
              {profile ? (
                <span className="tile-mark">
                  <StudioMark profile={profile} />
                </span>
              ) : null}
              <span className="tile-name">{shop.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
