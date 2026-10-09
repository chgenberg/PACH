import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import type { Browser, Page } from "playwright-core";
import sharp from "sharp";
import { assertPublicUrl, isPrivate } from "@/lib/scrape/net";

/** Deep read of a company website for the booth demo: text, product/service photos and logo candidates. */

export type SiteImage = { jpg: Buffer; width: number; height: number; src: string; alt: string; hash: string };
export type LogoCandidate = { png: Buffer; source: string };
export type SiteScrape = {
  url: string;
  host: string;
  title: string;
  description: string;
  siteName: string;
  headings: string[];
  nav: string[];
  text: string;
  pages: string[];
  images: SiteImage[];
  logos: LogoCandidate[];
};

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36";
const MAX_IMAGE_BYTES = 6_000_000;
const MAX_IMAGES = 8;
const MAX_TEXT = 4000;
const PIXELS = 40_000_000;

const hostCache = new Map<string, Promise<boolean>>();
const isPublicHost = (host: string) => {
  if (!hostCache.has(host)) {
    if (hostCache.size > 500) hostCache.clear();
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

/** Image CDNs wrap the original asset; asking for the original gives a much larger picture. */
export function originalImageUrl(raw: string, base: string) {
  try {
    const u = new URL(raw, base);
    if (/\/_next\/image\/?$/.test(u.pathname) && u.searchParams.get("url")) return new URL(u.searchParams.get("url")!, u).toString();
    if (/\/cdn\/shop\//.test(u.pathname) || /cdn\.shopify\.com$/.test(u.hostname)) {
      u.searchParams.delete("width");
      u.searchParams.delete("height");
      u.searchParams.delete("crop");
      return u.toString().replace(/_(\d+x\d*|\d*x\d+)(?=\.[a-z]+(\?|$))/i, "");
    }
    return u.toString();
  } catch {
    return raw;
  }
}

/** Fetches an image with the SSRF check on every hop, a type check, a size cap and a timeout. */
export async function fetchImage(raw: string, timeoutMs = 8000): Promise<Buffer | null> {
  let url: URL;
  try {
    url = await assertPublicUrl(raw);
  } catch {
    return null;
  }
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(timeoutMs), headers: { "User-Agent": UA, Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8" } }).catch(() => null);
    if (!res) return null;
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      try {
        url = await assertPublicUrl(new URL(location, url).toString());
      } catch {
        return null;
      }
      continue;
    }
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/^image\//.test(type)) return null;
    if (Number(res.headers.get("content-length") ?? 0) > MAX_IMAGE_BYTES) return null;
    const reader = res.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_IMAGE_BYTES) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  }
  return null;
}

type Collected = {
  title: string;
  description: string;
  siteName: string;
  ogImage: string;
  headings: string[];
  nav: string[];
  text: string;
  images: { src: string; alt: string; area: number; natural: number; top: number; product: boolean }[];
  ldImages: string[];
  ldLogo: string;
  logos: { i: number; tag: string; src: string; score: number }[];
  links: { href: string; text: string }[];
};

/** Runs in the page. Plain browser JS only; nothing from Node can be referenced here. */
function collect(): Collected {
  const meta = (k: string) => (document.querySelector(`meta[property="${k}"], meta[name="${k}"]`) as HTMLMetaElement | null)?.content?.trim() ?? "";
  const clean = (s: string | null | undefined, n: number) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
  const visible = (e: Element) => {
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.05;
  };
  const host = location.hostname.replace(/^www\./, "");
  const largest = (srcset: string) =>
    srcset
      .split(",")
      .map((s) => s.trim().split(/\s+/))
      .filter((p) => p[0])
      .sort((a, b) => parseFloat(b[1] ?? "0") - parseFloat(a[1] ?? "0"))[0]?.[0] ?? "";

  const headings = [...document.querySelectorAll("h1, h2, h3")].filter(visible).map((h) => clean(h.textContent, 120)).filter(Boolean).slice(0, 24);
  const nav = [...document.querySelectorAll("header a, nav a, [role=navigation] a")].map((a) => clean(a.textContent, 40)).filter((t) => t.length > 1);
  const ld: unknown[] = [];
  document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
    try {
      ld.push(JSON.parse(s.textContent ?? ""));
    } catch {}
  });
  const ldImages: string[] = [];
  let ldLogo = "";
  const walk = (v: unknown, depth: number) => {
    if (!v || typeof v !== "object" || depth > 6) return;
    if (Array.isArray(v)) return v.forEach((x) => walk(x, depth + 1));
    const o = v as Record<string, unknown>;
    const type = String(o["@type"] ?? "");
    const img = (x: unknown): string[] => (typeof x === "string" ? [x] : Array.isArray(x) ? x.flatMap(img) : x && typeof x === "object" ? img((x as Record<string, unknown>).url) : []);
    if (/Product|Service|Offer|IndividualProduct|ProductGroup/i.test(type)) ldImages.push(...img(o.image));
    if (/Organization|Corporation|Brand|LocalBusiness|Store/i.test(type) && o.logo && !ldLogo) ldLogo = img(o.logo)[0] ?? "";
    Object.values(o).forEach((x) => walk(x, depth + 1));
  };
  walk(ld, 0);

  const images: Collected["images"] = [];
  document.querySelectorAll("img").forEach((img) => {
    const r = img.getBoundingClientRect();
    const src = largest(img.getAttribute("srcset") ?? "") || img.currentSrc || img.src;
    if (!src || src.startsWith("data:")) return;
    const ctx = `${img.alt} ${img.className} ${img.closest("[class]")?.className ?? ""}`.toLowerCase();
    images.push({
      src,
      alt: clean(img.alt, 100),
      area: Math.round(r.width * r.height),
      natural: img.naturalWidth * img.naturalHeight,
      top: Math.round(r.top + scrollY),
      product: Boolean(img.closest('[class*="product" i], [class*="card" i], [class*="grid" i], [itemtype*="Product"]')) || /product|produkt/.test(ctx),
    });
  });
  document.querySelectorAll("section, div, a, figure").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width * r.height < 160_000) return;
    const bg = getComputedStyle(el).backgroundImage;
    const m = bg && bg !== "none" ? /url\(["']?([^"')]+)["']?\)/.exec(bg) : null;
    if (m && !m[1].startsWith("data:")) images.push({ src: m[1], alt: "", area: Math.round(r.width * r.height), natural: 0, top: Math.round(r.top + scrollY), product: false });
  });

  const brandWords = [meta("og:site_name"), document.title.split(/[|–—:-]/)[0], host.split(".")[0]].map((s) => s.toLowerCase().replace(/[^a-z0-9]/g, "")).filter((s) => s.length >= 3);
  const logos: Collected["logos"] = [];
  let n = 0;
  document.querySelectorAll("img, svg").forEach((el) => {
    if (el.closest("svg") && el.tagName.toLowerCase() !== "svg") return;
    if (el.parentElement?.closest("svg")) return;
    const r = el.getBoundingClientRect();
    if (!visible(el) || r.top + scrollY > 260 || r.width < 16 || r.height < 10 || r.width > 520 || r.height > 220) return;
    const link = el.closest("a");
    const href = link?.getAttribute("href") ?? "";
    let home = false;
    try {
      const u = new URL(href, location.href);
      home = u.hostname.replace(/^www\./, "") === host && u.pathname.split("/").filter(Boolean).length <= 1;
    } catch {}
    const hay = [el, el.parentElement, link]
      .map((e) => (e ? `${e.getAttribute("class") ?? ""} ${e.id} ${e.getAttribute("alt") ?? ""} ${e.getAttribute("aria-label") ?? ""} ${e.getAttribute("title") ?? ""} ${e.getAttribute("src") ?? ""}` : ""))
      .join(" ")
      .toLowerCase();
    const flat = hay.replace(/[^a-z0-9]/g, "");
    let score = 0;
    if (/logo|brand/.test(hay)) score += 40;
    if (brandWords.some((w) => flat.includes(w))) score += 35;
    if (home) score += 25;
    if (el.closest("header, nav, [role=banner]")) score += 10;
    if (/flag|lang|locale|country|language|sprak|språk|cart|user|account|search|menu|lucide|icon/.test(hay)) score -= 60;
    if (r.width < 28 && r.height < 28) score -= 25;
    if (score < 20) return;
    el.setAttribute("data-demo-logo", String(n));
    logos.push({ i: n++, tag: el.tagName.toLowerCase(), src: el instanceof HTMLImageElement ? largest(el.getAttribute("srcset") ?? "") || el.currentSrc || el.src : "", score });
  });

  const WANT = /produkt|product|shop|butik|sortiment|kollektion|collection|kategori|categor|tjänst|tjanst|service|erbjud|offer|lösning|losning|solution|meny|menu|catalog|katalog|range|modell|model|vehicle|fordon|truck/i;
  const seenHref = new Set<string>();
  const links: Collected["links"] = [];
  document.querySelectorAll("header a[href], nav a[href], main a[href]").forEach((a) => {
    const text = clean(a.textContent, 40);
    const href = (a as HTMLAnchorElement).href;
    try {
      const u = new URL(href);
      if (u.hostname.replace(/^www\./, "") !== host || u.hash || u.pathname === location.pathname || !/^https?:$/.test(u.protocol)) return;
      if (/\.(pdf|zip|jpg|png)$/i.test(u.pathname) || /login|logga|account|konto|cart|kassa|checkout|kontakt|contact|privacy|integritet|cookie/i.test(u.pathname)) return;
      if (!WANT.test(`${text} ${u.pathname}`) || seenHref.has(u.pathname)) return;
      seenHref.add(u.pathname);
      links.push({ href: u.toString(), text });
    } catch {}
  });

  const main = document.querySelector("main") ?? document.body;
  return {
    title: clean(document.title, 160),
    description: clean(meta("og:description") || meta("description"), 300),
    siteName: clean(meta("og:site_name"), 60),
    ogImage: meta("og:image"),
    headings,
    nav: [...new Set(nav)].slice(0, 30),
    text: clean((main as HTMLElement).innerText, 6000),
    images,
    ldImages: [...new Set(ldImages)].slice(0, 12),
    ldLogo,
    logos: logos.sort((a, b) => b.score - a.score).slice(0, 4),
    links: links.slice(0, 6),
  };
}

const SKIP_SRC = /logo|icon|favicon|sprite|flag|avatar|badge|payment|klarna|swish|visa|mastercard|trustpilot|placeholder|spinner|loader|pixel|tracking|emoji|\.svg(\?|$)|\.gif(\?|$)/i;

/** Flat graphics (flags, icons, banners with few colours) are not product photos. */
export async function flatness(buf: Buffer) {
  const { data, info } = await sharp(buf, { limitInputPixels: PIXELS }).flatten({ background: "#FFFFFF" }).resize(48, 48, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const counts = new Map<number, number>();
  for (let k = 0; k < data.length; k += info.channels) {
    const key = ((data[k] >> 5) << 6) | ((data[k + 1] >> 5) << 3) | (data[k + 2] >> 5);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const top = [...counts.values()].sort((a, b) => b - a);
  const px = data.length / info.channels;
  return { colours: counts.size, top3: (top[0] + (top[1] ?? 0) + (top[2] ?? 0)) / px };
}

async function toPhoto(buf: Buffer, src: string, alt: string): Promise<SiteImage | null> {
  try {
    const img = sharp(buf, { limitInputPixels: PIXELS, animated: false });
    const meta = await img.metadata();
    const w = meta.width ?? 0, h = meta.height ?? 0;
    if (Math.min(w, h) < 280 || w / h > 2.8 || h / w > 2.2) return null;
    const flat = await flatness(buf);
    if (flat.colours < 18 || flat.top3 > 0.9) return null;
    const jpg = await sharp(buf, { limitInputPixels: PIXELS }).rotate().flatten({ background: "#FFFFFF" }).resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    const small = await sharp(jpg).resize(12, 12, { fit: "fill" }).greyscale().raw().toBuffer();
    const hash = createHash("sha1").update(small.map((v) => v >> 4)).digest("hex").slice(0, 16);
    const out = await sharp(jpg).metadata();
    return { jpg, width: out.width ?? w, height: out.height ?? h, src, alt, hash };
  } catch {
    return null;
  }
}

async function logoShot(page: Page, i: number) {
  return page
    .locator(`[data-demo-logo="${i}"]`)
    .first()
    .screenshot({ omitBackground: true, timeout: 4000 })
    .catch(() => null);
}

export async function scrapeSite(site: string, opts: { deadlineMs?: number } = {}): Promise<SiteScrape> {
  const started = Date.now();
  const deadline = started + (opts.deadlineMs ?? 45_000);
  const start = await assertPublicUrl(`https://${site}`);
  const browser = await launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: "sv-SE", userAgent: UA });
    await context.addInitScript({ content: "globalThis.__name ??= (f) => f;" });
    await context.route("**/*", async (route) => {
      const req = route.request();
      const u = new URL(req.url());
      if (u.protocol === "data:" || u.protocol === "blob:") return route.continue();
      if (!/^https?:$/.test(u.protocol) || ["media", "websocket", "eventsource", "font"].includes(req.resourceType())) return route.abort();
      return (await isPublicHost(u.hostname)) ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    await page.goto(start.toString(), { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 3)).catch(() => {});
    await page.waitForTimeout(700);
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
    const finalUrl = new URL(page.url());
    if (!(await isPublicHost(finalUrl.hostname))) throw new Error("Sidan pekar på en intern adress");
    const home = await page.evaluate(collect);

    const logos: LogoCandidate[] = [];
    for (const l of home.logos) {
      let png: Buffer | null = null;
      let source = "";
      if (l.tag === "img" && l.src) {
        const original = originalImageUrl(l.src, finalUrl.toString());
        const buf = (await fetchImage(original)) ?? (original !== l.src ? await fetchImage(l.src) : null);
        if (buf) {
          png = await sharp(buf, { limitInputPixels: PIXELS, density: 300 }).resize(1200, 1200, { fit: "inside", withoutEnlargement: false }).png().toBuffer().catch(() => null);
          source = `bild i sidhuvudet · ${original}`;
        }
      }
      if (!png) {
        png = await logoShot(page, l.i);
        source = "skärmdump av sidhuvudet";
      }
      if (png) logos.push({ png, source });
    }
    if (home.ldLogo) {
      const buf = await fetchImage(originalImageUrl(home.ldLogo, finalUrl.toString()));
      const png = buf ? await sharp(buf, { limitInputPixels: PIXELS, density: 300 }).resize(1200, 1200, { fit: "inside" }).png().toBuffer().catch(() => null) : null;
      if (png) logos.push({ png, source: `strukturerad data · ${home.ldLogo}` });
    }

    const pages = [finalUrl.toString()];
    const extra: Collected[] = [];
    for (const link of home.links.slice(0, 2)) {
      if (Date.now() > deadline - 15_000) break;
      try {
        await page.goto(link.href, { waitUntil: "domcontentloaded", timeout: 10_000 });
        await page.waitForLoadState("networkidle", { timeout: 3500 }).catch(() => {});
        const here = new URL(page.url());
        if (here.hostname.replace(/^www\./, "") !== finalUrl.hostname.replace(/^www\./, "")) continue;
        extra.push(await page.evaluate(collect));
        pages.push(here.toString());
      } catch {}
    }

    const base = finalUrl.toString();
    type Cand = { src: string; alt: string; score: number };
    const cands = new Map<string, Cand>();
    const add = (raw: string, alt: string, score: number) => {
      if (!raw || SKIP_SRC.test(raw)) return;
      const src = originalImageUrl(raw, base);
      const prev = cands.get(src);
      if (!prev || prev.score < score) cands.set(src, { src, alt: prev?.alt || alt, score });
    };
    [home, ...extra].forEach((c, pageIndex) => {
      c.ldImages.forEach((s) => add(s, "", 90));
      if (c.ogImage && pageIndex === 0) add(c.ogImage, "", 45);
      for (const im of c.images) {
        if (SKIP_SRC.test(`${im.src} ${im.alt}`)) continue;
        if (im.area < 12_000 && im.natural < 90_000) continue;
        const score = Math.min(60, Math.sqrt(Math.max(im.area, im.natural / 4)) / 12) + (im.product ? 25 : 0) + (pageIndex > 0 ? 10 : 0) + (im.top < 1200 ? 8 : 0) + (im.alt ? 4 : 0);
        add(im.src, im.alt, score);
      }
    });

    const ranked = [...cands.values()].sort((a, b) => b.score - a.score).slice(0, 18);
    const images: SiteImage[] = [];
    const hashes = new Set<string>();
    for (let k = 0; k < ranked.length && images.length < MAX_IMAGES && Date.now() < deadline - 3000; k += 6) {
      const batch = await Promise.all(
        ranked.slice(k, k + 6).map(async (c) => {
          const buf = await fetchImage(c.src, 7000);
          return buf ? toPhoto(buf, c.src, c.alt) : null;
        }),
      );
      for (const im of batch) {
        if (!im || hashes.has(im.hash) || images.length >= MAX_IMAGES) continue;
        hashes.add(im.hash);
        images.push(im);
      }
    }

    const headings = [...new Set([home, ...extra].flatMap((c) => c.headings))].slice(0, 40);
    const text = [home.text, ...extra.map((c) => c.text)].join("\n\n").slice(0, MAX_TEXT);
    return {
      url: base,
      host: finalUrl.hostname.replace(/^www\./, ""),
      title: home.title,
      description: home.description,
      siteName: home.siteName,
      headings,
      nav: home.nav,
      text,
      pages,
      images,
      logos,
    };
  } finally {
    await browser.close().catch(() => {});
  }
}
