import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, ExternalLink, Loader2, MapPin, Wallet } from "lucide-react";
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
}: {
  item: RadarItem<GrantRowData>;
  actions: RadarActions;
  highlight?: boolean;
}) {
  const g = item.grant;
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
        "group rounded-lg border bg-card p-4 transition-colors hover:border-primary/40",
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
            {item.fit != null && (
              <span className="text-xs text-muted-foreground">Fit {Math.round(item.fit)}</span>
            )}
            {g.isNewSinceLastReview && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">New</span>
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
          {item.nextAction === "open" ? (
            <Button asChild size="sm" variant="outline">
              <Link to="/grants/$id" params={{ id: g.id }}>
                Open <ArrowRight className="ml-1 h-3.5 w-3.5" />
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
      {actions.onFeedback && (
        <div className="mt-3 border-t pt-3">
          <GrantFeedbackControls grant={g} onFeedback={actions.onFeedback} compact />
        </div>
      )}
    </article>
  );
}
