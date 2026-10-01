import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  ExternalLink,
  Loader2,
  MapPin,
  Wallet,
} from "lucide-react";
import type { GrantRowData } from "@/components/grants/GrantRow";
import {
  GrantFeedbackControls,
  type GrantFeedbackDecision,
} from "@/components/grants/GrantFeedbackControls";
import { Button } from "@/components/ui/button";
import {
  NEXT_ACTION_LABELS,
  VERDICT_LABELS,
  countryName,
  formatMoney,
  timingLabel,
  type RadarItem,
} from "@/lib/grant-radar";
import { FUNDING_KIND_LABEL, fundingKindOf } from "@/lib/grant-radar";
import { cn } from "@/lib/utils";

export type RadarActions = {
  pending: string | null;
  evaluatingIds: Set<string>;
  onEnrich: (id: string) => void;
  onEvaluate: (id: string) => void;
  onDraft: (id: string) => void;
  onFeedback?: (grant: GrantRowData, decision: GrantFeedbackDecision) => void;
};

const VERDICT_STYLE = {
  eligible: "bg-eligible/12 text-eligible border-eligible/30",
  needs_input: "bg-needs-input/12 text-needs-input border-needs-input/30",
  not_eligible: "bg-ineligible/10 text-ineligible border-ineligible/30",
} as const;

function funderName(g: GrantRowData): string | null {
  const f = Array.isArray(g.funder) ? g.funder[0] : g.funder;
  return f?.name ?? null;
}

export function RadarCard({
  item,
  actions,
  highlight = false,
  simple = false,
}: {
  item: RadarItem<GrantRowData>;
  actions: RadarActions;
  highlight?: boolean;
  simple?: boolean;
}) {
  const g = item.grant;
  const criticalRequirements = (g.requirements ?? []).filter(
    (requirement) => requirement.isCritical,
  );
  const busy =
    actions.evaluatingIds.has(g.id) ||
    actions.pending === g.id ||
    actions.pending === `${g.id}:draft` ||
    actions.pending === `${g.id}:enrich`;

  const runAction = () => {
    if (item.nextAction === "enrich") actions.onEnrich(g.id);
    else if (item.nextAction === "evaluate") actions.onEvaluate(g.id);
    else if (item.nextAction === "draft") actions.onDraft(g.id);
  };

  const timingTone =
    item.timing === "urgent"
      ? "text-needs-input"
      : item.timing === "too_soon" || item.timing === "closed"
        ? "text-ineligible"
        : "text-muted-foreground";

  return (
    <article
      className={cn(
        "group rounded-md border bg-card p-4 transition-colors hover:border-primary/40",
        highlight && "border-primary/50 ring-1 ring-primary/20",
        item.parked && "opacity-75",
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                VERDICT_STYLE[item.verdict],
              )}
            >
              {VERDICT_LABELS[item.verdict]}
            </span>
            {item.fit != null && !simple && (
              <span className="text-xs font-medium text-muted-foreground">
                Fit {item.fit > 1 ? Math.round(item.fit) : Math.round(item.fit * 100)}%
              </span>
            )}
            {g.isNewSinceLastReview && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                New
              </span>
            )}
            {fundingKindOf(g) !== "grant" && (
              <span className="rounded-full border border-amber-500/40 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                {FUNDING_KIND_LABEL[fundingKindOf(g)]}
              </span>
            )}
          </div>
          <Link
            to="/grants/$id"
            params={{ id: g.id }}
            className="line-clamp-2 font-display text-base font-semibold leading-snug text-foreground hover:text-primary"
          >
            {g.title || "Untitled opportunity"}
          </Link>
          {funderName(g) && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{funderName(g)}</p>
          )}
          {item.reason && (
            <div
              className={cn(
                "mt-2 rounded-md border p-2 text-xs",
                item.verdict === "not_eligible"
                  ? "border-destructive/30 bg-destructive/5 text-destructive"
                  : "border-border/60 bg-muted/40 text-muted-foreground",
              )}
              title={item.reason}
            >
              <p className="line-clamp-3 whitespace-pre-line">
                <span className="font-semibold text-foreground">
                  {item.verdict === "not_eligible"
                    ? "Motivo de descarte: "
                    : simple
                      ? "Why: "
                      : "Reglas: "}
                </span>
                {item.reason}
              </p>
            </div>
          )}
          {criticalRequirements.length > 0 && (
            <div className="mt-2 border-l-2 border-warning pl-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-warning">
                <AlertTriangle className="h-3.5 w-3.5" />
                {criticalRequirements.length} critical requirement
                {criticalRequirements.length === 1 ? "" : "s"}
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {criticalRequirements.map((requirement) => requirement.requirement).join(" · ")}
              </p>
            </div>
          )}
          {g.reviewState && !simple && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border bg-secondary px-2 py-0.5 font-medium text-secondary-foreground">
                Evidence {g.reviewState.coverage_pct}%
              </span>
              {g.reviewState.status === "applicable" ? (
                <span className="text-eligible">Strict review passed</span>
              ) : g.reviewState.status === "remediable" ? (
                <span className="text-needs-input">Can be remediated</span>
              ) : g.reviewState.status === "ineligible" ? (
                <span className="text-ineligible">Rule-based exclusion</span>
              ) : (
                <span className="text-muted-foreground">Needs source verification</span>
              )}
              {g.reviewState.next_action && (
                <span className="line-clamp-1 text-muted-foreground">
                  Next: {g.reviewState.next_action}
                </span>
              )}
            </div>
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className={cn("inline-flex items-center gap-1", timingTone)}>
              <CalendarClock className="h-3.5 w-3.5" />
              {timingLabel(item)}
            </span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" />
              {formatMoney(item.amount)}
            </span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {countryName(item.country)}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 md:flex-col md:items-end">
          {simple || item.nextAction === "open" ? (
            <Button asChild size="sm" variant="outline">
              <Link to="/grants/$id" params={{ id: g.id }}>
                {simple ? "View details" : "Open"} <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : (
            <Button size="sm" onClick={runAction} disabled={busy}>
              {busy ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowRight className="mr-1 h-3.5 w-3.5" />
              )}
              {NEXT_ACTION_LABELS[item.nextAction]}
            </Button>
          )}
          {g.url && (
            <a
              href={g.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Official page <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
      {actions.onFeedback && !simple && (
        <div className="mt-3 border-t pt-3">
          <GrantFeedbackControls grant={g} onFeedback={actions.onFeedback} compact />
        </div>
      )}
    </article>
  );
}
