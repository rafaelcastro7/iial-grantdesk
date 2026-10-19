// Rescue-provider bookkeeping (0 tokens): which fallback chat provider to try
// next, and how long to rest one that ran out of quota. Kept in memory per
// worker isolate; a cold start simply retries every provider.

const DEFAULT_REST_MS = 60_000;
const MAX_REST_MS = 6 * 60 * 60_000;

/** Parse "try again in 11m57.12s" / "in 3m20s" / "in 45s" / "1h2m" → ms. */
export function retryAfterMs(message: string): number | null {
  const m = /try again in\s+((?:\d+(?:\.\d+)?[hms]\s*)+)/i.exec(message);
  if (!m) return null;
  let ms = 0;
  for (const [, n, unit] of m[1].matchAll(/(\d+(?:\.\d+)?)([hms])/g)) {
    ms += Number(n) * (unit === "h" ? 3_600_000 : unit === "m" ? 60_000 : 1000);
  }
  return ms > 0 ? Math.min(ms, MAX_REST_MS) : null;
}

/** Errors worth switching provider for: quota, auth, model gone, server side. */
export function isProviderFailure(error: unknown): boolean {
  const e = error as { statusCode?: number; message?: string } | null;
  const status = e?.statusCode;
  if (typeof status === "number") return status === 401 || status === 402 || status === 403 || status === 404 || status === 408 || status === 429 || status >= 500;
  return /rate limit|quota|exhausted|429|402|unavailable|overloaded|timeout|fetch failed/i.test(e?.message ?? String(error));
}

export class ProviderRest {
  private until = new Map<string, number>();
  constructor(private now: () => number = Date.now) {}

  rest(name: string, error: unknown) {
    const msg = (error as { message?: string } | null)?.message ?? String(error);
    this.until.set(name, this.now() + (retryAfterMs(msg) ?? DEFAULT_REST_MS));
  }

  /** Providers in preference order, rested ones last (never dropped). */
  order<T extends { name: string }>(providers: T[]): T[] {
    const t = this.now();
    const ready = providers.filter((p) => (this.until.get(p.name) ?? 0) <= t);
    const resting = providers.filter((p) => (this.until.get(p.name) ?? 0) > t);
    return [...ready, ...resting];
  }
}
