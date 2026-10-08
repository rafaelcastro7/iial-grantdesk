import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getOrgProfile } from "@/lib/org.functions";
import { useActiveTenant } from "@/lib/tenant-context";
import { autoEvaluatePending, listGrants } from "@/lib/grants.functions";
import { getVerdictSummary } from "@/lib/fit-insights.functions";
import { evaluationVerdict, realFit } from "@/lib/grant-radar";
import { getFunderDashboardStats } from "@/lib/funder-dashboard.functions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { syncClientLocale } from "@/i18n/sync";
import { AppTopBar } from "@/components/AppSidebar";
import { ActivityFeed } from "@/components/ActivityFeed";
import { PageTransition } from "@/components/PageTransition";
import { ConsultantToday } from "@/components/v2/ConsultantToday";
import { listGrantWorkspaces } from "@/lib/grant-workspace.functions";
import { Activity, ArrowRight, Clock3, ShieldCheck, Search, TrendingUp } from "lucide-react";
import "@/i18n";
import { isActiveGrantStatus } from "@/agents/pipeline-stages.shared";

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <AppTopBar />
      <section className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <Skeleton className="h-28 rounded-xl" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
          <Skeleton className="h-[360px] rounded-xl" />
          <Skeleton className="h-[360px] rounded-xl" />
        </div>
      </section>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard - IIAL" },
      { name: "description", content: "Your IIAL grant intelligence dashboard." },
    ],
  }),
  component: Dashboard,
  pendingComponent: DashboardSkeleton,
});

const DAY_MS = 86_400_000;

type NextStep =
  | {
      kind: "static";
      eyebrow: string;
      title: string;
      body: string;
      cta: string;
      to: "/org" | "/grants";
    }
  | { kind: "grant"; eyebrow: string; title: string; body: string; cta: string; id: string };

function Dashboard() {
  const { activeOrgId } = useActiveTenant();
  const fetchPipeline = useServerFn(listGrantWorkspaces);
  const { data: pipelineData } = useQuery({
    queryKey: ["grant-pipeline", activeOrgId],
    queryFn: () => fetchPipeline({ data: { orgId: activeOrgId as string } }),
    enabled: !!activeOrgId,
  });
  const [email, setEmail] = useState<string | null>(null);
  const [personName, setPersonName] = useState<string | null>(null);

  const fetchOrg = useServerFn(getOrgProfile);
  const { data: org } = useQuery({
    queryKey: ["org", activeOrgId],
    queryFn: () => fetchOrg({ data: { orgId: activeOrgId! } }),
    enabled: !!activeOrgId,
  });
  const fetchGrants = useServerFn(listGrants);
  // Under the "grants" key so every evaluation, dismissal or profile change
  // (which all invalidate ["grants"]) refreshes the dashboard too.
  const { data: grantData } = useQuery({
    queryKey: ["grants", "dashboard", activeOrgId],
    queryFn: () => fetchGrants({ data: { limit: 100, orgId: activeOrgId! } }),
    enabled: !!activeOrgId,
  });
  // Counts come from the shared verdict summary (same as Fit insights), not
  // from the first page of grants.
  const fetchSummary = useServerFn(getVerdictSummary);
  const { data: summary } = useQuery({
    queryKey: ["grants", "verdict-summary", activeOrgId],
    queryFn: () => fetchSummary({ data: { orgId: activeOrgId! } }),
    enabled: !!activeOrgId,
  });
  // Re-check stale verdicts on arrival (rules only, 0 tokens), like the radar.
  const qc = useQueryClient();
  const autoEval = useServerFn(autoEvaluatePending);
  useEffect(() => {
    if (!activeOrgId) return;
    let cancelled = false;
    void autoEval({ data: { limit: 100, background: false, orgId: activeOrgId } })
      .then((r) => {
        if (!cancelled && ((r as { evaluated?: number }).evaluated ?? 0) > 0) {
          void qc.invalidateQueries({ queryKey: ["grants"] });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeOrgId, autoEval, qc]);
  // Coverage trust signal — "how many funders are we watching" is table
  // stakes on every competing grant-search product (Instrumentl, Candid);
  // without it, "56 grants" has no context for whether that's a small slice
  // or the whole relevant universe.
  const fetchFunderStats = useServerFn(getFunderDashboardStats);
  const { data: funderStats } = useQuery({
    queryKey: ["dashboard", "funder-stats"],
    queryFn: () => fetchFunderStats({ data: {} }),
  });
  const funderCount = funderStats?.totalFunders ?? null;

  const p = org?.profile;
  const profileComplete = !!(p?.org_name && p.sectors?.length && p.jurisdictions?.length);

  useEffect(() => {
    syncClientLocale();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setPersonName(firstNameOf(data.user?.user_metadata, data.user?.email));
    });
  }, []);

  const loading = grantData === undefined;
  const grants = (grantData?.grants ?? []).filter((g) => isActiveGrantStatus(g.status));
  const now = Date.now();

  const eligible = summary?.eligible ?? 0;
  const scored = summary?.checked ?? 0;
  const withDeadline = grants.filter((g) => !!g.deadline).length;
  const closingSoon = grants.filter((g) => {
    if (!g.deadline) return false;
    const d = (new Date(g.deadline).getTime() - now) / DAY_MS;
    return d >= 0 && d <= 30;
  }).length;
  // Same source as the Pipeline page: grants with an application plan.
  const inPipeline = (pipelineData?.rows ?? []).filter(
    (r) => r.workspace.priority !== "discard",
  ).length;
  // "Never enriched" (status still "discovered") looks identical to "checked,
  // nothing interesting" in a bare count — the enriched count disambiguates.
  const enrichedCount = grants.filter((g) => g.status !== "discovered").length;

  // Excludes submitted/won: those already have a decision in flight or made —
  // "review your top match" should point at something still worth acting on,
  // not a grant that's already past the point topMatches is nudging toward.
  const topMatches = [...grants]
    .filter(
      (g) =>
        g.evaluation &&
        g.status !== "submitted" &&
        g.status !== "won" &&
        (!g.deadline || new Date(g.deadline).getTime() >= now),
    )
    .sort(
      (a, b) =>
        VERDICT_RANK[evaluationVerdict(b.evaluation!)] -
          VERDICT_RANK[evaluationVerdict(a.evaluation!)] ||
        // Real (AI-reviewed) fit; rules-only pre-checks have no score yet.
        (realFit(b.evaluation) ?? -1) - (realFit(a.evaluation) ?? -1),
    )
    .slice(0, 5);

  // The single next action, phrased around the user's real situation.
  // `kind` discriminates a static-route CTA from the dynamic top-match one.
  const nextStep: NextStep = !profileComplete
    ? {
        kind: "static",
        eyebrow: "Set up",
        title: "Add your organization profile",
        body: "Sectors, jurisdictions, and budget let the system score grants against who you actually are — not generic defaults.",
        cta: "Complete profile",
        to: "/org",
      }
    : scored === 0
      ? {
          kind: "static",
          eyebrow: "Get started",
          title: "Check your fit on a grant",
          body: "Open Grants and run “Check my fit” to get an eligibility verdict and a match score for each opportunity.",
          cta: "Browse grants",
          to: "/grants",
        }
      : topMatches[0]
        ? {
            kind: "grant",
            eyebrow: "Recommended",
            title: `Review your top match: ${topMatches[0].title}`,
            body: "It has the highest fit for your organization. Open it to see the reasoning, requirements, and start a proposal.",
            cta: "Open top match",
            id: topMatches[0].id,
          }
        : {
            kind: "static",
            eyebrow: "Recommended",
            title: "Move a strong fit into a proposal",
            body: "You have scored grants. Draft a proposal from your best opportunity and track it to submission.",
            cta: "Browse grants",
            to: "/grants",
          };

  // Greet the person, not the organization ("Welcome back, Rocio").
  const greeting = personName ? `Welcome back, ${personName}` : "Welcome back";

  return (
    <DashboardV2
      closingSoon={closingSoon}
      eligible={eligible}
      email={email}
      enrichedCount={enrichedCount}
      funderCount={funderCount}
      grantsCount={grants.length}
      greeting={greeting}
      inPipeline={inPipeline}
      loading={loading}
      nextStep={nextStep}
      now={now}
      scored={scored}
      needsInput={summary?.needsInput ?? 0}
      notEligible={summary?.notEligible ?? 0}
      topMatches={topMatches}
      withDeadline={withDeadline}
    />
  );
}

type MatchGrant = {
  id: string;
  title: string;
  deadline: string | null;
  funder: { name: string } | { name: string }[] | null;
  evaluation: {
    fit_score: number;
    eligibility_pass: boolean;
    rule_verdict?: string | null;
    model?: string | null;
    is_exhaustive?: boolean | null;
  } | null;
};

const VERDICT_RANK = { eligible: 2, needs_input: 1, not_eligible: 0 } as const;

/** Badge text shared by both match rows; same reading as the radar. */
function matchLabel(evaluation: MatchGrant["evaluation"]): string {
  if (!evaluation) return "Needs fit check";
  const v = evaluationVerdict(evaluation);
  return v === "eligible" ? "Eligible" : v === "needs_input" ? "Confirm eligibility" : "Not a fit";
}

function DashboardV2({
  closingSoon,
  eligible,
  email,
  enrichedCount,
  funderCount,
  grantsCount,
  greeting,
  inPipeline,
  loading,
  nextStep,
  now,
  scored,
  needsInput,
  notEligible,
  topMatches,
  withDeadline,
}: {
  closingSoon: number;
  eligible: number;
  email: string | null;
  enrichedCount: number;
  funderCount: number | null;
  grantsCount: number;
  greeting: string;
  inPipeline: number;
  loading: boolean;
  nextStep: NextStep;
  now: number;
  scored: number;
  needsInput: number;
  notEligible: number;
  topMatches: MatchGrant[];
  withDeadline: number;
}) {
  const headlineGreeting = greeting.replace(/[.!?]+$/, "");

  return (
    <PageTransition>
      <div className="min-h-screen text-foreground">
        <section className="mx-auto max-w-[1500px] space-y-5 px-4 py-5 sm:px-6 lg:py-6">
          <ConsultantToday greeting={headlineGreeting} />

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <V2Metric
              icon={Search}
              label="Active opportunities"
              value={loading ? "-" : grantsCount}
              detail={
                loading
                  ? "Loading grants"
                  : funderCount != null
                    ? `${enrichedCount} enriched · ${funderCount} funders watched`
                    : `${enrichedCount} enriched`
              }
              to="/grants"
            />
            <V2Metric
              icon={ShieldCheck}
              label="Eligible"
              value={loading ? "-" : eligible}
              detail={
                scored
                  ? `of ${scored} open grants checked · ${needsInput} need a check · ${notEligible} not a fit`
                  : "Run fit checks"
              }
              tone="success"
              to="/grants"
            />
            <V2Metric
              icon={Clock3}
              label="Closing soon"
              value={loading ? "-" : closingSoon}
              detail="Deadline inside 30 days"
              tone={closingSoon > 0 ? "warning" : "neutral"}
              to="/grants"
            />
            <V2Metric
              icon={TrendingUp}
              label="Pipeline"
              value={loading ? "-" : inPipeline}
              detail="Grants with an application plan"
              to="/pipeline"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.8fr)]">
            <section className="rounded-md border bg-card shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold">Opportunity queue</h2>
                  <p className="text-sm text-muted-foreground">
                    Best matches first, with deadline pressure visible.
                  </p>
                </div>
                <Button asChild variant="outline" size="sm" className="gap-2">
                  <Link to="/grants">
                    Open radar <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <div className="divide-y">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="px-5 py-4">
                      <Skeleton className="h-14 rounded-md" />
                    </div>
                  ))
                ) : topMatches.length === 0 ? (
                  <div className="px-5 py-12 text-center">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md border bg-muted">
                      <Activity className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="mt-3 text-sm font-semibold">No scored grants yet</p>
                    <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                      Open the grant radar and run fit checks to build a ranked queue.
                    </p>
                  </div>
                ) : (
                  topMatches.map((grant) => <V2MatchRow key={grant.id} grant={grant} now={now} />)
                )}
              </div>
            </section>

            <section className="rounded-md border bg-card p-1 shadow-sm">
              <div className="border-b px-4 py-3">
                <h2 className="text-base font-semibold">Activity stream</h2>
                <p className="text-sm text-muted-foreground">Recent system and team movement.</p>
              </div>
              <ActivityFeed />
            </section>
          </div>
        </section>
      </div>
    </PageTransition>
  );
}

function V2Metric({
  detail,
  icon: Icon,
  label,
  tone = "neutral",
  to,
  value,
}: {
  detail: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  tone?: "success" | "warning" | "neutral";
  to: string;
  value: string | number;
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : "text-primary";

  return (
    <Link to={to} className="group block">
      <div className="card-hover rounded-xl border border-border/60 bg-card p-4 shadow-2xs">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
            {label}
          </div>
          <Icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
        </div>
        <div
          className={cn(
            "mt-3 text-3xl font-bold leading-none tabular-nums tracking-tight",
            toneClass,
          )}
        >
          {value}
        </div>
        <div className="mt-1.5 text-xs text-muted-foreground">{detail}</div>
      </div>
    </Link>
  );
}

function V2MatchRow({ grant, now }: { grant: MatchGrant; now: number }) {
  const f = Array.isArray(grant.funder) ? grant.funder[0] : grant.funder;
  const fit = realFit(grant.evaluation);
  const eligible = grant.evaluation?.eligibility_pass ?? false;
  const days = grant.deadline
    ? Math.ceil((new Date(grant.deadline).getTime() - now) / DAY_MS)
    : null;
  const deadlineLabel =
    days == null
      ? "Rolling deadline"
      : days < 0
        ? "Closed"
        : days === 0
          ? "Closes today"
          : `Closes in ${days} days`;

  return (
    <Link
      to="/grants/$id"
      params={{ id: grant.id }}
      className="group grid gap-3 px-5 py-4 transition-colors hover:bg-accent/40 md:grid-cols-[minmax(0,1fr)_160px_88px]"
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold tracking-tight transition-colors group-hover:text-primary">
          {grant.title}
        </div>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="truncate">{f?.name ?? "Unknown funder"}</span>
          <span className="h-1 w-1 rounded-full bg-border" />
          <span
            className={
              days != null && days >= 0 && days <= 7
                ? "font-semibold text-rose-600 dark:text-rose-400"
                : ""
            }
          >
            {deadlineLabel}
          </span>
        </div>
      </div>
      <div className="flex items-center md:justify-end">
        <Badge
          variant="outline"
          className={cn(
            "rounded-lg px-2.5 py-0.5 text-xs font-medium",
            eligible
              ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "text-muted-foreground",
          )}
        >
          {matchLabel(grant.evaluation)}
        </Badge>
      </div>
      <div className="flex items-center gap-2 md:justify-end">
        <div className="text-right">
          <div className="text-2xl font-bold leading-none tabular-nums tracking-tight text-primary">
            {fit == null ? "—" : fit}
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {fit == null && grant.evaluation ? "AI review pending" : "fit score"}
          </div>
        </div>
      </div>
    </Link>
  );
}

/** First name from the sign-up metadata, else from the email (rocio.diaz@x -> Rocio). */
function firstNameOf(meta: Record<string, unknown> | undefined, email: string | null | undefined) {
  const fromMeta = [meta?.first_name, meta?.full_name, meta?.name].find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
  const raw = fromMeta?.trim().split(/\s+/)[0] ?? email?.split("@")[0].split(/[._+\-\d]/)[0] ?? "";
  if (raw.length < 2) return null;
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}
