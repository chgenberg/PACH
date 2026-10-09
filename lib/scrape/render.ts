import { lookup } from "node:dns/promises";
import type { Browser, Page } from "playwright-core";
import sharp from "sharp";
import { isPrivate } from "@/lib/scrape/net";

export type RenderedPick = { buffer: Buffer; source: string };
export type RenderedPage = { html: string; finalUrl: URL; picks: RenderedPick[] };

const MAX_BYTES = 4_000_000;
const DPR = 3;

const hostCache = new Map<string, Promise<boolean>>();
const isPublicHost = (host: string) => {
  if (!hostCache.has(host)) {
    hostCache.set(
      host,
      lookup(host, { all: true })
        .then((all) => all.length > 0 && all.every((a) => !isPrivate(a.address)))
        .catch(() => false),
    );
  }
  return hostCache.get(host)!;
};

async function launch(): Promise<Browser> {
  const { chromium } = await import("playwright-core");
  const args = ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"];
  const executablePath = process.env.CHROMIUM_PATH;
  return executablePath ? chromium.launch({ executablePath, args }) : chromium.launch({ channel: "chrome", args });
}

type Found = { i: number; score: number; tag: string; src: string };

/** Runs in the page: ranks elements that look like the site's own logo and tags them with data-logo-pick. */
function findLogos(): Found[] {
  const SKIP = /footer|partner|sponsor|payment|klarna|visa|mastercard|swish|trustpilot|client|customer|award|certif|app-?store|google-?play|social|facebook|instagram|linkedin|youtube|twitter|cookie|flag|lang|search|menu|cart|user|account/;
  const isHome = (a: Element | null) => {
    const href = a?.getAttribute("href");
    if (!href) return false;
    try {
      const u = new URL(href, location.href);
      return u.hostname.replace(/^www\./, "") === location.hostname.replace(/^www\./, "") && u.pathname.split("/").filter(Boolean).length <= 1 && u.pathname.length <= 8;
    } catch {
      return false;
    }
  };
  const visual = (el: Element): Element | null => {
    if (el instanceof SVGSVGElement || el instanceof HTMLImageElement) return el;
    if (el instanceof SVGElement) return el.ownerSVGElement;
    const area = (e: Element) => { const r = e.getBoundingClientRect(); return r.width * r.height; };
    const inner = [...el.querySelectorAll("svg, img")].filter((e) => area(e) > 0).sort((a, b) => area(b) - area(a))[0];
    if (inner) return inner;
    const drawn = (e: Element) => ["backgroundImage", "maskImage", "webkitMaskImage"].some((k) => { const v = (getComputedStyle(e) as unknown as Record<string, string>)[k]; return !!v && v !== "none"; });
    if (drawn(el) || [...el.querySelectorAll("*")].some(drawn)) return el;
    for (const pseudo of ["::before", "::after"]) {
      const cs = getComputedStyle(el, pseudo);
      if ((cs.backgroundImage !== "none" || cs.maskImage !== "none") && cs.content !== "none") return el;
    }
    const text = (el.textContent ?? "").trim();
    return /logo/i.test(`${el.getAttribute("class")} ${el.id}`) || (isHome(el.closest("a")) && text.length < 3) ? el : null;
  };
  const deepAll = (sel: string) => {
    const found: Element[] = [];
    const walk = (root: Document | ShadowRoot) => {
      found.push(...root.querySelectorAll(sel));
      root.querySelectorAll("*").forEach((e) => e.shadowRoot && walk(e.shadowRoot));
    };
    walk(document);
    return found;
  };
  const up = (e: Element): Element | null => e.parentElement ?? ((e.getRootNode() as ShadowRoot).host || null);
  const closest = (e: Element, sel: string) => {
    for (let c: Element | null = e; c; c = up(c)) if (c.matches(sel)) return c;
    return null;
  };
  const seeds = new Set<Element>();
  deepAll('[class*="logo" i], [id*="logo" i], [alt*="logo" i], [aria-label*="logo" i], [title*="logo" i], [class*="brand" i], header a, nav a, [role=banner] a').forEach((e) => seeds.add(e));
  deepAll("a").forEach((a) => isHome(a) && seeds.add(a));
  const out: Found[] = [];
  const seen = new Set<Element>();
  let i = 0;
  for (const seed of seeds) {
    const v = visual(seed);
    if (!v || seen.has(v)) continue;
    seen.add(v);
    const r = v.getBoundingClientRect();
    if (r.width < 24 || r.height < 6 || r.width * r.height < 300 || r.width > 700 || r.height > 260 || r.top > 320 || r.bottom < 0) continue;
    const cs = getComputedStyle(v);
    if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) < 0.1) continue;
    const link = closest(v, "a");
    const hay = [seed, v, link, up(v)]
      .map((e) => (e ? `${e.getAttribute("class") ?? ""} ${e.id} ${e.getAttribute("data-autoid") ?? ""} ${e.getAttribute("data-testid") ?? ""} ${e.getAttribute("alt") ?? ""} ${e.getAttribute("aria-label") ?? ""} ${e.getAttribute("src") ?? ""}` : ""))
      .join(" ")
      .toLowerCase();
    const logoWord = /logo|brand/.test(hay);
    if (SKIP.test(hay.replace(/logo\S*/g, "")) && !logoWord) continue;
    let score = 0;
    if (/logo/.test(hay)) score += 40;
    if (/brand/.test(hay)) score += 10;
    if (isHome(link)) score += 30;
    if (closest(v, "header, nav, [role=banner], [class*=header i], [class*=nav i]")) score += 20;
    score += Math.max(0, (320 - r.top) / 16);
    if (r.left < 500) score += 10;
    if (v instanceof SVGSVGElement) score += 8;
    if (r.width / r.height < 0.6) score -= 10;
    v.setAttribute("data-logo-pick", String(i));
    out.push({ i: i++, score, tag: v.tagName.toLowerCase(), src: v instanceof HTMLImageElement ? v.currentSrc || v.src : "" });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 4);
}

/** Runs in the page: serialises an inline SVG with its computed colours baked in. */
function serializeSvg(i: number): string | null {
  const find = (root: Document | ShadowRoot): Element | null => {
    const hit = root.querySelector(`[data-logo-pick="${i}"]`);
    if (hit) return hit;
    for (const e of root.querySelectorAll("*")) if (e.shadowRoot) { const h = find(e.shadowRoot); if (h) return h; }
    return null;
  };
  const el = find(document);
  if (!(el instanceof SVGSVGElement)) return null;
  const root = el.getRootNode() as Document | ShadowRoot;
  const PROPS = ["fill", "fill-opacity", "fill-rule", "clip-rule", "stroke", "stroke-width", "stroke-opacity", "stroke-linecap", "stroke-linejoin", "opacity", "stop-color", "stop-opacity", "font-family", "font-size", "font-weight"];
  const copy = (src: Element, dst: Element) => {
    const cs = getComputedStyle(src);
    dst.setAttribute("style", PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(";"));
    dst.removeAttribute("class");
  };
  const pairs = (a: Element, b: Element) => {
    const xs = [a, ...a.querySelectorAll("*")], ys = [b, ...b.querySelectorAll("*")];
    xs.forEach((x, k) => ys[k] && copy(x, ys[k]));
  };
  const clone = el.cloneNode(true) as SVGSVGElement;
  pairs(el, clone);
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  for (const u of clone.querySelectorAll("use")) {
    const href = u.getAttribute("href") || u.getAttribute("xlink:href") || "";
    if (!href.startsWith("#")) return null;
    const ref = root.querySelector(`[id="${CSS.escape(href.slice(1))}"]`);
    if (!ref || clone.querySelector(href)) continue;
    const rc = ref.cloneNode(true) as Element;
    pairs(ref, rc);
    defs.appendChild(rc);
  }
  if (defs.childNodes.length) clone.prepend(defs);
  const r = el.getBoundingClientRect();
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  clone.setAttribute("width", String(r.width));
  clone.setAttribute("height", String(r.height));
  if (!clone.getAttribute("viewBox")) clone.setAttribute("viewBox", `0 0 ${r.width} ${r.height}`);
  return new XMLSerializer().serializeToString(clone);
}

async function isolatedShot(page: Page, i: number) {
  const el = page.locator(`[data-logo-pick="${i}"]`).first();
  const style = await page.addStyleTag({
    content: "html,body{background:transparent!important}body *{visibility:hidden!important;animation:none!important;transition:none!important}",
  });
  await el.evaluate((t) => [t, ...t.querySelectorAll("*")].forEach((n) => (n as HTMLElement).style.setProperty("visibility", "visible", "important")));
  try {
    return await el.screenshot({ omitBackground: true, timeout: 5000 });
  } finally {
    await el.evaluate((t) => [t, ...t.querySelectorAll("*")].forEach((n) => (n as HTMLElement).style.removeProperty("visibility"))).catch(() => {});
    await style.evaluate((n) => (n as Element).remove()).catch(() => {});
  }
}

async function thumb(buf: Buffer) {
  const { data } = await sharp(buf, { density: 144 }).resize(64, 32, { fit: "fill" }).flatten({ background: "#FFFFFF" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return data;
}

/** Mean per-channel difference between two renderings of the same logo (0–255). */
async function difference(a: Buffer, b: Buffer) {
  const [x, y] = await Promise.all([thumb(a), thumb(b)]);
  let d = 0;
  for (let k = 0; k < x.length; k++) d += Math.abs(x[k] - y[k]);
  return d / x.length;
}

/** Foreground mask independent of colour and backdrop: distance from the corner colour, cropped and normalised. */
async function silhouette(buf: Buffer) {
  const { data, info } = await sharp(buf, { density: 144 }).flatten({ background: "#FFFFFF" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const votes = new Map<number, number>();
  const vote = (x: number, y: number) => {
    const k = (y * w + x) * 3;
    const key = ((data[k] >> 3) << 10) | ((data[k + 1] >> 3) << 5) | (data[k + 2] >> 3);
    votes.set(key, (votes.get(key) ?? 0) + 1);
  };
  for (let x = 0; x < w; x++) { vote(x, 0); vote(x, h - 1); }
  for (let y = 0; y < h; y++) { vote(0, y); vote(w - 1, y); }
  const top = [...votes].sort((p, q) => q[1] - p[1])[0][0];
  const bg = [(top >> 10) << 3, ((top >> 5) & 31) << 3, (top & 31) << 3].map((v) => v + 4);
  const m = Buffer.alloc(w * h);
  let max = 1, x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = (y * w + x) * 3;
    const d = Math.max(Math.abs(data[k] - bg[0]), Math.abs(data[k + 1] - bg[1]), Math.abs(data[k + 2] - bg[2]));
    m[y * w + x] = d;
    if (d > max) max = d;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = (m[y * w + x] = Math.min(255, (m[y * w + x] * 255) / max));
    if (v > 60) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  if (x1 < 0) return { ratio: 0, mask: Buffer.alloc(96 * 48) };
  const mask = await sharp(m, { raw: { width: w, height: h, channels: 1 } })
    .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
    .resize(96, 48, { fit: "fill" })
    .blur(1.5)
    .raw()
    .toBuffer();
  return { ratio: (x1 - x0 + 1) / (y1 - y0 + 1), mask };
}

/** The screenshot's colour when the logo is drawn in one flat colour (CSS fill, mask or currentColor). */
async function flatColor(shot: Buffer): Promise<[number, number, number] | null> {
  const { data } = await sharp(shot).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bg = [data[0], data[1], data[2], data[3]];
  const isBg = (k: number) => Math.abs(data[k] - bg[0]) + Math.abs(data[k + 1] - bg[1]) + Math.abs(data[k + 2] - bg[2]) + Math.abs(data[k + 3] - bg[3]) < 40;
  let n = 0, r = 0, g = 0, b = 0;
  for (let k = 0; k < data.length; k += 4) if (data[k + 3] > 200 && !isBg(k)) { n++; r += data[k]; g += data[k + 1]; b += data[k + 2]; }
  if (n < 20) return null;
  const mean: [number, number, number] = [r / n, g / n, b / n];
  let near = 0;
  for (let k = 0; k < data.length; k += 4) {
    if (data[k + 3] > 200 && !isBg(k) && Math.abs(data[k] - mean[0]) + Math.abs(data[k + 1] - mean[1]) + Math.abs(data[k + 2] - mean[2]) < 60) near++;
  }
  return near / n > 0.9 ? mean : null;
}

/** Renders the source at high resolution, flat-tinted in the colour the page displays it in. */
async function tint(vector: Buffer, [r, g, b]: [number, number, number]) {
  const meta = await sharp(vector).metadata();
  const density = Math.min(2400, Math.max(72, (72 * 1400) / Math.max(meta.width ?? 1400, meta.height ?? 1400)));
  const alpha = await sharp(vector, { density }).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  const { width, height } = alpha.info;
  return sharp({ create: { width, height, channels: 3, background: { r: Math.round(r), g: Math.round(g), b: Math.round(b) } } })
    .joinChannel(await sharp(alpha.data, { raw: { width, height, channels: 1 } }).png().toBuffer())
    .png()
    .toBuffer();
}

async function sameShape(a: Buffer, b: Buffer) {
  const [x, y] = await Promise.all([silhouette(a), silhouette(b)]);
  if (!x.ratio || !y.ratio || Math.abs(Math.log(x.ratio / y.ratio)) > 0.12) return false;
  let d = 0;
  for (let k = 0; k < x.mask.length; k++) d += Math.abs(x.mask[k] - y.mask[k]);
  return d / x.mask.length < 40;
}

async function fetchVia(page: Page, url: string, loaded: Map<string, Promise<Buffer | null>>): Promise<Buffer | null> {
  const seen = await loaded.get(url);
  if (seen) return seen;
  const b64 = await page
    .evaluate(async ({ url, max }) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength > max) return null;
      let bin = "";
      for (let k = 0; k < buf.length; k += 0x8000) bin += String.fromCharCode(...buf.subarray(k, k + 0x8000));
      return btoa(bin);
    }, { url, max: MAX_BYTES })
    .catch(() => null);
  return b64 ? Buffer.from(b64, "base64") : null;
}

export async function renderLogos(url: string): Promise<RenderedPage> {
  const browser = await launch();
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: DPR,
      locale: "sv-SE",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36",
    });
    await context.addInitScript({ content: "globalThis.__name ??= (f) => f;" });
    await context.route("**/*", async (route) => {
      const req = route.request();
      const u = new URL(req.url());
      if (u.protocol === "data:" || u.protocol === "blob:") return route.continue();
      if (!/^https?:$/.test(u.protocol) || ["media", "websocket", "eventsource"].includes(req.resourceType())) return route.abort();
      return (await isPublicHost(u.hostname)) ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    const loaded = new Map<string, Promise<Buffer | null>>();
    page.on("response", (res) => {
      if (res.request().resourceType() !== "image" || !res.ok()) return;
      loaded.set(res.url(), res.body().then((b) => (b.byteLength <= MAX_BYTES ? b : null)).catch(() => null));
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 7000 }).catch(() => {});
    await page.waitForTimeout(600);
    const finalUrl = new URL(page.url());
    if (!(await isPublicHost(finalUrl.hostname))) throw new Error("Sidan pekar på en intern adress");

    const found = await page.evaluate(findLogos);
    const picks: RenderedPick[] = [];
    for (const f of found) {
      const shot = await isolatedShot(page, f.i).catch(() => null);
      if (!shot) continue;
      let vector: Buffer | null = null;
      if (f.tag === "svg") {
        const svg = await page.evaluate(serializeSvg, f.i);
        if (svg) vector = Buffer.from(svg);
      } else if (f.tag === "img" && f.src) {
        vector = await fetchVia(page, f.src, loaded);
      }
      const label = f.tag === "svg" ? "inbäddad SVG" : `bild · ${f.src}`;
      if (vector && (await difference(vector, shot).catch(() => 255)) < 18) {
        picks.push({ buffer: vector, source: `${label}, renderad` });
        continue;
      }
      const color = vector && (await sameShape(vector, shot).catch(() => false)) ? await flatColor(shot).catch(() => null) : null;
      const tinted = color ? await tint(vector!, color).catch(() => null) : null;
      picks.push(tinted ? { buffer: tinted, source: `${label}, i sidans färg` } : { buffer: shot, source: "skärmdump av sidhuvudet" });
    }
    return { html: await page.content(), finalUrl, picks };
  } finally {
    await browser.close().catch(() => {});
  }
}
