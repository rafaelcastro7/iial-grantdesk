import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  countryName,
  type RadarStatusFilter,
  type RadarVerdictFilter,
} from "@/lib/grant-radar";

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

const MIN_AMOUNTS = [0, 25_000, 50_000, 100_000, 500_000];
const LEAD_TIMES = [2, 4, 6, 8, 12];
const STATUS_LABELS: Record<RadarStatusFilter, string> = {
  active: "In progress",
  new: "New leads",
  pursuing: "Pursuing",
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
}: {
  value: RadarFilterState;
  onChange: (next: RadarFilterState) => void;
  countries: string[];
  sectors: string[];
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
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={value.search}
            onChange={(e) => set("search", e.target.value)}
            placeholder="Search by topic, funder or keyword"
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
            onClick={() => onChange({ ...DEFAULT_RADAR_FILTERS, leadTimeWeeks: value.leadTimeWeeks })}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
