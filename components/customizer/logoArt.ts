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
  const src = art.flat ?? art.canvas;
  const ctx = src.getContext("2d");
  if (!ctx) return null;
  const { width, height } = src;
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

/**
 * Colour artwork plus a height map, so each method has its own relief and texture on the 3D product.
 * `flat` is the artwork before stitches, shadows and sheen – what the ink colour is judged on.
 */
export type LogoArt = { canvas: HTMLCanvasElement; aspect: number; bump?: HTMLCanvasElement; flat?: HTMLCanvasElement };

const canvasOf = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

/** Darkens the artwork towards its own edges – a bevel for raised thread, a shadow for engraving. */
function innerShade(ctx: CanvasRenderingContext2D, mask: HTMLCanvasElement, blur: number, color: string, dx = 0, dy = 0) {
  const { width, height } = mask;
  const t = canvasOf(width, height);
  const tc = t.getContext("2d")!;
  tc.fillStyle = color;
  tc.fillRect(0, 0, width, height);
  tc.globalCompositeOperation = "destination-out";
  tc.filter = `blur(${blur}px)`;
  tc.drawImage(mask, dx, dy);
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.drawImage(t, 0, 0);
  ctx.restore();
}

/** A plain-weave pattern – the fabric showing through ink. */
function weave(size = 8) {
  const p = canvasOf(size * 2, size * 2);
  const c = p.getContext("2d")!;
  const cell = (x: number, y: number, horizontal: boolean) => {
    const g = horizontal ? c.createLinearGradient(x, y, x, y + size) : c.createLinearGradient(x, y, x + size, y);
    g.addColorStop(0, "rgba(0,0,0,.6)");
    g.addColorStop(0.5, "rgba(255,255,255,.45)");
    g.addColorStop(1, "rgba(0,0,0,.6)");
    c.fillStyle = g;
    c.fillRect(x, y, size, size);
  };
  cell(0, 0, true);
  cell(size, size, true);
  cell(size, 0, false);
  cell(0, size, false);
  return p;
}

/**
 * Embroidery fill: rows of short stitches at 45°, staggered like tatami, each thread lit on one side and
 * shaded on the other. Coarse enough to survive mipmapping when the print is small on screen.
 */
function stitches(ctx: CanvasRenderingContext2D, w: number, h: number, light: string, dark: string, row = 20) {
  const len = row * 3.2;
  ctx.save();
  ctx.lineCap = "butt";
  for (let x = -h, i = 0; x < w; x += row, i++) {
    const offset = (i % 3) * (len / 3);
    ctx.setLineDash([len, row * 0.22]);
    ctx.lineDashOffset = offset;
    ctx.strokeStyle = dark;
    ctx.lineWidth = row * 0.42;
    ctx.beginPath();
    ctx.moveTo(x + row * 0.3, 0);
    ctx.lineTo(x + row * 0.3 + h, h);
    ctx.stroke();
    ctx.strokeStyle = light;
    ctx.lineWidth = row * 0.3;
    ctx.beginPath();
    ctx.moveTo(x - row * 0.12, 0);
    ctx.lineTo(x - row * 0.12 + h, h);
    ctx.stroke();
  }
  ctx.restore();
}

/** Height map for the method: white is raised, black is sunk; only read where the artwork is. */
function methodBump(method: LogoDesign["method"], mask: HTMLCanvasElement): HTMLCanvasElement {
  const { width: w, height: h } = mask;
  const b = canvasOf(w, h);
  const ctx = b.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  if (method === "gravyr") {
    // Cut into the material: the surface stays high and the mark drops, with a soft wall.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "destination-out";
    ctx.filter = "blur(5px)";
    ctx.drawImage(mask, 0, 0);
    ctx.filter = "none";
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#222";
    ctx.fillRect(0, 0, w, h);
    return b;
  }
  const lift = { brodyr: 16, transfer: 3, screentryck: 1.5, digitaltryck: 0.8 }[method];
  ctx.filter = `blur(${lift}px)`;
  ctx.drawImage(mask, 0, 0);
  ctx.filter = "none";
  ctx.globalCompositeOperation = "source-atop";
  if (method === "brodyr") stitches(ctx, w, h, "rgba(255,255,255,.95)", "rgba(0,0,0,.7)");
  else if (method === "screentryck" || method === "digitaltryck") {
    ctx.globalAlpha = method === "digitaltryck" ? 0.55 : 0.3;
    ctx.fillStyle = ctx.createPattern(weave(), "repeat")!;
    ctx.fillRect(0, 0, w, h);
  }
  return b;
}

/** A soft shadow on the product around the artwork, for marks that stand up from the surface. */
function castShadow(ctx: CanvasRenderingContext2D, mask: HTMLCanvasElement, blur: number, alpha: number, dx: number, dy: number) {
  const s = canvasOf(mask.width, mask.height);
  const sc = s.getContext("2d")!;
  sc.drawImage(mask, 0, 0);
  sc.globalCompositeOperation = "source-in";
  sc.fillStyle = "#000";
  sc.fillRect(0, 0, s.width, s.height);
  ctx.save();
  ctx.globalCompositeOperation = "destination-over";
  ctx.globalAlpha = alpha;
  ctx.filter = `blur(${blur}px)`;
  ctx.drawImage(s, dx, dy);
  ctx.restore();
}

/** Surface look of the method on the colour artwork itself. */
function methodFinish(method: LogoDesign["method"], ctx: CanvasRenderingContext2D, mask: HTMLCanvasElement, darkProduct: boolean) {
  const { width: w, height: h } = mask;
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  if (method === "brodyr") {
    stitches(ctx, w, h, "rgba(255,255,255,.24)", "rgba(0,0,0,.36)");
    ctx.restore();
    innerShade(ctx, mask, 12, "rgba(0,0,0,.6)", -2, -3);
    innerShade(ctx, mask, 5, "rgba(255,255,255,.3)", 5, 6);
    castShadow(ctx, mask, 9, darkProduct ? 0.85 : 0.5, 3, 7);
    return;
  }
  if (method === "screentryck" || method === "digitaltryck") {
    // Ink sits in the fabric: the weave shows through, stronger for the thin digital ink.
    ctx.globalAlpha = method === "digitaltryck" ? 0.5 : 0.28;
    ctx.fillStyle = ctx.createPattern(weave(10), "repeat")!;
    ctx.fillRect(0, 0, w, h);
    if (method === "digitaltryck") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.globalAlpha = 0.24;
      ctx.fillRect(0, 0, w, h);
    }
  } else if (method === "transfer") {
    // A smooth film: one crisp gloss band across it.
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0.16, "rgba(255,255,255,0)");
    g.addColorStop(0.3, "rgba(255,255,255,.32)");
    g.addColorStop(0.35, "rgba(255,255,255,.15)");
    g.addColorStop(0.44, "rgba(255,255,255,0)");
    g.addColorStop(1, "rgba(0,0,0,.1)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
  if (method === "gravyr") {
    innerShade(ctx, mask, 6, darkProduct ? "rgba(0,0,0,.55)" : "rgba(0,0,0,.4)", 4, 5);
    innerShade(ctx, mask, 3, "rgba(255,255,255,.25)", -2, -2);
  } else if (method === "screentryck") {
    innerShade(ctx, mask, 1.5, "rgba(0,0,0,.25)");
  } else if (method === "transfer") {
    innerShade(ctx, mask, 2, "rgba(0,0,0,.22)");
    castShadow(ctx, mask, 2, darkProduct ? 0.5 : 0.22, 0, 2);
  }
}

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
  // A little room around a plain logo so raised methods can cast a shadow on the product.
  const pad = badge ? (d.shape === "rund" ? 0.62 : 0.72) : 0.94;
  const fit = Math.min((out.width * pad) / mark.width, (out.height * pad) / mark.height);
  const w = mark.width * fit;
  const h = mark.height * fit;
  // Digital ink spreads a touch into the fibres, so its edges are softer than a stencilled print.
  if (d.method === "digitaltryck") ctx.filter = "blur(2px)";
  ctx.drawImage(mark, (out.width - w) / 2, (out.height - h) / 2, w, h);
  ctx.filter = "none";

  // 3. The method's own surface: stitches, ink in the weave, film sheen or an engraved edge.
  const mask = canvasOf(out.width, out.height);
  mask.getContext("2d")!.drawImage(out, 0, 0);
  methodFinish(d.method, ctx, mask, darkProduct);
  return { canvas: out, aspect: out.width / out.height, bump: methodBump(d.method, mask), flat: mask };
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
