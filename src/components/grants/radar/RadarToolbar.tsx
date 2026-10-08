import { useState, type ReactNode } from "react";
import {
  ChevronDown,
  Globe,
  Loader2,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  countryName,
  type RadarFocus,
  type RadarStatusFilter,
  type RadarVerdictFilter,
} from "@/lib/grant-radar";
import { useTr, useUiLang, type UiLang } from "@/lib/ui-lang";

export type RadarFilterState = {
  search: string;
  country: string;
  sector: string;
  minAmount: number;
  leadTimeWeeks: number;
  status: RadarStatusFilter;
  verdict: RadarVerdictFilter;
};

export const DEFAULT_RADAR_FILTERS: RadarFilterState = {
  search: "",
  country: "all",
  sector: "all",
  minAmount: 0,
  leadTimeWeeks: 4,
  status: "active",
  verdict: "all",
};

export const QUICK_SCOUT_PROMPTS = [
  {
    label: "🌾 Canada Agri-Food 2026",
    labelEs: "🌾 Agroalimentario Canadá 2026",
    query: "Canada agriculture and food innovation grant calls 2026 sustainable food distribution",
  },
  {
    label: "🍫 Cacao & Bioeconomy (Peru/LATAM)",
    labelEs: "🍫 Cacao y bioeconomía (Perú/LATAM)",
    query:
      "Convocatorias y grants de cacao, bioeconomia y agricultura sostenible en Peru o Latinoamerica 2026",
  },
  {
    label: "🎓 Canadian Academic Consortium",
    labelEs: "🎓 Consorcio académico canadiense",
    query: "Canadian college research partnership grants SSHRC agri-food applied research 2026",
  },
  {
    label: "🌍 GAC & International Rolling Calls",
    labelEs: "🌍 GAC y convocatorias internacionales continuas",
    query:
      "Global Affairs Canada international assistance unsolicited concept notes CFLI Peru 2026",
  },
];

/** Web query suggested for a country with no grants in the catalog. */
export function webQueryForCountry(code: string): string {
  return `grants ${countryName(code)} agri-food 2026 2027`;
}

const MIN_AMOUNTS = [0, 25_000, 50_000, 100_000, 500_000];
const LEAD_TIMES = [2, 4, 6, 8, 12];
const STATUS_LABELS: Record<RadarStatusFilter, [string, string]> = {
  active: ["In progress", "En curso"],
  new: ["New leads", "Nuevas oportunidades"],
  pursuing: ["Pursuing", "En postulación"],
  upcoming: ["Upcoming cycles", "Próximos ciclos"],
  closed: ["Finished", "Finalizados"],
  all: ["Everything", "Todo"],
};
const VERDICT_FILTER_LABELS: Record<RadarVerdictFilter, [string, string]> = {
  all: ["Any verdict", "Cualquier veredicto"],
  eligible: ["You can apply", "Puedes postular"],
  needs_input: ["Needs a check", "Requiere revisión"],
  not_eligible: ["Not a fit", "No encaja"],
};

const label2 = (pair: [string, string], lang: UiLang) => (lang === "es" ? pair[1] : pair[0]);

function money(n: number, lang: UiLang) {
  if (n === 0) return lang === "es" ? "Cualquier monto" : "Any amount";
  const v = `$${n >= 1000 ? `${n / 1000}K` : n}`;
  return lang === "es" ? `Desde ${v}` : `From ${v}`;
}

function Pick<T extends string | number>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
  label: string;
  className?: string;
}) {
  return (
    <Select
      value={String(value)}
      onValueChange={(v) => {
        const found = options.find((o) => String(o.value) === v);
        if (found) onChange(found.value);
      }}
    >
      <SelectTrigger aria-label={label} className={className ?? "h-9 w-auto min-w-[140px]"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={String(o.value)} value={String(o.value)}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function RadarToolbar({
  value,
  onChange,
  countries,
  sectors,
  sourceMode = "catalog",
  onSourceModeChange,
  webQuery = "",
  onWebQueryChange,
  onWebSearch,
  onSubmitSearch,
  isWebSearching = false,
  totalCatalogLoaded = 0,
  focus,
  moreFilters,
}: {
  value: RadarFilterState;
  onChange: (next: RadarFilterState) => void;
  countries: string[];
  sectors: string[];
  sourceMode?: "catalog" | "web";
  onSourceModeChange?: (mode: "catalog" | "web") => void;
  webQuery?: string;
  onWebQueryChange?: (q: string) => void;
  onWebSearch?: (q?: string) => void;
  /** Enter in the search box: a link opens or adds the grant; text searches (and the web if needed). */
  onSubmitSearch?: (q: string) => void;
  isWebSearching?: boolean;
  totalCatalogLoaded?: number;
  /** Countries and sectors of the grants the organization is working on. */
  focus?: RadarFocus | null;
  /** Extra filters (facets, toggles) shown under "More filters". */
  moreFilters?: ReactNode;
}) {
  const tr = useTr();
  const lang = useUiLang();
  const [showMore, setShowMore] = useState(false);
  const set = <K extends keyof RadarFilterState>(k: K, v: RadarFilterState[K]) =>
    onChange({ ...value, [k]: v });

  const chips: Array<{ key: keyof RadarFilterState; label: string }> = [];
  if (value.country !== "all")
    chips.push({ key: "country", label: countryName(value.country, lang) });
  if (value.sector !== "all") chips.push({ key: "sector", label: value.sector });
  if (value.verdict !== DEFAULT_RADAR_FILTERS.verdict)
    chips.push({ key: "verdict", label: label2(VERDICT_FILTER_LABELS[value.verdict], lang) });
  if (value.status !== DEFAULT_RADAR_FILTERS.status)
    chips.push({ key: "status", label: label2(STATUS_LABELS[value.status], lang) });
  if (value.minAmount !== DEFAULT_RADAR_FILTERS.minAmount)
    chips.push({ key: "minAmount", label: money(value.minAmount, lang) });

  // Focus sectors may not be in this page of results; still offer them.
  const sectorOptions = [...sectors];
  for (const s of [...(focus?.sectors ?? []), value.sector]) {
    if (s && s !== "all" && !sectorOptions.some((o) => o.toLowerCase() === s.toLowerCase()))
      sectorOptions.push(s);
  }
  const hiddenActive =
    value.status !== DEFAULT_RADAR_FILTERS.status ||
    value.minAmount !== DEFAULT_RADAR_FILTERS.minAmount;
  const hasFocus = !!focus && (focus.countries.length > 0 || focus.sectors.length > 0);

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3 shadow-sm">
      {/* Integrated Source Switcher: Catalog vs Live Web Scout */}
      {onSourceModeChange && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
          <div className="flex items-center gap-1.5 rounded-lg border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => onSourceModeChange("catalog")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                sourceMode === "catalog"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              <span>{tr("Tracked Catalog", "Catálogo seguido")}</span>
              {totalCatalogLoaded > 0 && (
                <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground">
                  {totalCatalogLoaded}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onSourceModeChange("web")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                sourceMode === "web"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Globe className="h-3.5 w-3.5" />
              <span>{tr("AI Web Scout (Live Internet)", "Búsqueda web con IA (en vivo)")}</span>
              <span className="inline-flex items-center gap-0.5 rounded bg-primary-foreground/20 px-1.5 py-0.2 text-[10px]">
                <Sparkles className="h-2.5 w-2.5" /> Google AI
              </span>
            </button>
          </div>

          {sourceMode === "catalog" && value.search && onWebQueryChange && onWebSearch && (
            <button
              type="button"
              onClick={() => {
                onWebQueryChange(value.search);
                onSourceModeChange("web");
                onWebSearch(value.search);
              }}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Globe className="h-3.5 w-3.5" />
              <span>
                {tr("Search live web for", "Buscar en la web")} &ldquo;{value.search}&rdquo;
              </span>
            </button>
          )}
        </div>
      )}

      {/* Mode A: Live Web Scout Search Bar and Prompt Pills */}
      {sourceMode === "web" ? (
        <div className="space-y-2.5 pt-1">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onWebSearch?.();
            }}
            className="relative flex items-center"
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={webQuery}
              onChange={(e) => onWebQueryChange?.(e.target.value)}
              placeholder={tr(
                "Ask anything to search the live web, e.g. 'Convocatorias de bioeconomia y cacao 2026' or 'Canada agri-food grants'...",
                "Pregunta lo que quieras para buscar en la web, p. ej. 'Convocatorias de bioeconomía y cacao 2026' o 'Canada agri-food grants'...",
              )}
              aria-label={tr("Web search prompt", "Consulta de búsqueda web")}
              className="h-10 pl-9 pr-28 text-sm"
              disabled={isWebSearching}
              autoFocus
            />
            <Button
              type="submit"
              size="sm"
              className="absolute right-1.5 h-7 gap-1 px-3 text-xs"
              disabled={isWebSearching || !webQuery.trim()}
            >
              {isWebSearching ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {tr("Scouting...", "Buscando...")}
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  {tr("Scout Web", "Buscar en la web")}
                </>
              )}
            </Button>
          </form>

          {/* Prompt pills for Rocío's routine requests */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">
              {tr("Quick queries:", "Consultas rápidas:")}
            </span>
            {QUICK_SCOUT_PROMPTS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  onWebQueryChange?.(p.query);
                  onWebSearch?.(p.query);
                }}
                disabled={isWebSearching}
                className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-foreground disabled:opacity-50"
              >
                {lang === "es" ? p.labelEs : p.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Mode B: Tracked Catalog Filters */
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <form
              className="relative min-w-[260px] basis-full"
              onSubmit={(e) => {
                e.preventDefault();
                onSubmitSearch?.(value.search);
              }}
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={value.search}
                onChange={(e) => set("search", e.target.value)}
                placeholder={tr(
                  "Search grants in the system and on the internet: name, funder, topic or a link (Enter)",
                  "Buscar grants en el sistema y en internet: nombre, financiador, tema o un enlace (Enter)",
                )}
                aria-label={tr("Search grants", "Buscar grants")}
                className="h-12 pl-10 text-base"
                autoFocus
              />
            </form>
            <Pick
              label={tr("Country", "País")}
              value={value.country}
              onChange={(v) => set("country", v)}
              options={[
                { value: "all", label: tr("All countries", "Todos los países") },
                ...countries.map((c) => ({ value: c, label: countryName(c, lang) })),
              ]}
            />
            <Pick
              label={tr("Sector", "Sector")}
              value={value.sector}
              onChange={(v) => set("sector", v)}
              options={[
                { value: "all", label: tr("Any sector", "Cualquier sector") },
                ...sectorOptions.map((s) => ({ value: s, label: s })),
              ]}
            />
            <Pick
              label={tr("Verdict", "Veredicto")}
              value={value.verdict}
              onChange={(v) => set("verdict", v)}
              options={(Object.keys(VERDICT_FILTER_LABELS) as RadarVerdictFilter[]).map((k) => ({
                value: k,
                label: label2(VERDICT_FILTER_LABELS[k], lang),
              }))}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowMore((v) => !v)}
              aria-expanded={showMore}
              className="h-9 gap-1 text-xs text-muted-foreground"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {tr("More filters", "Más filtros")}
              {hiddenActive && !showMore && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
              )}
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${showMore ? "rotate-180" : ""}`}
              />
            </Button>
          </div>

          {hasFocus && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Target className="h-3.5 w-3.5 text-primary" />
                {tr("Your focus:", "Tu foco:")}
              </span>
              {focus!.countries.map((c) => {
                const active = value.country.toUpperCase() === c;
                return (
                  <button
                    key={`c-${c}`}
                    type="button"
                    onClick={() => set("country", active ? "all" : c)}
                    aria-pressed={active}
                    title={tr(
                      "From the grants you are working on",
                      "Según los grants en los que estás trabajando",
                    )}
                    className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-primary/30 bg-primary/5 text-foreground hover:bg-primary/10"
                    }`}
                  >
                    {countryName(c, lang)}
                  </button>
                );
              })}
              {focus!.sectors.map((s) => {
                const active = value.sector.toLowerCase() === s.toLowerCase();
                return (
                  <button
                    key={`s-${s}`}
                    type="button"
                    onClick={() => set("sector", active ? "all" : s)}
                    aria-pressed={active}
                    title={tr(
                      "From the grants you are working on",
                      "Según los grants en los que estás trabajando",
                    )}
                    className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted/40 text-foreground hover:bg-muted"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          )}

          {showMore && (
            <div className="space-y-3 rounded-md border bg-muted/20 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Pick
                  label={tr("Status", "Estado")}
                  value={value.status}
                  onChange={(v) => set("status", v)}
                  options={(Object.keys(STATUS_LABELS) as RadarStatusFilter[]).map((k) => ({
                    value: k,
                    label: label2(STATUS_LABELS[k], lang),
                  }))}
                />
                <Pick
                  label={tr("Minimum amount", "Monto mínimo")}
                  value={value.minAmount}
                  onChange={(v) => set("minAmount", v)}
                  options={MIN_AMOUNTS.map((n) => ({ value: n, label: money(n, lang) }))}
                />
                <Pick
                  label={tr("Preparation time", "Tiempo de preparación")}
                  value={value.leadTimeWeeks}
                  onChange={(v) => set("leadTimeWeeks", v)}
                  options={LEAD_TIMES.map((w) => ({
                    value: w,
                    label: tr(`${w} weeks to prepare`, `${w} semanas para preparar`),
                  }))}
                />
              </div>
              {moreFilters}
            </div>
          )}

          {chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {chips.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => set(c.key, DEFAULT_RADAR_FILTERS[c.key] as never)}
                  aria-label={tr(`Remove filter ${c.label}`, `Quitar filtro ${c.label}`)}
                  className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-xs text-foreground hover:bg-accent"
                >
                  {c.label}
                  <X className="h-3 w-3" />
                </button>
              ))}
              <button
                type="button"
                onClick={() =>
                  onChange({ ...DEFAULT_RADAR_FILTERS, leadTimeWeeks: value.leadTimeWeeks })
                }
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                {tr("Clear all", "Limpiar todo")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
