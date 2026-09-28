import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { getCoverage } from "@/lib/catalog.functions";
import { refreshCatalog } from "@/lib/refresh.functions";
import { accessToken } from "@/lib/session";
import { errorMessage } from "@/lib/error-message";
import type { MarketCoverage } from "@/lib/coverage";
import { meta } from "@/lib/head";

export const Route = createFileRoute("/catalog")({
  component: CatalogPage,
  head: () => meta(
    "Funder coverage — Grant Desk",
    "Which markets Grant Desk refreshes automatically, which are directory-only, and how many open calls are in the catalog right now.",
  ),
});

const LEVEL_STYLE: Record<MarketCoverage["level"], { label: string; className: string }> = {
  automatic: { label: "Automatic", className: "text-[var(--color-eligible)]" },
  partial: { label: "Out of date", className: "text-[var(--color-needs-input)]" },
  "directory-only": { label: "Directory only", className: "text-[var(--color-ink-soft)]" },
};

const MARKET_NAMES: Record<string, string> = {
  CA: "Canada",
  US: "United States",
  INTL: "Multilateral",
  MX: "Mexico",
  BR: "Brazil",
};

/**
 * Coverage, stated plainly.
 *
 * This page exists because the predecessor advertised a catalog it did not
 * have — 699 funders of which search could reach five. A consultant deciding
 * where to spend an hour is entitled to know which markets we actually refresh
 * and which are a directory with a link.
 */
function CatalogPage() {
  const fetchCoverage = useServerFn(getCoverage);
  const refresh = useServerFn(refreshCatalog);
  const [data, setData] = useState<{ coverage: MarketCoverage[]; totalGrants: number } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNote, setRefreshNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await fetchCoverage({ data: {} }));
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }, [fetchCoverage]);

  useEffect(() => {
    void load();
  }, [load]);

  // No nightly daemon here, so the refresh is a deliberate act with a visible
  // result: a consultant who suspects the catalog is stale can prove it.
  async function runRefresh() {
    setRefreshing(true);
    setRefreshNote(null);
    setError(null);
    try {
      const token = await accessToken();
      const result = await refresh({ data: { accessToken: token } });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const grants = result.sources.reduce((total, source) => total + source.grants, 0);
      setRefreshNote(
        `${grants.toLocaleString()} calls checked, ${result.embedded.embedded.toLocaleString()} re-indexed.`,
      );
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setRefreshing(false);
    }
  }


  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Where our results come from</h1>
      <p className="mt-2 max-w-prose text-sm text-[var(--color-ink-soft)]">
        Each market says what it really is. A market we do not refresh automatically is listed as a
        directory, not padded out to look like the rest.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void runRefresh()}
          disabled={refreshing}
          className="rounded-md border border-[var(--color-rule)] px-3 py-1.5 text-sm font-medium disabled:opacity-60"
        >
          {refreshing ? "Refreshing…" : "Refresh the catalog"}
        </button>
        {refreshNote && (
          <span className="text-sm text-[var(--color-ink-soft)]">{refreshNote}</span>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-6 text-sm text-[var(--color-ineligible)]">
          {error}
        </p>
      )}


      {data && (
        <>
          <p className="mt-6 text-sm">
            <span data-testid="total-grants" className="font-mono tabular-nums">
              {data.totalGrants.toLocaleString()}
            </span>{" "}
            open calls in the catalog.
          </p>

          <ul
            data-testid="coverage-list"
            className="mt-4 flex flex-col gap-px overflow-hidden rounded-md border border-[var(--color-rule)] bg-[var(--color-rule)]"
          >
            {data.coverage.map((market) => {
              const style = LEVEL_STYLE[market.level];
              return (
                <li key={market.market} className="bg-[var(--color-surface)] px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">
                      {MARKET_NAMES[market.market] ?? market.market}
                    </span>
                    <span className={`text-xs font-medium ${style.className}`}>{style.label}</span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{market.statement}</p>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {data === null && !error && (
        <p className="mt-6 text-sm text-[var(--color-ink-soft)]">Loading…</p>
      )}
    </main>
  );
}
