import { Globe, Loader2, Search, ShieldCheck, Sparkles, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { countryName, type RadarStatusFilter, type RadarVerdictFilter } from "@/lib/grant-radar";

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
    query: "Canada agriculture and food innovation grant calls 2026 sustainable food distribution",
  },
  {
    label: "🍫 Cacao & Bioeconomy (Peru/LATAM)",
    query: "Convocatorias y grants de cacao, bioeconomia y agricultura sostenible en Peru o Latinoamerica 2026",
  },
  {
    label: "🎓 Canadian Academic Consortium",
    query: "Canadian college research partnership grants SSHRC agri-food applied research 2026",
  },
  {
    label: "🌍 GAC & International Rolling Calls",
    query: "Global Affairs Canada international assistance unsolicited concept notes CFLI Peru 2026",
  },
];

const MIN_AMOUNTS = [0, 25_000, 50_000, 100_000, 500_000];
const LEAD_TIMES = [2, 4, 6, 8, 12];
const STATUS_LABELS: Record<RadarStatusFilter, string> = {
  active: "In progress",
  new: "New leads",
  pursuing: "Pursuing",
  upcoming: "Upcoming cycles",
  closed: "Finished",
  all: "Everything",
};
const VERDICT_LABELS: Record<RadarVerdictFilter, string> = {
  all: "Any verdict",
  eligible: "You can apply",
  needs_input: "Needs a check",
  not_eligible: "Not a fit",
};

function money(n: number) {
  return n === 0 ? "Any amount" : `From $${n >= 1000 ? `${n / 1000}K` : n}`;
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
  isWebSearching = false,
  totalCatalogLoaded = 0,
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
  isWebSearching?: boolean;
  totalCatalogLoaded?: number;
}) {
  const set = <K extends keyof RadarFilterState>(k: K, v: RadarFilterState[K]) =>
    onChange({ ...value, [k]: v });

  const chips: Array<{ key: keyof RadarFilterState; label: string }> = [];
  if (value.country !== "all") chips.push({ key: "country", label: countryName(value.country) });
  if (value.sector !== "all") chips.push({ key: "sector", label: value.sector });
  if (value.verdict !== DEFAULT_RADAR_FILTERS.verdict)
    chips.push({ key: "verdict", label: VERDICT_LABELS[value.verdict] });
  if (value.status !== DEFAULT_RADAR_FILTERS.status)
    chips.push({ key: "status", label: STATUS_LABELS[value.status] });
  if (value.minAmount !== DEFAULT_RADAR_FILTERS.minAmount)
    chips.push({ key: "minAmount", label: money(value.minAmount) });

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
              <span>Tracked Catalog</span>
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
              <span>AI Web Scout (Live Internet)</span>
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
              <span>Search live web for &ldquo;{value.search}&rdquo;</span>
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
              placeholder="Ask anything to search the live web, e.g. 'Convocatorias de bioeconomia y cacao 2026' or 'Canada agri-food grants'..."
              aria-label="Web search prompt"
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
                  Scouting...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Scout Web
                </>
              )}
            </Button>
          </form>

          {/* Prompt pills for Rocío's routine requests */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Quick queries:</span>
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
                {p.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Mode B: Tracked Catalog Filters */
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={value.search}
                onChange={(e) => set("search", e.target.value)}
                placeholder="Search catalog by topic, funder or keyword"
                aria-label="Search grants"
                className="h-9 pl-9"
              />
            </div>
            <Pick
              label="Country"
              value={value.country}
              onChange={(v) => set("country", v)}
              options={[
                { value: "all", label: "All countries" },
                ...countries.map((c) => ({ value: c, label: countryName(c) })),
              ]}
            />
            <Pick
              label="Sector"
              value={value.sector}
              onChange={(v) => set("sector", v)}
              options={[
                { value: "all", label: "Any sector" },
                ...sectors.map((s) => ({ value: s, label: s })),
              ]}
            />
            <Pick
              label="Minimum amount"
              value={value.minAmount}
              onChange={(v) => set("minAmount", v)}
              options={MIN_AMOUNTS.map((n) => ({ value: n, label: money(n) }))}
            />
            <Pick
              label="Verdict"
              value={value.verdict}
              onChange={(v) => set("verdict", v)}
              options={(Object.keys(VERDICT_LABELS) as RadarVerdictFilter[]).map((k) => ({
                value: k,
                label: VERDICT_LABELS[k],
              }))}
            />
            <Pick
              label="Status"
              value={value.status}
              onChange={(v) => set("status", v)}
              options={(Object.keys(STATUS_LABELS) as RadarStatusFilter[]).map((k) => ({
                value: k,
                label: STATUS_LABELS[k],
              }))}
            />
            <Pick
              label="Preparation time"
              value={value.leadTimeWeeks}
              onChange={(v) => set("leadTimeWeeks", v)}
              options={LEAD_TIMES.map((w) => ({ value: w, label: `${w} weeks to prepare` }))}
            />
          </div>

          {chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {chips.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => set(c.key, DEFAULT_RADAR_FILTERS[c.key] as never)}
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
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
