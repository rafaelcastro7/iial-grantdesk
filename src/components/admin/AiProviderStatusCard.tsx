import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { checkAiProviderStatus } from "@/lib/llm-route.functions";

const STATE_LABEL: Record<string, { label: string; className: string }> = {
  available: {
    label: "Available",
    className: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
  },
  quota_exhausted: {
    label: "Daily quota used up",
    className: "border-rose-500/40 text-rose-700 dark:text-rose-400",
  },
  rate_limited: {
    label: "Rate-limited (minutes)",
    className: "border-amber-500/40 text-amber-700 dark:text-amber-400",
  },
  billing_required: {
    label: "Needs payment",
    className: "border-rose-500/40 text-rose-700 dark:text-rose-400",
  },
  invalid_key: {
    label: "Key not working",
    className: "border-rose-500/40 text-rose-700 dark:text-rose-400",
  },
  not_configured: { label: "Not configured", className: "text-muted-foreground" },
  error: {
    label: "Unreachable",
    className: "border-amber-500/40 text-amber-700 dark:text-amber-400",
  },
};

/** Admin view of each AI provider's availability and remaining daily quota. */
export function AiProviderStatusCard() {
  const check = useServerFn(checkAiProviderStatus);
  const run = useMutation({ mutationFn: () => check({ data: {} }) });
  const rows = run.data ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">AI providers</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Calls go to free-tier providers first, then Lovable AI. Checking sends one tiny request
            per provider; it is never run automatically.
          </p>
        </div>
        <Button size="sm" variant="outline" disabled={run.isPending} onClick={() => run.mutate()}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${run.isPending ? "animate-spin" : ""}`} />
          {run.isPending ? "Checking…" : "Check now"}
        </Button>
      </CardHeader>
      <CardContent>
        {run.error && <p className="text-sm text-destructive">{(run.error as Error).message}</p>}
        {rows.length === 0 && !run.error && (
          <p className="text-sm text-muted-foreground">Not checked yet.</p>
        )}
        {rows.length > 0 && (
          <ul className="divide-y text-sm">
            {rows.map((row) => {
              const state = STATE_LABEL[row.state] ?? STATE_LABEL.error;
              return (
                <li
                  key={row.provider}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <div>
                    <span className="font-medium capitalize">{row.provider}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{row.role}</span>
                    {row.detail && (
                      <div className="text-xs text-muted-foreground">{row.detail}</div>
                    )}
                    {row.coolingUntil && (
                      <div className="text-xs text-muted-foreground">
                        Skipped by the app until {new Date(row.coolingUntil).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {row.remainingRequestsToday != null && (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {row.remainingRequestsToday}
                        {row.requestsPerDay != null ? ` / ${row.requestsPerDay}` : ""} requests left
                        today
                      </span>
                    )}
                    <Badge variant="outline" className={state.className}>
                      {state.label}
                    </Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
