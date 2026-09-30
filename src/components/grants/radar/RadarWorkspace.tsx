import { useState, type ReactNode } from "react";
import { ChevronDown, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import type { GrantRowData } from "@/components/grants/GrantRow";
import { DiscoveryProgress } from "@/components/grants/DiscoveryProgress";
import { EventLog } from "@/components/grants/EventLog";
import { FunderSelector } from "@/components/grants/FunderSelector";
import { NotebookLMBridge } from "@/components/grants/NotebookLMBridge";
import { Button } from "@/components/ui/button";
import {
  NEXT_ACTION_LABELS,
  countryName,
  formatMoney,
  type RadarResult,
} from "@/lib/grant-radar";
import { RadarCard, type RadarActions } from "./RadarCard";
import { RadarToolbar, type RadarFilterState } from "./RadarToolbar";

type Notice = { tone: "info" | "error"; text: string; onClose: () => void };

export function RadarWorkspace({
  radar,
  totalLoaded,
  filters,
  onFiltersChange,
  countries,
  sectors,
  actions,
  notices,
  profileBar,
  moreFilters,
  isAdmin,
  admin,
  searchMode,
  reviewProgress,
}: {
  radar: RadarResult<GrantRowData>;
  totalLoaded: number;
  filters: RadarFilterState;
  onFiltersChange: (next: RadarFilterState) => void;
  countries: string[];
  sectors: string[];
  actions: RadarActions;
  notices: Notice[];
  profileBar?: ReactNode;
  moreFilters?: ReactNode;
  /** Retrieval mode of a server search, when one is active. */
  searchMode?: string | null;
  reviewProgress?: ReactNode;
  isAdmin: boolean;
  admin: {
    activeJob: { jobId: string; queued: number } | null;
    discovering: boolean;
    selectedFunders: Set<string>;
    onSelectedFundersChange: (next: Set<string>) => void;
    onDiscover: () => void;
    onCloseJob: () => void;
  };
}) {
  const [showMore, setShowMore] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const { counts, next } = radar;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 md:px-6">
      <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-b px-5 py-5 sm:flex sm:flex-wrap sm:items-end sm:justify-between md:px-7">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
            Grant Radar
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Search, deterministic validation and critical requirements in one operational view.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <NotebookLMBridge />
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setShowSources((v) => !v)}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Update sources
            </Button>
          )}
        </div>
      </header>

      {isAdmin && showSources && (
        <section className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
          <span className="text-muted-foreground">Check official funder pages for new calls:</span>
          <FunderSelector
            fr={false}
            selected={admin.selectedFunders}
            onChange={admin.onSelectedFundersChange}
          />
          <Button size="sm" onClick={admin.onDiscover} disabled={admin.discovering}>
            {admin.discovering && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {admin.selectedFunders.size > 0
              ? `Check ${admin.selectedFunders.size} funder(s)`
              : "Check all funders"}
          </Button>
        </section>
      )}

      {admin.activeJob && (
        <DiscoveryProgress
          jobId={admin.activeJob.jobId}
          queued={admin.activeJob.queued}
          fr={false}
          onClose={admin.onCloseJob}
        />
      )}

      {notices.map((n, i) => (
        <div
          key={i}
          role="status"
          className={
            n.tone === "error"
              ? "flex items-start justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              : "flex items-start justify-between gap-3 rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground"
          }
        >
          <p className="break-words">{n.text}</p>
          <button type="button" onClick={n.onClose} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}

      {profileBar}

      {reviewProgress}

      <div className="grid grid-cols-2 border-b md:grid-cols-4 md:divide-x">
        <Stat label="You can apply" value={counts.eligible} tone="text-eligible" />
        <Stat label="Need a check" value={counts.needsInput} tone="text-needs-input" />
        <Stat label="Closing in your window" value={counts.closingSoon} tone="text-foreground" />
        <Stat label="Actionable value" value={counts.pipelineValue > 0 ? formatMoney(counts.pipelineValue) : "—"} tone="text-foreground" />
      </div>

      {next && (
        <section className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-primary">Do this next</p>
              <p className="font-medium text-foreground">
                {NEXT_ACTION_LABELS[next.nextAction]}: {next.grant.title}
              </p>
            </div>
          </div>
        </section>
      )}

      <div className="space-y-2 border-b px-4 py-4 md:px-7">
        <RadarToolbar
          value={filters}
          onChange={onFiltersChange}
          countries={countries}
          sectors={sectors}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
          <span data-search-mode={searchMode ?? undefined}>
            {searchMode && (searchMode === "hybrid" ? "Smart search · " : "Keyword search · ")}
            Showing {radar.items.length} of {totalLoaded}
            {radar.hiddenByAmount > 0 &&
              ` · ${radar.hiddenByAmount} below the minimum amount`}
            {radar.hiddenByFilters > 0 && ` · ${radar.hiddenByFilters} hidden by filters`}
          </span>
          {moreFilters && (
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              More filters
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showMore ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
        {showMore && moreFilters}
      </div>

      {radar.items.length === 0 ? (
        <EmptyState
          hasAny={totalLoaded > 0}
          isAdmin={isAdmin}
          onReset={() => onFiltersChange({ ...filters, country: "all", sector: "all", verdict: "all", status: "active", minAmount: 0, search: "" })}
          onDiscover={admin.onDiscover}
        />
      ) : (
        <div className="space-y-8 px-4 py-5 md:px-7">
          {radar.groups.map((group) => (
            <section key={group.country} className="space-y-3">
              <h2 className="flex items-baseline gap-2 border-b pb-2 font-display text-lg font-semibold text-foreground">
                {countryName(group.country)}
                <span className="text-sm font-normal text-muted-foreground">
                  {group.items.length}
                </span>
              </h2>
              <div className="space-y-2.5">
                {group.items.map((item) => (
                  <RadarCard
                    key={item.grant.id}
                    item={item}
                    actions={actions}
                    highlight={next?.grant.id === item.grant.id}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      </section>

      {isAdmin && (
        <details className="rounded-lg border bg-card p-3 text-sm">
          <summary className="cursor-pointer text-muted-foreground">Activity log</summary>
          <div className="mt-3">
            <EventLog fr={false} />
          </div>
        </details>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: ReactNode; tone: string }) {
  return (
    <div className="min-w-0 px-5 py-4">
      <p className={`font-display text-2xl font-semibold ${tone}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function EmptyState({
  hasAny,
  isAdmin,
  onReset,
  onDiscover,
}: {
  hasAny: boolean;
  isAdmin: boolean;
  onReset: () => void;
  onDiscover: () => void;
}) {
  return (
    <div className="rounded-lg border border-dashed bg-card p-10 text-center">
      <h2 className="font-display text-xl font-semibold text-foreground">
        {hasAny ? "Nothing matches these filters" : "No grants yet"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {hasAny
          ? "Try another country, lower the minimum amount, or clear the search."
          : "Check the official funder sources to bring in open calls."}
      </p>
      <div className="mt-4">
        {hasAny ? (
          <Button variant="outline" onClick={onReset}>
            Clear filters
          </Button>
        ) : isAdmin ? (
          <Button onClick={onDiscover}>Check all funders</Button>
        ) : (
          <p className="text-xs text-muted-foreground">Ask an admin to update the sources.</p>
        )}
      </div>
    </div>
  );
}
