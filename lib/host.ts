export function normalizeHost(raw: string) {
  const cut = raw.trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, "").replace(/^www\./, "");
  return (cut.split(/[/?#]/)[0] ?? "").replace(/\.$/, "");
}

/** Brand books get their own pseudo address, e.g. "bb-1a2b3c4d5e6f.brandbook", so they flow like a website. */
export const BRANDBOOK_SUFFIX = ".brandbook";
export const isBrandbookHost = (host: string) => host.endsWith(BRANDBOOK_SUFFIX);

export function hostOk(host: string) {
  if (host.length < 4 || host.length > 253 || !host.includes(".") || host.startsWith(".") || host.endsWith(".")) return false;
  return /^[\p{L}\p{N}.-]+$/u.test(host);
}
