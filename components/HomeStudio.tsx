"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { StudioMark } from "@/components/StudioMark";
import { familyById, type Family } from "@/lib/catalog";
import { hostOk, normalizeHost } from "@/lib/host";
import type { Profile } from "@/lib/profile";
import { SHOPS } from "@/lib/shop";

type GenState = { loading?: boolean; image?: string; error?: boolean };

/** Run async tasks with limited concurrency so we stay friendly to rate limits. */
async function pool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

export function HomeStudio() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [gen, setGen] = useState<Record<string, GenState>>({});

  const brandTiles = async (host: string) => {
    const jobs = SHOPS.map((shop) => ({ slug: shop.slug as string, family: familyById(shop.hero) })).filter(
      (j) => j.family !== null,
    ) as { slug: string; family: Family }[];
    setGen(Object.fromEntries(jobs.map((j) => [j.slug, { loading: true }])));
    await pool(jobs, 3, async ({ slug, family }) => {
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: family.id, host }),
        });
        const json = await res.json();
        if (!res.ok || !json.image) throw new Error(json.error || "fail");
        setGen((prev) => ({ ...prev, [slug]: { image: json.image } }));
      } catch {
        setGen((prev) => ({ ...prev, [slug]: { error: true } }));
      }
    });
  };

  const apply = async (raw = url) => {
    const host = normalizeHost(raw);
    if (!hostOk(host)) {
      setError("Skriv en webbadress, till exempel volvo.com");
      return;
    }
    setBusy(true);
    setError("");
    setGen({});
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: host }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Kunde inte läsa adressen.");
      setProfile(json);
      void brandTiles(json.host ?? host);
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
          const state = gen[shop.slug];
          const src = state?.image ?? hero?.image;
          return (
            <Link key={shop.slug} href={`/kategori/${shop.slug}`} className={`tile tile-${shop.slug}${state?.loading ? " loading" : ""}`} style={{ background: shop.tone, color: shop.ink }}>
              {src ? <Image className="tile-photo" src={src} alt="" width={900} height={900} sizes="(max-width: 860px) 100vw, 45vw" unoptimized={Boolean(state?.image)} priority={shop.slug === "massa-event"} /> : null}
              {state?.loading ? <span className="tile-spin" aria-hidden /> : null}
              {profile && !state?.image ? (
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
