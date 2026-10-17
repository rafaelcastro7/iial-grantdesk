// Deterministic rules the grant agent applies to results, kept outside the
// model so they are testable and identical on every run.

export type AgentGrantCard = {
  id: string | null;
  title: string;
  funder: string;
  country: string;
  url: string;
  summary: string;
  amount: string;
  deadline: string;
  status: string;
  fit: number | null;
  origin: "catalog" | "web_verified" | "web_unverified";
};

/** Web results are "verified" only when an exact-URL citation backs them. */
export function webOrigin(sourceMatch: string | undefined): AgentGrantCard["origin"] {
  return sourceMatch === "grounded" ? "web_verified" : "web_unverified";
}

/** The catalog is always searched first; the web only when it brings few results or the user asks for new ones. */
export function shouldSearchWeb(catalogCount: number, userAskedForNew: boolean): boolean {
  return userAskedForNew || catalogCount < 3;
}

/** One currency family per range; unknown stays explicitly unpublished. */
export function formatAmount(
  min: number | null | undefined,
  max: number | null | undefined,
  currency: string | null | undefined,
  lang: "en" | "es",
): string {
  const none = lang === "es" ? "No publicado" : "Not published";
  if (min == null && max == null) return none;
  const cur = currency || "";
  const fmt = (n: number) => n.toLocaleString(lang === "es" ? "es-ES" : "en-CA");
  if (min != null && max != null && min !== max) return `${fmt(min)}–${fmt(max)} ${cur}`.trim();
  return `${lang === "es" ? "Hasta" : "Up to"} ${fmt((max ?? min) as number)} ${cur}`.trim();
}

/** Remove grants the user already dismissed; never re-suggest them. */
export function withoutDismissed<T extends { id: string | null }>(cards: T[], dismissed: Set<string>): T[] {
  return cards.filter((c) => !c.id || !dismissed.has(c.id));
}

/** Grant ids that a watch has not reported yet. */
export function newForWatch(found: string[], seen: string[]): string[] {
  const s = new Set(seen);
  return [...new Set(found)].filter((id) => !s.has(id));
}
