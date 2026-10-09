import sharp from "sharp";
import { NewsError, assertPublicUrl, fetchHtml } from "@/lib/scrape/net";
import { renderLogos } from "@/lib/scrape/render";

/**
 * Loggan (från New Wave): renderar sajten, hittar loggan i sidhuvudet, friställer bakgrunden,
 * kvalitetskontrollerar formen och gör en variant för ljus och en för mörk bakgrund.
 */

export class LogoError extends Error {}

export type LogoResult = {
  name: string;
  site: string;
  source: string;
  color: string;
  width: number;
  height: number;
  /** For light backgrounds (neutral light parts darkened). */
  light: Buffer;
  /** For dark backgrounds (neutral dark parts whitened). */
  dark: Buffer;
};

type Candidate = { score: number; kind: "url" | "svg"; value: string; why: string };

const MAX_BYTES = 4_000_000;
const MAX_TRIES = 8;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36";

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] ?? "";
const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

const SKIP = /footer|partner|sponsor|payment|klarna|visa|mastercard|swish|trustpilot|client|customer|award|certif|app-?store|google-?play|social|facebook|instagram|linkedin|youtube|twitter/;

function candidates(html: string, base: URL): Candidate[] {
  const out: Candidate[] = [];
  const header = html.match(/<header[\s\S]*?<\/header>/i)?.[0] ?? html.slice(0, 20_000);
  const push = (raw: string, score: number, why: string) => {
    const v = decode(raw.trim());
    if (!v) return;
    if (v.startsWith("data:image/")) return out.push({ score, kind: "url", value: v, why });
    try {
      out.push({ score, kind: "url", value: new URL(v, base).toString(), why });
    } catch {}
  };

  for (const m of html.matchAll(/"logo"\s*:\s*(?:\{[^}]*?"url"\s*:\s*)?"([^"]+)"/g)) push(m[1].replace(/\\\//g, "/"), 70, "strukturerad data");

  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const src = attr(tag, "src") || attr(tag, "data-src") || attr(tag, "srcset").split(/[\s,]+/)[0];
    if (!src) continue;
    const before = html.slice(Math.max(0, m.index! - 300), m.index).toLowerCase();
    const hay = `${attr(tag, "class")} ${attr(tag, "id")} ${attr(tag, "alt")} ${src}`.toLowerCase();
    if (!/logo|brand/.test(`${hay} ${before.slice(-160)}`)) continue;
    let score = 60 + (header.includes(tag) ? 25 : 0) + (/\.svg/i.test(src) ? 10 : 0);
    if (SKIP.test(hay) || SKIP.test(before.slice(-200))) score -= 45;
    push(src, score, "bild i sidhuvudet");
  }

  for (const m of html.matchAll(/<svg\b[\s\S]*?<\/svg>/gi)) {
    const svg = m[0];
    if (svg.length < 200 || svg.length > 400_000) continue;
    if (/<use\b/i.test(svg) && !/<path|<polygon|<rect|<circle/i.test(svg)) continue;
    const before = html.slice(Math.max(0, m.index! - 300), m.index).toLowerCase();
    const open = svg.match(/<svg\b[^>]*>/i)![0].toLowerCase();
    const hay = `${open} ${before.slice(-200)} ${svg.match(/<title>([^<]*)/i)?.[1] ?? ""}`.toLowerCase();
    if (!/logo|brand|home|hem|start/.test(hay)) continue;
    let score = (/logo|brand/.test(hay) ? 65 : 40) + (header.includes(svg) ? 25 : 0);
    if (SKIP.test(hay)) score -= 45;
    out.push({ score, kind: "svg", value: svg, why: "inbäddad SVG i sidhuvudet" });
  }

  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = attr(tag, "rel").toLowerCase();
    const href = attr(tag, "href");
    if (!href || !/icon/.test(rel)) continue;
    if (/\.svg/i.test(href)) push(href, 35, "ikon (SVG)");
    else if (/apple-touch-icon/.test(rel)) push(href, 30, "appikon");
    else push(href, 12, "favicon");
  }

  const og = html.match(/<meta[^>]+property=["']og:logo["'][^>]*>/i)?.[0];
  if (og) push(attr(og, "content"), 55, "og:logo");
  push(`https://www.google.com/s2/favicons?domain=${base.hostname}&sz=256`, 5, "favicon via Google");

  const seen = new Set<string>();
  return out
    .filter((c) => (seen.has(c.value) ? false : (seen.add(c.value), true)))
    .sort((a, b) => b.score - a.score);
}

async function fetchImage(raw: string): Promise<Buffer> {
  if (raw.startsWith("data:image/")) {
    const [head, body] = raw.split(",", 2);
    return head.includes(";base64") ? Buffer.from(body, "base64") : Buffer.from(decodeURIComponent(body));
  }
  let url = await assertPublicUrl(raw);
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10_000), headers: { "User-Agent": UA, Accept: "image/*,*/*" } });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      url = await assertPublicUrl(new URL(location, url).toString());
      continue;
    }
    if (!res.ok) throw new LogoError(`Bilden svarade ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) throw new LogoError("Bilden är för stor");
    return buf;
  }
  throw new LogoError("För många omdirigeringar");
}

const withXmlns = (svg: string) => (/\sxmlns=/.test(svg.match(/<svg\b[^>]*>/i)?.[0] ?? "") ? svg : svg.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"'));

type Raster = { data: Buffer; width: number; height: number; vector?: boolean };

async function rasterize(buf: Buffer): Promise<Raster> {
  const isSvg = /<svg[\s>]/i.test(buf.subarray(0, 2000).toString("utf8"));
  const input = isSvg ? Buffer.from(withXmlns(buf.toString("utf8"))) : buf;
  const meta = await sharp(input, isSvg ? { density: 72 } : {}).metadata();
  const density = isSvg ? Math.min(2400, Math.max(72, Math.round((72 * 1400) / Math.max(meta.width ?? 100, meta.height ?? 100)))) : undefined;
  const { data, info } = await sharp(input, density ? { density } : {})
    .resize(1400, 1400, { fit: "inside", withoutEnlargement: !isSvg })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, vector: isSvg };
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Removes a uniform, partly transparent layer along the edges, e.g. a tinted header behind a screenshotted logo. */
function knockOutTranslucentEdge(r: Raster) {
  const { data, width: w, height: h } = r;
  const edge: number[] = [];
  for (let x = 0; x < w; x += 2) edge.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y += 2) edge.push(y * w, y * w + w - 1);
  const filled = edge.map((p) => p * 4).filter((k) => data[k + 3] > 16);
  if (filled.length < edge.length * 0.6) return;
  const bg = [0, 1, 2, 3].map((c) => filled.reduce((s, k) => s + data[k + c], 0) / filled.length);
  const dist = (k: number) => Math.hypot(data[k] - bg[0], data[k + 1] - bg[1], data[k + 2] - bg[2], data[k + 3] - bg[3]);
  if (filled.filter((k) => dist(k) < 40).length < filled.length * 0.85) return;
  for (let k = 0; k < data.length; k += 4) data[k + 3] = Math.round(data[k + 3] * smoothstep(22, 70, dist(k)));
}

/** Makes a uniform background transparent. Returns false when the image looks like a photo. */
function knockOutBackground(r: Raster) {
  const { data, width: w, height: h } = r;
  let opaque = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 250) opaque++;
  if (opaque / (w * h) < 0.97) {
    knockOutTranslucentEdge(r);
    return true;
  }
  const corner = (x: number, y: number) => {
    const k = (y * w + x) * 4;
    return [data[k], data[k + 1], data[k + 2]];
  };
  const cs = [corner(1, 1), corner(w - 2, 1), corner(1, h - 2), corner(w - 2, h - 2)];
  const bg = [0, 1, 2].map((c) => cs.reduce((s, p) => s + p[c], 0) / 4);
  if (cs.some((p) => Math.hypot(p[0] - bg[0], p[1] - bg[1], p[2] - bg[2]) > 40)) return false;
  if (Math.min(...bg) < 225) return true;
  let edge = 0, edgeBg = 0;
  for (let x = 0; x < w; x += 3) {
    for (const y of [0, h - 1]) {
      const k = (y * w + x) * 4;
      edge++;
      if (Math.hypot(data[k] - bg[0], data[k + 1] - bg[1], data[k + 2] - bg[2]) < 40) edgeBg++;
    }
  }
  if (edgeBg / edge < 0.85) return false;
  for (let k = 0; k < data.length; k += 4) {
    const d = Math.hypot(data[k] - bg[0], data[k + 1] - bg[1], data[k + 2] - bg[2]);
    data[k + 3] = Math.round(data[k + 3] * smoothstep(22, 70, d));
  }
  return true;
}

function bounds(r: Raster) {
  const { data, width: w, height: h } = r;
  let x0 = w, y0 = h, x1 = -1, y1 = -1, count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 24) {
        count++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, fill: count / ((x1 - x0 + 1) * (y1 - y0 + 1)) };
}

function analyse(r: Raster) {
  const { data } = r;
  let n = 0, dark = 0, light = 0;
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let k = 0; k < data.length; k += 4) {
    if (data[k + 3] < 128) continue;
    const [R, G, B] = [data[k], data[k + 1], data[k + 2]];
    const max = Math.max(R, G, B), min = Math.min(R, G, B);
    const lum = (0.2126 * R + 0.7152 * G + 0.0722 * B) / 255;
    const sat = max === 0 ? 0 : (max - min) / max;
    n++;
    if (lum < 0.22 || (lum < 0.3 && sat < 0.4)) dark++;
    if (lum > 0.85 && sat < 0.2) light++;
    if (sat > 0.35 && max > 50) {
      const key = ((R >> 4) << 8) | ((G >> 4) << 4) | (B >> 4);
      const bk = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      bk.n++;
      bk.r += R;
      bk.g += G;
      bk.b += B;
      buckets.set(key, bk);
    }
  }
  const top = [...buckets.values()].sort((a, b) => b.n - a.n)[0];
  const hex = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  const color = top && top.n > n * 0.04 ? `#${hex(top.r / top.n)}${hex(top.g / top.n)}${hex(top.b / top.n)}`.toUpperCase() : "#1D1D1F";
  return { darkFrac: n ? dark / n : 0, lightFrac: n ? light / n : 0, color };
}

/** Recolours neutral pixels in a luminance range; keeps brand colours and alpha. */
function recolorNeutral(r: Raster, test: (lum: number, sat: number) => boolean, to: [number, number, number]) {
  const data = Buffer.from(r.data);
  for (let k = 0; k < data.length; k += 4) {
    if (data[k + 3] === 0) continue;
    const [R, G, B] = [data[k], data[k + 1], data[k + 2]];
    const max = Math.max(R, G, B), min = Math.min(R, G, B);
    const lum = (0.2126 * R + 0.7152 * G + 0.0722 * B) / 255;
    if (test(lum, max === 0 ? 0 : (max - min) / max)) [data[k], data[k + 1], data[k + 2]] = to;
  }
  return { ...r, data };
}

const toPng = (r: Raster) => sharp(r.data, { raw: { width: r.width, height: r.height, channels: 4 } }).png().toBuffer();

async function prepare(buf: Buffer) {
  const r = await rasterize(buf);
  if (!knockOutBackground(r)) throw new LogoError("Ser ut som ett foto");
  const b = bounds(r);
  if (!b || Math.max(b.w, b.h) < (r.vector ? 32 : 120) || b.h < 16 || b.w / b.h > 14 || b.h / b.w > 4 || b.fill < 0.03) throw new LogoError("Hittade ingen tydlig logga i bilden");
  const pad = Math.round(Math.max(b.w, b.h) * 0.02);
  const left = Math.max(0, b.x - pad), top = Math.max(0, b.y - pad);
  const width = Math.min(r.width - left, b.w + 2 * pad), height = Math.min(r.height - top, b.h + 2 * pad);
  const { data, info } = await sharp(await toPng(r)).extract({ left, top, width, height }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

async function finish(r: Raster, meta: { name: string; site: string; source: string }): Promise<LogoResult> {
  const { darkFrac, lightFrac, color } = analyse(r);
  const onLight = lightFrac > 0.5 ? recolorNeutral(r, (l, s) => l > 0.7 && s < 0.25, [29, 29, 31]) : r;
  const onDark = darkFrac > 0.2 ? recolorNeutral(r, (l, s) => l < 0.22 || (l < 0.35 && s < 0.4), [255, 255, 255]) : r;
  const [light, dark] = await Promise.all([toPng(onLight), toPng(onDark)]);
  return { ...meta, color, width: r.width, height: r.height, light, dark };
}

function siteName(html: string, url: URL) {
  const meta = (key: string) => {
    const tag = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, "i"))?.[0];
    return tag ? decode(attr(tag, "content")).trim() : "";
  };
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
  const host = url.hostname.replace(/^www\./, "");
  const fromTitle = title.split(/\s+[|–—-]\s+/).sort((a, b) => a.length - b.length)[0] ?? "";
  return meta("og:site_name") || meta("application-name") || (fromTitle.length > 1 && fromTitle.length < 40 ? fromTitle : "") || host;
}

export async function logoFromUrl(raw: string): Promise<LogoResult> {
  const withScheme = /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`;
  await assertPublicUrl(withScheme).catch((e) => {
    throw new LogoError(e instanceof NewsError ? e.message : "Kunde inte öppna webbplatsen.");
  });
  const rendered = await renderLogos(withScheme).catch(() => null);
  if (rendered) {
    const name = siteName(rendered.html, rendered.finalUrl);
    const site = rendered.finalUrl.hostname.replace(/^www\./, "");
    for (const pick of rendered.picks) {
      try {
        return await finish(await prepare(pick.buffer), { name, site, source: pick.source });
      } catch {}
    }
  }
  let page: { html: string; finalUrl: URL };
  try {
    page = await fetchHtml(await assertPublicUrl(withScheme));
  } catch (e) {
    throw new LogoError(e instanceof NewsError ? e.message : "Kunde inte öppna webbplatsen.");
  }
  const { html, finalUrl } = page;
  const name = siteName(html, finalUrl);
  const site = finalUrl.hostname.replace(/^www\./, "");
  for (const c of candidates(html, finalUrl).slice(0, MAX_TRIES)) {
    try {
      const buf = c.kind === "svg" ? Buffer.from(c.value) : await fetchImage(c.value);
      const r = await prepare(buf);
      return await finish(r, { name, site, source: c.kind === "svg" ? c.why : `${c.why} · ${c.value.startsWith("data:") ? "inbäddad" : c.value}` });
    } catch {}
  }
  throw new LogoError("Hittade ingen logga på sidan. Ladda upp den som fil i stället.");
}

export async function logoFromFile(buf: Buffer, name: string): Promise<LogoResult> {
  const r = await prepare(buf).catch(() => {
    throw new LogoError("Kunde inte läsa loggan. Använd PNG, JPG eller SVG.");
  });
  return finish(r, { name, site: "", source: "uppladdad fil" });
}
