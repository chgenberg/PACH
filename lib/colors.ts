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

/** A Swedish name for any colour: the swatch name when it is one, otherwise the nearest everyday colour word. */
export function colorName(hex: string) {
  const known = SWATCHES.find((s) => s.hex.toLowerCase() === hex.toLowerCase());
  if (known) return known.name;
  if (!isHex(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  if (s < 0.15) return l < 0.15 ? "Svart" : l > 0.9 ? "Vit" : l < 0.4 ? "Mörkgrå" : "Grå";
  const d = max - min;
  const h = (max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  const word = h < 15 || h >= 345 ? "röd" : h < 40 ? "orange" : h < 65 ? "gul" : h < 165 ? "grön" : h < 195 ? "turkos" : h < 255 ? "blå" : h < 290 ? "lila" : "rosa";
  const prefix = l < 0.3 ? "mörk" : l > 0.72 ? "ljus" : "";
  const name = prefix + word;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

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
