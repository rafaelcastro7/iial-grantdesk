// Pure helpers for adding a grant from a URL the user found elsewhere.
// Client-safe and unit-tested; the server function lives in grants.functions.

const TRACKING_PARAM = /^(utm_\w+|gclid|fbclid|mc_cid|mc_eid|_ga|ref|source)$/i;

/** Canonical form used for duplicate detection: https, no www, no hash or tracking params. */
export function normalizeGrantUrl(raw: string): URL {
  const trimmed = raw.trim();
  const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withScheme);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https links can be added.");
  }
  if (isPrivateHost(url.hostname)) {
    throw new Error("That address is not a public web page.");
  }
  url.hash = "";
  url.username = "";
  url.password = "";
  url.hostname = url.hostname.toLowerCase();
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
  }
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url;
}

/** Every stored spelling that should count as the same page. */
export function urlVariants(url: URL): string[] {
  const host = url.hostname.replace(/^www\./, "");
  const rest = `${url.pathname === "/" ? "" : url.pathname}${url.search}`;
  const out = new Set<string>();
  for (const scheme of ["https", "http"]) {
    for (const h of [host, `www.${host}`]) {
      out.add(`${scheme}://${h}${rest}`);
      out.add(`${scheme}://${h}${rest}/`);
      if (!rest) out.add(`${scheme}://${h}`);
    }
  }
  return [...out];
}

/** Blocks loopback, link-local, private ranges and bare hostnames (server-side fetch safety). */
export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h.includes(".") && !h.includes(":")) return true;
  if (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".local") ||
    h.endsWith(".internal")
  )
    return true;
  const v4 = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  if (h.includes(":")) return h === "::1" || /^f[cd]/.test(h) || h.startsWith("fe80");
  return false;
}

/** Country guess from the domain; Canada is the default market. */
export function countryFromHost(hostname: string): string {
  const h = hostname.toLowerCase();
  if (/\.gov$|\.us$|\.mil$/.test(h)) return "US";
  if (/\.uk$/.test(h)) return "GB";
  if (/\.europa\.eu$|\.eu$/.test(h)) return "EU";
  return "CA";
}

/** Readable placeholder title until the enricher reads the real one. */
export function provisionalTitle(url: URL): string {
  const host = url.hostname.replace(/^www\./, "");
  const slug = url.pathname.split("/").filter(Boolean).pop() ?? "";
  const words = decodeURIComponent(slug)
    .replace(/\.(html?|php|aspx?|jsp)$/i, "")
    .replace(/[-_+]+/g, " ")
    .trim();
  if (words.length > 3 && !/^\d+$/.test(words) && !/^index$/i.test(words)) {
    return words.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return `Opportunity at ${host}`;
}
