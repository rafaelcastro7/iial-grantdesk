import { ShieldCheck, Sparkles, Loader2 } from "lucide-react";
import type { RadarClientProfile } from "@/lib/radar.functions";
import type { RadarResult, RadarGrant } from "@/lib/grant-radar";
import { Button } from "@/components/ui/button";

/**
 * Shows who every grant is being checked against, and the outcome of that
 * deterministic check: can apply / needs input / ruled out (pre-filtered).
 */
export function EligibilityCheckBar({
  profiles,
  selected,
  onSelect,
  counts,
  hiddenByRules,
  hideIneligible,
  onToggleHide,
  onEvaluateAll,
  isEvaluatingAll,
  evalProgress,
}: {
  profiles: RadarClientProfile[];
  selected: RadarClientProfile | null;
  onSelect: (clientId: string) => void;
  counts: RadarResult<RadarGrant>["counts"];
  hiddenByRules: number;
  hideIneligible: boolean;
  onToggleHide: () => void;
  onEvaluateAll?: () => void;
  isEvaluatingAll?: boolean;
  evalProgress?: { current: number; total: number; lastTitle?: string } | null;
}) {
  if (!selected) {
    return (
      <div className="rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        Add a client profile to check every grant against eligibility rules before it is listed.
      </div>
    );
  }
  const ruledOut = hideIneligible ? hiddenByRules : counts.notEligible;
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-l-4 border-primary px-4 py-3">
        <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold text-foreground">
            Eligibility pre-check against{" "}
            {profiles.length > 1 ? (
              <select
                aria-label="Client profile"
                value={selected.clientId}
                onChange={(e) => onSelect(e.target.value)}
                className="rounded border border-border bg-background px-1.5 py-0.5 font-semibold text-primary"
              >
                {profiles.map((p) => (
                  <option key={p.clientId} value={p.clientId}>
                    {p.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-primary">{selected.name}</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            Every grant is run through the same rules first — territory, status, deadline vs{" "}
            {selected.leadTimeWeeks ?? 3} weeks of preparation, applicant type, scale and cost share.
          </p>
        </div>
        <dl className="flex gap-2 text-center text-xs">
          <Stat label="Can apply" value={counts.eligible} tone="text-eligible" />
          <Stat label="Needs input" value={counts.needsInput} tone="text-needs-input" />
          <Stat label="Ruled out" value={ruledOut} tone="text-ineligible" />
        </dl>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleHide}
          >
            {hideIneligible ? "Show ruled out" : "Hide ruled out"}
          </Button>
          {onEvaluateAll && (
            <Button
              variant="default"
              size="sm"
              disabled={isEvaluatingAll}
              onClick={onEvaluateAll}
              className="gap-1.5 font-medium"
              title="Evalúa la compatibilidad de cada convocatoria usando el Evaluador con el perfil de la organización"
            >
              {isEvaluatingAll ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>
                    {evalProgress ? `Evaluando ${evalProgress.current}/${evalProgress.total}...` : "Evaluando..."}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  <span>Auto-evaluar listadas</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="min-w-[72px] rounded-md bg-muted px-2 py-1.5">
      <dd className={`font-display text-lg font-bold leading-none ${tone}`}>{value}</dd>
      <dt className="mt-1 text-muted-foreground">{label}</dt>
    </div>
  );
}
