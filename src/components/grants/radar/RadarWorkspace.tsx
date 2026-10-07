import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ChevronDown,
  Globe,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import type { GrantRowData } from "@/components/grants/GrantRow";
import { DiscoveryProgress } from "@/components/grants/DiscoveryProgress";
import { EventLog } from "@/components/grants/EventLog";
import { FunderSelector } from "@/components/grants/FunderSelector";
import { AddGrantModal } from "@/components/grants/AddGrantModal";
import { NotebookLMBridge } from "@/components/grants/NotebookLMBridge";
import { Button } from "@/components/ui/button";
import { NEXT_ACTION_LABELS, countryName, formatMoney, type RadarResult } from "@/lib/grant-radar";
import { RadarCard, type RadarActions } from "./RadarCard";
import { RadarToolbar, QUICK_SCOUT_PROMPTS, type RadarFilterState } from "./RadarToolbar";
import { WebScoutRadarCard } from "./WebScoutRadarCard";
import { searchWebGrants, type DiscoveredWebGrant } from "@/lib/grant-web-scout.functions";
import { addGrantByUrl } from "@/lib/grants.functions";
import { useActiveTenant } from "@/lib/tenant-context";

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
  simple = false,
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
  /** Consultant mode: only what is needed to spot and open good grants. */
  simple?: boolean;
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
  const [sourceMode, setSourceMode] = useState<"catalog" | "web">("catalog");
  const [webQuery, setWebQuery] = useState("");
  const [webResults, setWebResults] = useState<DiscoveredWebGrant[]>([]);
  const [isWebSearching, setIsWebSearching] = useState(false);
  const [webError, setWebError] = useState<string | null>(null);
  const [importingUrls, setImportingUrls] = useState<Set<string>>(new Set());
  const [importedMap, setImportedMap] = useState<Map<string, string>>(new Map());

  const { counts, next } = radar;
  const { activeTenant, activeOrgId } = useActiveTenant();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const searchWebFn = useServerFn(searchWebGrants);
  const addGrantFn = useServerFn(addGrantByUrl);
  const orgName = activeTenant?.legal_name || "IIAL";

  const handleExecuteWebSearch = async (queryText?: string) => {
    const text = (queryText ?? webQuery).trim();
    if (!text || isWebSearching) return;

    setIsWebSearching(true);
    setWebError(null);
    try {
      const res = await searchWebFn({
        data: {
          query: text,
          orgId: activeOrgId ?? undefined,
        },
      });

      if (!res.ok) {
        throw new Error(res.error || "Web search could not retrieve grant results.");
      }

      setWebResults(res.grants);

      // Pre-populate already imported grants
      const existing = new Map<string, string>();
      for (const g of res.grants) {
        if (g.alreadyInCatalog && g.existingGrantId) {
          existing.set(g.url, g.existingGrantId);
        }
      }
      setImportedMap(existing);
    } catch (err: unknown) {
      setWebError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsWebSearching(false);
    }
  };

  const handleImportWebGrant = async (grant: DiscoveredWebGrant) => {
    setImportingUrls((prev) => new Set(prev).add(grant.url));
    try {
      const res = await addGrantFn({ data: { url: grant.url } });
      await queryClient.invalidateQueries({ queryKey: ["grants"] });
      setImportedMap((prev) => new Map(prev).set(grant.url, res.grantId));
    } catch (err: unknown) {
      setWebError(
        err instanceof Error ? err.message : `Failed to import "${grant.title}" to Radar.`,
      );
    } finally {
      setImportingUrls((prev) => {
        const next = new Set(prev);
        next.delete(grant.url);
        return next;
      });
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 md:px-6">
      <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-b px-5 py-5 sm:flex sm:flex-wrap sm:items-end sm:justify-between md:px-7">
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
              Grant Radar
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {sourceMode === "web"
                ? `Live web exploration powered by Google AI Search · Targeting ${orgName}`
                : simple
                  ? `Every opportunity is already checked against ${orgName}'s rules. Start with the green ones.`
                  : "Search, deterministic validation and critical requirements in one operational view."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AddGrantModal />
            {!simple && <NotebookLMBridge />}
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
            <span className="text-muted-foreground">
              Check official funder pages for new calls:
            </span>
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

        {notices
          .filter((n) => !simple || n.tone === "error")
          .map((n, i) => (
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

        {!simple && profileBar}

        {!simple && reviewProgress}

        {/* Dynamic stats row */}
        {sourceMode === "web" ? (
          <div className="grid grid-cols-2 border-b md:grid-cols-4 md:divide-x bg-muted/20">
            <Stat
              label="Live Web Discoveries"
              value={webResults.length}
              tone="text-primary font-bold"
            />
            <Stat label="Active Client Scope" value={orgName} tone="text-foreground" />
            <Stat label="Scout Engine" value="Google Search" tone="text-emerald-600" />
            <Stat
              label="Pipeline Action"
              value="1-Click Import"
              tone="text-foreground"
            />
          </div>
        ) : (
          <div
            className={`grid border-b md:divide-x ${simple ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-5"}`}
          >
            <Stat label="You can apply" value={counts.eligible} tone="text-eligible" />
            <Stat label="Need a check" value={counts.needsInput} tone="text-needs-input" />
            <Stat label="Not a fit" value={counts.notEligible} tone="text-destructive" />
            <Stat
              label="Closing in your window"
              value={counts.closingSoon}
              tone="text-foreground"
            />
            {!simple && (
              <Stat
                label="Actionable value"
                value={counts.pipelineValue > 0 ? formatMoney(counts.pipelineValue) : "—"}
                tone="text-foreground"
              />
            )}
          </div>
        )}

        {next && sourceMode === "catalog" && (
          <section className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-primary">
                  Do this next
                </p>
                <p className="font-medium text-foreground">
                  {simple ? "Best match right now" : NEXT_ACTION_LABELS[next.nextAction]}:{" "}
                  {next.grant.title}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Integrated Toolbar */}
        <div className="space-y-2 border-b px-4 py-4 md:px-7">
          <RadarToolbar
            value={filters}
            onChange={onFiltersChange}
            countries={countries}
            sectors={sectors}
            sourceMode={sourceMode}
            onSourceModeChange={setSourceMode}
            webQuery={webQuery}
            onWebQueryChange={setWebQuery}
            onWebSearch={handleExecuteWebSearch}
            isWebSearching={isWebSearching}
            totalCatalogLoaded={totalLoaded}
          />

          {sourceMode === "catalog" && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
              <span data-search-mode={searchMode ?? undefined}>
                {searchMode && (searchMode === "hybrid" ? "Smart search · " : "Keyword search · ")}
                Showing {radar.items.length} of {totalLoaded}
                {radar.hiddenByAmount > 0 && ` · ${radar.hiddenByAmount} below the minimum amount`}
                {radar.hiddenByFilters > 0 && ` · ${radar.hiddenByFilters} hidden by filters`}
              </span>
              {moreFilters && !simple && (
                <button
                  type="button"
                  onClick={() => setShowMore((v) => !v)}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  More filters
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${showMore ? "rotate-180" : ""}`}
                  />
                </button>
              )}
            </div>
          )}

          {showMore && !simple && moreFilters && sourceMode === "catalog"}
        </div>

        {/* MAIN BODY: SourceMode Switch */}
        {sourceMode === "web" ? (
          <div className="space-y-5 px-4 py-5 md:px-7">
            {/* Error display */}
            {webError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-1">
                  <p className="font-semibold">Web search could not retrieve opportunities</p>
                  <p>{webError}</p>
                </div>
              </div>
            )}

            {/* Searching indicator */}
            {isWebSearching && (
              <div className="my-12 flex flex-col items-center justify-center gap-3 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    Browsing the live internet via Google Search Grounding...
                  </p>
                  <p className="text-xs text-muted-foreground max-w-md">
                    Identifying active announcements, deadlines, amounts, and RFP requirements for{" "}
                    {orgName}.
                  </p>
                </div>
              </div>
            )}

            {/* Discovered results list */}
            {!isWebSearching && webResults.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Discovered {webResults.length} funding opportunities on the live web
                  </span>
                  <span>Targeted for {orgName}</span>
                </div>

                <div className="space-y-3">
                  {webResults.map((grant) => (
                    <WebScoutRadarCard
                      key={grant.url}
                      grant={grant}
                      orgName={orgName}
                      importedId={importedMap.get(grant.url)}
                      isImporting={importingUrls.has(grant.url)}
                      onImport={handleImportWebGrant}
                      onOpenWorkspace={(id) => navigate({ to: "/grants/$id", params: { id } })}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty web state / prompt guide */}
            {!isWebSearching && webResults.length === 0 && !webError && (
              <div className="my-10 rounded-xl border border-dashed p-8 text-center bg-muted/20">
                <Globe className="mx-auto h-10 w-10 text-muted-foreground/60 mb-3" />
                <h3 className="font-display text-lg font-semibold text-foreground mb-1">
                  Live Web Grant Scout
                </h3>
                <p className="text-xs text-muted-foreground max-w-lg mx-auto mb-5">
                  Type any topic in the search bar above (just like you did in ChatGPT) or select one
                  of the quick queries below to browse open and upcoming opportunities in real-time.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {QUICK_SCOUT_PROMPTS.map((p) => (
                    <Button
                      key={p.label}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setWebQuery(p.query);
                        handleExecuteWebSearch(p.query);
                      }}
                      className="text-xs"
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Normal Catalog Groups */
          radar.items.length === 0 ? (
            <EmptyState
              hasAny={totalLoaded > 0}
              isAdmin={isAdmin}
              searchQuery={filters.search}
              onSearchWeb={(q) => {
                setWebQuery(q);
                setSourceMode("web");
                handleExecuteWebSearch(q);
              }}
              onReset={() =>
                onFiltersChange({
                  ...filters,
                  country: "all",
                  sector: "all",
                  verdict: "all",
                  status: "active",
                  minAmount: 0,
                  search: "",
                })
              }
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
                        simple={simple}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )
        )}
      </section>

      {isAdmin && !simple && (
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
  searchQuery,
  onReset,
  onDiscover,
  onSearchWeb,
}: {
  hasAny: boolean;
  isAdmin: boolean;
  searchQuery?: string;
  onReset: () => void;
  onDiscover: () => void;
  onSearchWeb?: (query: string) => void;
}) {
  return (
    <div className="px-4 py-16 text-center md:px-7">
      <p className="font-display text-lg font-semibold text-foreground">
        {hasAny ? "No matching grants" : "No grants in the radar yet"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {hasAny
          ? "Try loosening filters, or scout the live web for newly announced calls."
          : "Tracked opportunities will appear here once ingested or imported."}
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {searchQuery && onSearchWeb && (
          <Button
            size="sm"
            onClick={() => onSearchWeb(searchQuery)}
            className="gap-1.5 shadow-sm"
          >
            <Globe className="h-4 w-4" />
            Search live web for &ldquo;{searchQuery}&rdquo;
          </Button>
        )}
        {hasAny && (
          <Button variant="outline" size="sm" onClick={onReset}>
            Reset filters
          </Button>
        )}
        {isAdmin && !hasAny && (
          <Button size="sm" onClick={onDiscover}>
            Discover grants
          </Button>
        )}
      </div>
    </div>
  );
}
