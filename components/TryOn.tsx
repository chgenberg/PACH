"use client";

import { useState } from "react";

/** Downscale a photo in the browser so the upload stays small; EXIF rotation is applied by the browser. */
async function readPhoto(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp|heic|heif)$/.test(file.type) && !/\.(png|jpe?g|webp)$/i.test(file.name)) throw new Error("Använd ett foto i JPG eller PNG.");
  if (file.size > 25_000_000) throw new Error("Fotot är för stort (max 25 MB).");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.9);
}

export function TryOn({ productId, host, image, color }: { productId: string; host: string; image?: string; color: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState("");

  const run = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const photo = await readPhoto(file);
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, host, photo, image, color }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Kunde inte skapa bilden.");
      setResult(j.image);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte skapa bilden.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="drawer-block tryon">
      <p className="drawer-label">Prova på teamet</p>
      {result ? (
        <a href={result} target="_blank" rel="noreferrer" className="tryon-result">
          {/* eslint-disable-next-line @next/next/no-img-element -- generated image */}
          <img src={result} alt="Teamet i plagget med er logga" />
        </a>
      ) : null}
      <label className={`tryon-drop${busy ? " is-busy" : ""}`}>
        <input type="file" accept="image/*" disabled={busy} onChange={(e) => void run(e.target.files?.[0]).finally(() => (e.target.value = ""))} />
        {busy ? (
          <>
            <span className="loader-spin" aria-hidden /> Klär teamet i plagget… (ca 1 min)
          </>
        ) : result ? (
          "Prova ett annat foto"
        ) : (
          "Ladda upp ett teamfoto – se alla i plagget med er logga"
        )}
      </label>
      {error ? <p className="brandbar-err">{error}</p> : null}
      <p className="drawer-note">Använd bara foton där alla på bilden har sagt ja. Fotot sparas inte – bara den färdiga bilden.</p>
    </div>
  );
}
