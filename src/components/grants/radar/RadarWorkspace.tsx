import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { AlertCircle, Globe, Loader2, RefreshCw, X } from "lucide-react";
import type { GrantRowData } from "@/components/grants/GrantRow";
import { DiscoveryProgress } from "@/components/grants/DiscoveryProgress";
import { EventLog } from "@/components/grants/EventLog";
import { FunderSelector } from "@/components/grants/FunderSelector";
import { AddGrantModal } from "@/components/grants/AddGrantModal";
import { NotebookLMBridge } from "@/components/grants/NotebookLMBridge";
import { Button } from "@/components/ui/button";
import { countryName, formatMoney, type RadarFocus, type RadarResult } from "@/lib/grant-radar";
import { RadarCard, type RadarActions } from "./RadarCard";
import { RadarToolbar, webQueryForCountry, type RadarFilterState } from "./RadarToolbar";
import { WebScoutRadarCard } from "./WebScoutRadarCard";
import { searchWebGrants, type DiscoveredWebGrant } from "@/lib/grant-web-scout.functions";
import { addGrantByUrl } from "@/lib/grants.functions";
import { useActiveTenant } from "@/lib/tenant-context";
import { useTr, useUiLang } from "@/lib/ui-lang";

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
  focus,
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
  /** Countries and sectors of the grants the organization is working on. */
  focus?: RadarFocus | null;
  admin: {
    activeJob: { jobId: string; queued: number } | null;
    discovering: boolean;
    selectedFunders: Set<string>;
    onSelectedFundersChange: (next: Set<string>) => void;
    onDiscover: () => void;
    onCloseJob: () => void;
  };
}) {
  const tr = useTr();
  const lang = useUiLang();
  const [showSources, setShowSources] = useState(false);
  const [sourceMode, setSourceMode] = useState<"catalog" | "web">("catalog");
  const [webQuery, setWebQuery] = useState("");
  const [webResults, setWebResults] = useState<DiscoveredWebGrant[]>([]);
  const [isWebSearching, setIsWebSearching] = useState(false);
  const [webError, setWebError] = useState<string | null>(null);
  const [importingUrls, setImportingUrls] = useState<Set<string>>(new Set());
  const [importedMap, setImportedMap] = useState<Map<string, string>>(new Map());

  const { counts, next } = radar;
  const { activeOrgName, activeOrgId } = useActiveTenant();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const searchWebFn = useServerFn(searchWebGrants);
  const addGrantFn = useServerFn(addGrantByUrl);
  const orgName = activeOrgName || "IIAL";

  // In-flight guard as a ref: timers and effects never see a stale "not searching".
  const webInFlight = useRef(false);
  const autoWebFor = useRef("");
  const handleExecuteWebSearch = async (queryText?: string) => {
    const text = (queryText ?? webQuery).trim();
    if (!text || webInFlight.current) return;
    webInFlight.current = true;
    autoWebFor.current = text;

    setIsWebSearching(true);
    setWebError(null);
    try {
      const res = await searchWebFn({
        data: {
          query: text,
          orgId: activeOrgId ?? undefined,
          lang,
        },
      });

      if (!res.ok) {
        throw new Error(
          res.error ||
            tr(
              "Web search could not retrieve grant results.",
              "La búsqueda web no pudo obtener resultados de grants.",
            ),
        );
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
      webInFlight.current = false;
      setIsWebSearching(false);
    }
  };

  const [linkBusy, setLinkBusy] = useState(false);
  const linkInFlight = useRef(false);
  const handleSubmitSearch = async (raw: string) => {
    const q = raw.trim();
    if (!q) return;
    if (/^https?:\/\//i.test(q)) {
      const norm = (u: string) =>
        u
          .trim()
          .replace(/[#?].*$/, "")
          .replace(/\/+$/, "")
          .toLowerCase();
      const known = radar.items.find((i) => i.grant.url && norm(i.grant.url) === norm(q));
      if (known) {
        void navigate({ to: "/grants/$id", params: { id: known.grant.id } });
        return;
      }
      if (linkInFlight.current) return;
      linkInFlight.current = true;
      setLinkBusy(true);
      try {
        const res = await addGrantFn({ data: { url: q } });
        await queryClient.invalidateQueries({ queryKey: ["grants"] });
        void navigate({
          to: "/grants/$id",
          params: { id: res.grantId },
          search: { analyze: "1" } as never,
        });
      } catch (err) {
        setWebError(`link: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        linkInFlight.current = false;
        setLinkBusy(false);
      }
      return;
    }
    setWebQuery(q);
    void handleExecuteWebSearch(q);
  };

  // A search started on Today arrives here and runs on the internet at once.
  useEffect(() => {
    let q: string | null = null;
    let link: string | null = null;
    try {
      q = window.sessionStorage.getItem("grants.autoWeb");
      link = window.sessionStorage.getItem("grants.autoLink");
      window.sessionStorage.removeItem("grants.autoWeb");
      window.sessionStorage.removeItem("grants.autoLink");
    } catch {
      /* storage unavailable */
    }
    if (link) void handleSubmitSearch(link);
    else if (q) {
      setWebQuery(q);
      void handleExecuteWebSearch(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A search with nothing in the catalog goes to the web by itself (once per text).
  useEffect(() => {
    const q = filters.search.trim();
    if (q.length < 4 || /^https?:/i.test(q) || radar.items.length > 0 || isWebSearching) return;
    if (autoWebFor.current === q) return;
    const t = setTimeout(() => {
      if (autoWebFor.current === q || webInFlight.current) return;
      setWebQuery(q);
      void handleExecuteWebSearch(q);
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search, radar.items.length, isWebSearching]);

  const handleImportWebGrant = async (grant: DiscoveredWebGrant) => {
    setImportingUrls((prev) => new Set(prev).add(grant.url));
    try {
      const res = await addGrantFn({ data: { url: grant.url } });
      await queryClient.invalidateQueries({ queryKey: ["grants"] });
      setImportedMap((prev) => new Map(prev).set(grant.url, res.grantId));
    } catch (err: unknown) {
      setWebError(
        err instanceof Error
          ? err.message
          : tr(
              `Failed to import "${grant.title}" to Radar.`,
              `No se pudo importar "${grant.title}" al radar.`,
            ),
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
              {tr("Find grants", "Buscar grants")}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {sourceMode === "web"
                ? tr(
                    `Searching the internet with AI · for ${orgName}`,
                    `Exploración web en vivo con Google AI Search · Para ${orgName}`,
                  )
                : simple
                  ? tr(
                      `Each grant is already checked for ${orgName}. Green means you can apply.`,
                      `Cada grant ya está verificado para ${orgName}. Verde significa que puedes postular.`,
                    )
                  : tr(
                      "Search, deterministic validation and critical requirements in one operational view.",
                      "Búsqueda, validación determinista y requisitos críticos en una sola vista operativa.",
                    )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AddGrantModal />
            {!simple && <NotebookLMBridge />}
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => setShowSources((v) => !v)}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                {tr("Update sources", "Actualizar fuentes")}
              </Button>
            )}
          </div>
        </header>

        {isAdmin && showSources && (
          <section className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
            <span className="text-muted-foreground">
              {tr(
                "Check official funder pages for new calls:",
                "Revisar las páginas oficiales de los financiadores en busca de nuevas convocatorias:",
              )}
            </span>
            <FunderSelector
              fr={false}
              selected={admin.selectedFunders}
              onChange={admin.onSelectedFundersChange}
            />
            <Button size="sm" onClick={admin.onDiscover} disabled={admin.discovering}>
              {admin.discovering && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {admin.selectedFunders.size > 0
                ? tr(
                    `Check ${admin.selectedFunders.size} funder(s)`,
                    `Revisar ${admin.selectedFunders.size} financiador(es)`,
                  )
                : tr("Check all funders", "Revisar todos los financiadores")}
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
              <button type="button" onClick={n.onClose} aria-label={tr("Dismiss", "Cerrar")}>
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}

        {!simple && profileBar}

        {!simple && reviewProgress}

        {/* Counters */}
        {
          <div
            className={`grid border-b md:divide-x ${simple ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-5"}`}
          >
            <Stat
              label={tr("You can apply", "Puedes postular")}
              value={counts.eligible}
              tone="text-eligible"
            />
            <Stat
              label={tr("Need a check", "Requieren revisión")}
              value={counts.needsInput}
              tone="text-needs-input"
            />
            <Stat
              label={tr("Not a fit", "No encajan")}
              value={counts.notEligible}
              tone="text-destructive"
            />
            <Stat
              label={tr("Closing in your window", "Cierran en tu ventana")}
              value={counts.closingSoon}
              tone="text-foreground"
            />
            {!simple && (
              <Stat
                label={tr("Actionable value", "Valor accionable")}
                value={
                  counts.pipelineValue > 0 ? formatMoney(counts.pipelineValue, "CAD", lang) : "—"
                }
                tone="text-foreground"
              />
            )}
          </div>
        }

        {/* Integrated Toolbar */}
        <div className="space-y-2 border-b px-4 py-4 md:px-7">
          <RadarToolbar
            value={filters}
            onChange={onFiltersChange}
            countries={countries}
            sectors={sectors}
            sourceMode="catalog"
            onSubmitSearch={handleSubmitSearch}
            webQuery={webQuery}
            onWebQueryChange={setWebQuery}
            onWebSearch={handleExecuteWebSearch}
            isWebSearching={isWebSearching}
            totalCatalogLoaded={totalLoaded}
            focus={focus}
            moreFilters={simple ? undefined : moreFilters}
          />

          {
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
              <span data-search-mode={searchMode ?? undefined}>
                {searchMode &&
                  (searchMode === "hybrid"
                    ? tr("Smart search · ", "Búsqueda inteligente · ")
                    : tr("Keyword search · ", "Búsqueda por palabras clave · "))}
                {tr(
                  `Showing ${radar.items.length} of ${totalLoaded}`,
                  `Mostrando ${radar.items.length} de ${totalLoaded}`,
                )}
                {radar.hiddenByAmount > 0 &&
                  tr(
                    ` · ${radar.hiddenByAmount} below the minimum amount`,
                    ` · ${radar.hiddenByAmount} bajo el monto mínimo`,
                  )}
                {radar.hiddenByFilters > 0 &&
                  tr(
                    ` · ${radar.hiddenByFilters} hidden by filters`,
                    ` · ${radar.hiddenByFilters} ocultos por los filtros`,
                  )}
              </span>
            </div>
          }
        </div>

        <div className="flex flex-col">
          {linkBusy && (
            <div
              role="status"
              className="flex items-center gap-2 border-b px-4 py-3 text-sm text-muted-foreground md:px-7"
            >
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              {tr(
                "Opening the link and reading the call…",
                "Abriendo el enlace y leyendo la convocatoria…",
              )}
            </div>
          )}
          {/* Catalog results */}
          {radar.items.length === 0 ? (
            <EmptyState
              hasAny={totalLoaded > 0}
              hasWebResults={webResults.length > 0}
              isAdmin={isAdmin}
              searchQuery={
                filters.search ||
                (filters.country !== "all" ? webQueryForCountry(filters.country) : "")
              }
              countryLabel={
                filters.country !== "all" ? countryName(filters.country, lang) : undefined
              }
              onSearchWeb={(q) => {
                setWebQuery(q);
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
                    {countryName(group.country, lang)}
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
          )}

          {/* The same search on the web: always one click away, automatic when the catalog has nothing. */}
          {(isWebSearching || webResults.length > 0 || !!webError || !!filters.search) && (
            <div
              className={`space-y-5 px-4 py-5 md:px-7 ${isWebSearching || webResults.length > 0 || webError ? "order-first border-b" : "border-t"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                  <Globe className="h-4 w-4 text-primary" />
                  {tr("From the internet", "En internet")}
                </h2>
                {(webQuery || filters.search) && !isWebSearching && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={() => handleExecuteWebSearch(webQuery || filters.search)}
                  >
                    <Globe className="h-3.5 w-3.5" />
                    {tr("Search the web for", "Buscar en la web")} &ldquo;
                    {webQuery || filters.search}
                    &rdquo;
                  </Button>
                )}
              </div>
              {/* Error display */}
              {webError && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="space-y-1">
                    <p className="font-semibold">
                      {webError.startsWith("link:")
                        ? tr("Could not add this link", "No se pudo agregar este enlace")
                        : tr(
                            "Web search could not retrieve opportunities",
                            "La búsqueda web no pudo obtener oportunidades",
                          )}
                    </p>
                    <p>{webError.replace(/^link:\s*/, "")}</p>
                  </div>
                </div>
              )}

              {/* Searching indicator */}
              {isWebSearching && (
                <div className="my-12 flex flex-col items-center justify-center gap-3 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      {tr(
                        "Searching the internet… (up to a minute)",
                        "Buscando en internet… (hasta un minuto)",
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground max-w-md">
                      {tr(
                        `Identifying active announcements, deadlines, amounts, and RFP requirements for ${orgName}.`,
                        `Identificando convocatorias activas, fechas límite, montos y requisitos para ${orgName}.`,
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Discovered results list */}
              {!isWebSearching && webResults.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b pb-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {tr(
                        `Discovered ${webResults.length} funding opportunities on the live web`,
                        `Se encontraron ${webResults.length} oportunidades de financiamiento en la web`,
                      )}
                    </span>
                    <span>{tr(`Targeted for ${orgName}`, `Para ${orgName}`)}</span>
                  </div>

                  {/* The overview Rocío asked ChatGPT for: one row per opportunity. */}
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[820px] text-left text-sm">
                      <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2">{tr("Opportunity", "Oportunidad")}</th>
                          <th className="px-3 py-2">{tr("Status", "Estado")}</th>
                          <th className="px-3 py-2">{tr("Deadline", "Cierre")}</th>
                          <th className="px-3 py-2">{tr("Who applies", "Quién aplica")}</th>
                          <th className="px-3 py-2">{tr("Amount and type", "Monto y tipo")}</th>
                          <th className="px-3 py-2">{tr("Link", "Enlace")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {webResults.map((g) => (
                          <tr key={g.url} className="align-top">
                            <td className="px-3 py-2">
                              <div className="font-medium">{g.title}</div>
                              <div className="text-xs text-muted-foreground">
                                {g.funder} · {g.country}
                              </div>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {g.status === "open"
                                ? tr("Open", "Abierta")
                                : g.status === "upcoming"
                                  ? tr("Upcoming", "Por abrir")
                                  : g.status === "continuous"
                                    ? tr("Continuous", "Continua")
                                    : tr("Closed", "Cerrada")}
                            </td>
                            <td className="px-3 py-2">{g.deadline}</td>
                            <td className="px-3 py-2">{g.applicant || "—"}</td>
                            <td className="px-3 py-2">{g.amount_range}</td>
                            <td className="px-3 py-2">
                              <a
                                href={g.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline"
                              >
                                {tr("Official page", "Página oficial")}
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tr(
                      "Found by AI on the internet: verify amounts and dates on the official page. Import one to analyze it and prepare its dossier.",
                      "Encontrado con IA en internet: verifique montos y fechas en la página oficial. Importe uno para analizarlo y preparar su dossier.",
                    )}
                  </p>

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
            </div>
          )}
        </div>
      </section>

      {isAdmin && !simple && (
        <details className="rounded-lg border bg-card p-3 text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            {tr("Activity log", "Registro de actividad")}
          </summary>
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
  hasWebResults,
  isAdmin,
  searchQuery,
  countryLabel,
  onReset,
  onDiscover,
  onSearchWeb,
}: {
  hasAny: boolean;
  hasWebResults?: boolean;
  isAdmin: boolean;
  searchQuery?: string;
  /** The chosen country, when the empty result is for one country. */
  countryLabel?: string;
  onReset: () => void;
  onDiscover: () => void;
  onSearchWeb?: (query: string) => void;
}) {
  const tr = useTr();
  return (
    <div className="px-4 py-16 text-center md:px-7">
      <p className="font-display text-lg font-semibold text-foreground">
        {countryLabel
          ? tr(
              `No tracked grants for ${countryLabel} yet`,
              `Aún no hay grants seguidos para ${countryLabel}`,
            )
          : searchQuery
            ? tr(
                `No grants in the system match "${searchQuery}"`,
                `Ningún grant del sistema coincide con "${searchQuery}"`,
              )
            : hasAny
              ? tr("No matching grants", "No hay grants que coincidan")
              : tr("No grants in the system yet", "Aún no hay grants en el sistema")}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {countryLabel
          ? tr(
              "Search the live web for calls in this country, then import the ones that fit.",
              "Busca convocatorias de este país en la web y luego importa las que encajen.",
            )
          : hasWebResults
            ? tr(
                "The internet results are above. You can also loosen the filters.",
                "Los resultados de internet están arriba. También puede ampliar los filtros.",
              )
            : searchQuery || hasAny
              ? tr(
                  "Try other words or loosen the filters, or search the internet.",
                  "Pruebe con otras palabras o amplíe los filtros, o busque en internet.",
                )
              : tr(
                  "Tracked opportunities will appear here once ingested or imported.",
                  "Las oportunidades seguidas aparecerán aquí cuando se ingresen o importen.",
                )}
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {searchQuery && onSearchWeb && (
          <Button size="sm" onClick={() => onSearchWeb(searchQuery)} className="gap-1.5 shadow-sm">
            <Globe className="h-4 w-4" />
            {tr("Search live web for", "Buscar en la web")} &ldquo;{searchQuery}&rdquo;
          </Button>
        )}
        {hasAny && (
          <Button variant="outline" size="sm" onClick={onReset}>
            {tr("Reset filters", "Restablecer filtros")}
          </Button>
        )}
        {isAdmin && !hasAny && (
          <Button size="sm" onClick={onDiscover}>
            {tr("Discover grants", "Descubrir grants")}
          </Button>
        )}
      </div>
    </div>
  );
}
