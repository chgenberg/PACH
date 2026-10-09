import { colorsOf, type LogoDesign } from "@/lib/marking";

const loaded = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(src: string) {
  let p = loaded.get(src);
  if (!p) {
    p = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
    loaded.set(src, p);
  }
  return p;
}

/** "DIN LOGO" placeholder when the customer has not given us a logo yet. */
export function placeholderLogo() {
  const c = document.createElement("canvas");
  c.width = 800;
  c.height = 300;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#111";
  ctx.font = "800 150px Nunito, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("DIN LOGO", 400, 160);
  return c;
}

const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};

export const isDark = (hex: string) => luminance(hex) < 0.5;

/** Keep the N most common colours of the logo and snap every pixel to the nearest one. */
function reduceColors(data: Uint8ClampedArray, n: number, ink: [number, number, number]) {
  if (n <= 1) {
    for (let i = 0; i < data.length; i += 4) [data[i], data[i + 1], data[i + 2]] = ink;
    return;
  }
  const counts = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const key = ((data[i] >> 5) << 6) | ((data[i + 1] >> 5) << 3) | (data[i + 2] >> 5);
    const c = counts.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    c.n++;
    c.r += data[i];
    c.g += data[i + 1];
    c.b += data[i + 2];
    counts.set(key, c);
  }
  const palette = [...counts.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, n)
    .map((c) => [c.r / c.n, c.g / c.n, c.b / c.n]);
  if (!palette.length) return;
  for (let i = 0; i < data.length; i += 4) {
    let best = palette[0];
    let dist = Infinity;
    for (const p of palette) {
      const d = (data[i] - p[0]) ** 2 + (data[i + 1] - p[1]) ** 2 + (data[i + 2] - p[2]) ** 2;
      if (d < dist) {
        dist = d;
        best = p;
      }
    }
    data[i] = best[0];
    data[i + 1] = best[1];
    data[i + 2] = best[2];
  }
}

/** Fully white logo backgrounds (common in favicons) become transparent so the mark sits on the product. */
function dropWhiteBackground(data: Uint8ClampedArray) {
  let white = 0;
  let total = 0;
  let clear = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 10) {
      clear++;
      continue;
    }
    total++;
    if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) white++;
  }
  // A logo that already has transparency is a white logo, not a white background.
  if (!total || clear / (data.length / 4) > 0.05 || white / total < 0.35) return;
  for (let i = 0; i < data.length; i += 4) if (data[i] > 236 && data[i + 1] > 236 && data[i + 2] > 236) data[i + 3] = 0;
}

export type LogoArt = { canvas: HTMLCanvasElement; aspect: number };

/** Render the print artwork for a design: shape badge + method look on a transparent canvas. */
export async function buildLogoArt(src: string | null, d: Pick<LogoDesign, "method" | "colors" | "shape">, productColor: string): Promise<LogoArt> {
  const logo = src ? await loadImage(src).catch(() => null) : null;
  const source: CanvasImageSource = logo ?? placeholderLogo();
  const sw = logo ? logo.naturalWidth : 800;
  const sh = logo ? logo.naturalHeight : 300;
  const darkProduct = isDark(productColor);

  // 1. The logo itself, cleaned and reduced to the method's colours.
  const mark = document.createElement("canvas");
  const scale = 900 / Math.max(sw, sh);
  mark.width = Math.max(1, Math.round(sw * scale));
  mark.height = Math.max(1, Math.round(sh * scale));
  const mctx = mark.getContext("2d", { willReadFrequently: true })!;
  mctx.drawImage(source, 0, 0, mark.width, mark.height);
  const img = mctx.getImageData(0, 0, mark.width, mark.height);
  dropWhiteBackground(img.data);
  const badge = d.shape !== "original";
  const ink: [number, number, number] = badge ? (darkProduct ? [17, 17, 17] : [255, 255, 255]) : darkProduct ? [255, 255, 255] : [17, 17, 17];
  if (d.method === "gravyr") {
    // Engraving reveals the material: a single tone, lighter on dark goods and darker on light goods.
    const tone: [number, number, number] = darkProduct ? [186, 186, 182] : [92, 92, 90];
    for (let i = 0; i < img.data.length; i += 4) {
      [img.data[i], img.data[i + 1], img.data[i + 2]] = tone;
      img.data[i + 3] = img.data[i + 3] * 0.9;
    }
  } else if (d.method !== "digitaltryck") {
    reduceColors(img.data, colorsOf(d), ink);
  }
  mctx.putImageData(img, 0, 0);

  // 2. Compose onto the chosen shape.
  const out = document.createElement("canvas");
  const rect = d.shape === "rektangel";
  out.width = 1024;
  out.height = d.shape === "original" ? Math.round((1024 * mark.height) / mark.width) : rect ? 512 : 1024;
  const ctx = out.getContext("2d")!;
  if (badge && d.method !== "gravyr") {
    ctx.fillStyle = darkProduct ? "#f4f3ef" : "#111111";
    ctx.beginPath();
    if (d.shape === "rund") ctx.arc(512, 512, 500, 0, Math.PI * 2);
    else ctx.roundRect(8, 8, out.width - 16, out.height - 16, d.shape === "kvadrat" ? 120 : 90);
    ctx.fill();
  } else if (badge) {
    ctx.strokeStyle = darkProduct ? "rgba(186,186,182,.9)" : "rgba(92,92,90,.9)";
    ctx.lineWidth = 22;
    ctx.beginPath();
    if (d.shape === "rund") ctx.arc(512, 512, 488, 0, Math.PI * 2);
    else ctx.roundRect(20, 20, out.width - 40, out.height - 40, 100);
    ctx.stroke();
  }
  const pad = badge ? (d.shape === "rund" ? 0.62 : 0.72) : 1;
  const fit = Math.min((out.width * pad) / mark.width, (out.height * pad) / mark.height);
  const w = mark.width * fit;
  const h = mark.height * fit;
  ctx.drawImage(mark, (out.width - w) / 2, (out.height - h) / 2, w, h);

  // 3. Embroidery gets a thread texture.
  if (d.method === "brodyr") {
    ctx.globalCompositeOperation = "source-atop";
    ctx.strokeStyle = "rgba(0,0,0,.16)";
    ctx.lineWidth = 3;
    for (let x = -out.height; x < out.width; x += 9) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + out.height, out.height);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255,255,255,.08)";
    for (let x = -out.height + 4; x < out.width; x += 9) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + out.height, out.height);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }
  return { canvas: out, aspect: out.width / out.height };
}
