/** Nätverksskydd för skrapning (från New Wave): bara publika adresser, begränsad storlek och omdirigeringar. */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_BYTES = 3_000_000;

export class NewsError extends Error {}

export function isPrivate(ip: string) {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    return v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:127.");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

export async function assertPublicUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new NewsError("Det ser inte ut som en länk.");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new NewsError("Länken måste börja med http eller https.");
  const { address } = await lookup(url.hostname).catch(() => {
    throw new NewsError("Hittar inte webbplatsen.");
  });
  if (isPrivate(address)) throw new NewsError("Länken pekar på en intern adress.");
  return url;
}

export const decodeEntities = (s: string) =>
  s
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

export async function fetchHtml(start: URL) {
  let url = start;
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(12_000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36",
        "Accept-Language": "sv-SE,sv;q=0.9",
      },
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      url = await assertPublicUrl(new URL(location, url).toString());
      continue;
    }
    if (!res.ok) throw new NewsError(`Sidan svarade ${res.status}.`);
    if (!(res.headers.get("content-type") ?? "").includes("html")) throw new NewsError("Länken går inte till en webbsida.");
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) throw new NewsError("Sidan är för stor för att läsas.");
    return { html: new TextDecoder("utf-8").decode(buf), finalUrl: url };
  }
  throw new NewsError("För många omdirigeringar.");
}

