import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Lightbulb, Plus, XCircle } from "lucide-react";
import { useState } from "react";
import { PageContainer, PageHeader } from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { applyProfileSuggestion, getFitInsights } from "@/lib/fit-insights.functions";

export const Route = createFileRoute("/_authenticated/insights")({
  component: FitInsightsPage,
});

function FitInsightsPage() {
  const fetchInsights = useServerFn(getFitInsights);
  const apply = useServerFn(applyProfileSuggestion);
  const qc = useQueryClient();
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const { data, isLoading, error } = useQuery({
    queryKey: ["fit-insights"],
    queryFn: () => fetchInsights(),
  });
  const mutation = useMutation({
    mutationFn: (s: { kind: string; value: string }) =>
      apply({ data: s as { kind: "add_sector"; value: string } }),
    onSuccess: async (_r, s) => {
      setApplied((prev) => new Set(prev).add(`${s.kind}:${s.value}`));
      await qc.invalidateQueries({ queryKey: ["grants"] });
      await qc.invalidateQueries({ queryKey: ["org", "self"] });
      await qc.invalidateQueries({ queryKey: ["fit-insights"] });
    },
  });

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Insights"
        title="Why grants are not a fit"
        description="The most common reasons your organization does not pass, and profile changes that could open more grants. Apply a change here; every grant is re-checked automatically."
      />

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

      {data && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Grants checked" value={data.evaluated} />
            <Stat label="You can apply" value={data.passing} tone="good" />
            <Stat label="Not a fit" value={data.failing} tone="bad" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lightbulb className="h-4 w-4 text-amber-500" /> Suggested profile changes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.suggestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No profile change would open more grants right now.
                </p>
              ) : (
                <ul className="divide-y">
                  {data.suggestions.map((s) => {
                    const key = `${s.kind}:${s.value}`;
                    const done = applied.has(key);
                    return (
                      <li
                        key={key}
                        className="flex flex-wrap items-start justify-between gap-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{s.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.unlocks > 0
                              ? `Could open ${s.unlocks} grant${s.unlocks === 1 ? "" : "s"} that fail only on this. `
                              : ""}
                            Asked for by:{" "}
                            {s.grants
                              .slice(0, 3)
                              .map((g) => g.title)
                              .join("; ")}
                            {s.grants.length > 3 ? ` and ${s.grants.length - 3} more` : ""}.
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Only apply it if it is true for your organization.
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant={done ? "outline" : "default"}
                          disabled={done || mutation.isPending}
                          onClick={() => mutation.mutate({ kind: s.kind, value: s.value })}
                        >
                          {done ? (
                            <>
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Added
                            </>
                          ) : (
                            <>
                              <Plus className="mr-1 h-3.5 w-3.5" /> Add to profile
                            </>
                          )}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {mutation.error && (
                <p className="mt-2 text-sm text-destructive">{(mutation.error as Error).message}</p>
              )}
              {applied.size > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Profile updated. Open the{" "}
                  <Link
                    to="/grants"
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    grant radar
                  </Link>{" "}
                  to re-check every grant automatically.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <XCircle className="h-4 w-4 text-rose-500" /> Why grants do not pass
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.reasons.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing is failing.</p>
              ) : (
                <ul className="divide-y">
                  {data.reasons.map((r) => (
                    <li key={r.id} className="py-3">
                      <details>
                        <summary className="cursor-pointer text-sm">
                          <span className="font-medium">{r.title}</span>{" "}
                          <span className="text-muted-foreground">
                            — {r.count} grant{r.count === 1 ? "" : "s"}
                          </span>
                        </summary>
                        <ul className="mt-2 space-y-1 pl-4 text-xs">
                          {r.grants.map((g) => (
                            <li key={g.id}>
                              <Link
                                to="/grants/$id"
                                params={{ id: g.id }}
                                className="text-primary underline-offset-4 hover:underline"
                              >
                                {g.title}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </details>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-rose-600" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
