"use client";

import { useEffect, useState } from "react";

type Kind = "product" | "scene";

const jobs = new Map<string, Promise<string | null>>();
const known = new Map<string, string>();

function fetchBranded(kind: Kind, id: string, host: string, cachedOnly: boolean) {
  const base = `${kind}|${host}|${id}`;
  const done = known.get(base);
  if (done) return Promise.resolve(done);
  const key = `${base}|${cachedOnly ? "c" : "g"}`;
  const running = jobs.get(key);
  if (running) return running;
  const job = fetch(kind === "product" ? "/api/generate" : "/api/scene", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(kind === "product" ? { productId: id, host, cachedOnly } : { event: id, host, cachedOnly }),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      const img = typeof j?.image === "string" ? (j.image as string) : null;
      if (img) known.set(base, img);
      else jobs.delete(key);
      return img;
    })
    .catch(() => {
      jobs.delete(key);
      return null;
    });
  jobs.set(key, job);
  return job;
}

function useBranded(kind: Kind, id: string, host: string, fallback: string, generate: boolean) {
  const base = `${kind}|${host}|${id}`;
  const [found, setFound] = useState<{ base: string; image: string } | null>(null);

  useEffect(() => {
    if (!host || !id) return;
    let live = true;
    const want = `${kind}|${host}|${id}`;
    void fetchBranded(kind, id, host, !generate).then((img) => live && img && setFound({ base: want, image: img }));
    return () => {
      live = false;
    };
  }, [kind, id, host, generate]);

  if (!host) return fallback;
  return found?.base === base ? found.image : (known.get(base) ?? fallback);
}

/**
 * The product photo with the customer's logo, once they have entered their website.
 * Lists only use photos that already exist; a single product page may ask for a new one.
 */
export const useBrandedImage = (productId: string, host: string, fallback: string, opts: { generate?: boolean } = {}) =>
  useBranded("product", productId, host, fallback, Boolean(opts.generate));

/** An event scene with the customer's logo, if it has been made already. */
export const useBrandedScene = (event: string, host: string, fallback: string) => useBranded("scene", event, host, fallback, false);
