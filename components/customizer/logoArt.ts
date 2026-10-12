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

type RGB = [number, number, number];
const rgbOf = (hex: string): RGB => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** WCAG contrast ratio, 1 (same) to 21 (black on white). */
export function contrastRatio(a: RGB, b: RGB) {
  const lum = (c: RGB) => {
    const [r, g, bl] = c.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The colour covering most of the printed artwork – what the eye sees against the product. */
export function dominantInk(art: LogoArt): RGB | null {
  const ctx = art.canvas.getContext("2d");
  if (!ctx) return null;
  const { width, height } = art.canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  const stride = Math.max(4, Math.floor((width * height) / 6000)) * 4;
  for (let i = 0; i < data.length; i += stride) {
    if (data[i + 3] < 160) continue;
    const key = ((data[i] >> 5) << 6) | ((data[i + 1] >> 5) << 3) | (data[i + 2] >> 5);
    const b = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    b.n += 1;
    b.r += data[i];
    b.g += data[i + 1];
    b.b += data[i + 2];
    buckets.set(key, b);
  }
  const top = [...buckets.values()].sort((x, y) => y.n - x.n)[0];
  return top ? [top.r / top.n, top.g / top.n, top.b / top.n] : null;
}

/** How well the artwork stands out on a product colour. */
export const inkContrast = (art: LogoArt, productHex: string) => {
  const ink = dominantInk(art);
  return ink ? contrastRatio(ink, rgbOf(productHex)) : 21;
};

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

/** Name print preview: the first name in bold capitals, in a colour that reads on the product. */
export function buildNameArt(name: string, productColor: string): LogoArt {
  const text = (name.trim() || "NAMN").toUpperCase().slice(0, 30);
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  const font = "800 180px Nunito, Arial, sans-serif";
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 40;
  c.width = Math.max(200, w);
  c.height = 230;
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = isDark(productColor) ? "#ffffff" : "#111111";
  ctx.fillText(text, c.width / 2, c.height / 2 + 8);
  return { canvas: c, aspect: c.width / c.height };
}
