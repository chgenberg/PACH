import { hostOk, normalizeHost } from "@/lib/host";

export type Profile = {
  host: string;
  name: string;
  color: string;
  logo: string;
};

const PRIVATE = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|169\.254\.)/i;
const ATTR = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] ?? "";

function titleOf(host: string) {
  const head = host.split(".")[0] ?? host;
  return head.charAt(0).toUpperCase() + head.slice(1);
}

function cleanTitle(raw: string, host: string) {
  const cut = raw
    .replace(/&amp;/g, "&")
    .replace(/^(välkommen till|welcome to|official site of|hem|home)\s+/i, "")
    .trim();
  return cut && cut.length < 32 ? cut : titleOf(host);
}

function themeColor(html: string) {
  const tag = html.match(/<meta[^>]+name=["']theme-color["'][^>]*>/i)?.[0];
  const raw = tag ? ATTR(tag, "content") : "";
  return /^#[0-9a-f]{3,8}$/i.test(raw) ? raw : "#1b1a17";
}

function iconOf(html: string, base: URL) {
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
  const pick = (test: (rel: string, href: string) => boolean) => {
    for (const tag of links) {
      const rel = ATTR(tag, "rel").toLowerCase();
      const href = ATTR(tag, "href");
      if (!href || !test(rel, href)) continue;
      try {
        return new URL(href, base).toString();
      } catch {
        continue;
      }
    }
    return "";
  };
  return (
    pick((rel) => rel.includes("apple-touch-icon")) ||
    pick((rel, href) => rel.includes("icon") && /\.png|\.svg|\.webp/i.test(href)) ||
    pick((rel) => rel.includes("icon"))
  );
}

export async function readProfile(raw: string): Promise<Profile> {
  const host = normalizeHost(raw);
  if (!hostOk(host) || PRIVATE.test(host)) throw new Error("Skriv en webbadress, till exempel volvo.com");

  const fallback: Profile = {
    host,
    name: titleOf(host),
    color: "#1b1a17",
    logo: `https://www.google.com/s2/favicons?domain=${host}&sz=128`,
  };

  try {
    const res = await fetch(`https://${host}`, {
      headers: { Accept: "text/html", "User-Agent": "PACH/0.1" },
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return fallback;
    const html = (await res.text()).slice(0, 200_000);
    const title = html.match(/<title[^>]*>([^<]+)/i)?.[1]?.replace(/\s*[|–-].*$/, "").trim();
    const logo = iconOf(html, new URL(res.url));
    return {
      host,
      name: title ? cleanTitle(title, host) : fallback.name,
      color: themeColor(html),
      logo: logo || fallback.logo,
    };
  } catch {
    return fallback;
  }
}
