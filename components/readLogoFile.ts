"use client";

const LOGO_TYPES = /^image\/(png|jpeg|webp|svg\+xml)$/;
const MAX_LOGO_BYTES = 10_000_000;

/** Read an uploaded logo into a PNG data URL of at most 1200 px, so it stays light in the cart and the offer. */
export async function readLogoFile(file: File): Promise<string> {
  if (!LOGO_TYPES.test(file.type) && !/\.(png|jpe?g|webp|svg)$/i.test(file.name)) throw new Error("Använd en bild i PNG, JPG, WebP eller SVG.");
  if (file.size > MAX_LOGO_BYTES) throw new Error("Filen är för stor (max 10 MB).");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Kunde inte läsa bilden."));
      el.src = url;
    });
    // SVGs without a width/height report 0, and vectors should be drawn sharp – always at 1200 px.
    const w0 = img.naturalWidth || 1000;
    const h0 = img.naturalHeight || 1000;
    const vector = file.type.includes("svg") || /\.svg$/i.test(file.name);
    const scale = vector ? 1200 / Math.max(w0, h0) : Math.min(1, 1200 / Math.max(w0, h0));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w0 * scale));
    canvas.height = Math.max(1, Math.round(h0 * scale));
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
