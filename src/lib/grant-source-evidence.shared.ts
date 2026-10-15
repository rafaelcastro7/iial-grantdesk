export type GrantSearchSource = { title: string; url: string };

/** Matching a domain is not evidence for a specific call. */
export function normalizeEvidenceUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_|^(fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return null;
  }
}

export function matchGrantSources(url: string, sources: GrantSearchSource[]) {
  const normalized = normalizeEvidenceUrl(url);
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = normalizeEvidenceUrl(source.url);
    if (!normalized || !key || key !== normalized || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}