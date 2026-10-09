export type Swatch = { hex: string; name: string };

/** The catalogue photos show the products in black, so black needs no recolouring. */
export const BASE_COLOR = "#111111";

export const SWATCHES: Swatch[] = [
  { hex: BASE_COLOR, name: "Svart" },
  { hex: "#14243B", name: "Marinblå" },
  { hex: "#F4F3EF", name: "Vit" },
  { hex: "#9A9CA1", name: "Grå" },
  { hex: "#C8B08C", name: "Sand" },
  { hex: "#2F5D46", name: "Skogsgrön" },
];

export const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);

export const colorName = (hex: string) => SWATCHES.find((s) => s.hex.toLowerCase() === hex.toLowerCase())?.name ?? hex.toUpperCase();

/** Only a clearly coloured brand colour is worth suggesting. */
export function brandAccent(hex: string | undefined) {
  if (!isHex(hex)) return null;
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const max = Math.max(r, g, b);
  const sat = max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
  return sat >= 0.25 && max > 60 ? hex.toUpperCase() : null;
}

/** Six suggestions: the brand colour first when there is one. */
export function suggestions(brandColor?: string): Swatch[] {
  const accent = brandAccent(brandColor);
  return accent ? [{ hex: accent, name: "Er färg" }, ...SWATCHES.slice(0, 5)] : SWATCHES;
}
