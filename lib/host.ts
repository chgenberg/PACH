export function normalizeHost(raw: string) {
  const cut = raw.trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, "").replace(/^www\./, "");
  return (cut.split(/[/?#]/)[0] ?? "").replace(/\.$/, "");
}

export function hostOk(host: string) {
  if (host.length < 4 || host.length > 253 || !host.includes(".") || host.startsWith(".") || host.endsWith(".")) return false;
  return /^[\p{L}\p{N}.-]+$/u.test(host);
}
